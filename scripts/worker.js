// Long-running worker: scheduled jobs (auto-overdue, auto-generate invoices, expiry reminders).
// Uses Node's setTimeout/setInterval directly — no external cron lib needed.
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

function log(...args) {
  console.log(`[worker ${new Date().toISOString()}]`, ...args);
}

// ---------- helpers ----------

async function markOverdueInvoices() {
  const now = new Date();
  const r = await prisma.invoice.updateMany({
    where: {
      status: { in: ["PENDING", "PARTIAL"] },
      dueDate: { lt: now },
    },
    data: { status: "OVERDUE" },
  });
  return r.count;
}

async function autoExpireContracts() {
  const now = new Date();
  const r = await prisma.contract.updateMany({
    where: { status: "ACTIVE", isOpenEnded: false, endDate: { lt: now } },
    data: { status: "EXPIRED" },
  });
  // Free rooms whose ACTIVE contracts just expired
  const expired = await prisma.contract.findMany({
    where: { status: "EXPIRED", isOpenEnded: false, endDate: { lt: now } },
    select: { roomId: true },
  });
  for (const e of expired) {
    const stillActive = await prisma.contract.count({ where: { roomId: e.roomId, status: "ACTIVE" } });
    if (stillActive === 0) {
      await prisma.room.update({ where: { id: e.roomId }, data: { status: "AVAILABLE" } }).catch(() => {});
    }
  }
  return r.count;
}

async function autoGenerateInvoices() {
  const now = new Date();
  const dom = now.getDate();
  // Group contracts by building's autoGenerateInvoiceDay
  const buildings = await prisma.building.findMany({
    where: { setting: { autoGenerateInvoiceDay: dom } },
    include: { setting: true },
  });
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  let total = 0;
  for (const b of buildings) {
    total += await generateForBuilding(b.id, month, year);
  }
  return total;
}

async function generateForBuilding(buildingId, month, year) {
  const contracts = await prisma.contract.findMany({
    where: { buildingId, status: "ACTIVE" },
    include: { building: { include: { setting: true } }, yearlyRents: true },
  });
  let created = 0;
  for (const c of contracts) {
    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 0);
    if (!c.isOpenEnded && c.endDate < startOfMonth) continue;
    if (c.startDate > endOfMonth) continue;

    const existing = await prisma.invoice.findUnique({
      where: { contractId_month_year: { contractId: c.id, month, year } },
    });
    if (existing) continue;

    const dueDay = c.building.setting?.defaultDueDay ?? c.paymentDay ?? 5;
    const dueDate = new Date(year, month - 1, Math.min(dueDay, 28));

    // Effective rent based on contract year
    const startDate = new Date(c.startDate);
    let yearIdx = (year - startDate.getFullYear()) * 1 + 1;
    const monthsDiff = (year - startDate.getFullYear()) * 12 + (month - 1 - startDate.getMonth());
    yearIdx = Math.max(1, Math.floor(monthsDiff / 12) + 1);
    const yearlyMatch = c.yearlyRents.find((y) => y.yearIndex === yearIdx);
    const effectiveRent = yearlyMatch ? yearlyMatch.rent : c.monthlyRent;

    // Snapshot from current building setting (override contract values)
    const electricityPrice = c.building.setting?.electricityPricePerKwh ?? c.electricityPricePerKwh;
    const parkingFeePerVeh = c.building.setting?.parkingFeePerVehicle ?? c.parkingFeePerVehicle;

    const vatAmount = BigInt(Math.round(Number(effectiveRent) * c.vatRate));
    const parkingFee = BigInt(c.parkingCount) * parkingFeePerVeh;
    // VAT is included in effectiveRent (after-VAT). Don't add it on top.
    const totalAmount = effectiveRent + parkingFee + c.serviceFeeAmount;

    const code = await nextInvoiceCode(buildingId, month, year);
    await prisma.invoice.create({
      data: {
        contractId: c.id,
        buildingId,
        code,
        month,
        year,
        dueDate,
        rentAmount: effectiveRent,
        vatAmount,
        electricityPricePerKwh: electricityPrice,
        electricityFee: 0n,
        parkingCount: c.parkingCount,
        parkingFeePerVehicle: parkingFeePerVeh,
        parkingFee,
        overtimeFee: 0n,
        serviceFee: c.serviceFeeAmount,
        totalAmount,
        paidAmount: 0n,
        status: "PENDING",
      },
    });
    created++;
  }
  return created;
}

async function nextInvoiceCode(buildingId, month, year) {
  const ym = `${String(year).slice(-2)}${String(month).padStart(2, "0")}`;
  const prefix = `HD-${ym}-`;
  const last = await prisma.invoice.findFirst({
    where: { buildingId, code: { startsWith: prefix } },
    orderBy: { code: "desc" },
  });
  const n = last ? parseInt(last.code.slice(prefix.length), 10) : 0;
  return `${prefix}${String(n + 1).padStart(3, "0")}`;
}

// ---------- scheduler ----------

async function runJobs() {
  try {
    const [ov, ex, gen] = await Promise.all([
      markOverdueInvoices(),
      autoExpireContracts(),
      autoGenerateInvoices(),
    ]);
    if (ov || ex || gen) log(`overdue=${ov} expired=${ex} generated=${gen}`);
  } catch (e) {
    log("job error:", e.message);
  }
}

function msUntilNextHourMark(targetMin = 5) {
  const now = new Date();
  const next = new Date(now);
  next.setHours(next.getHours() + 1, targetMin, 0, 0);
  return next - now;
}

async function loop() {
  log("worker started");
  // First run after short delay (let DB settle)
  await new Promise((r) => setTimeout(r, 5000));
  while (true) {
    await runJobs();
    const wait = msUntilNextHourMark(5); // every hour at :05
    log(`sleep ${Math.round(wait / 60000)} min`);
    await new Promise((r) => setTimeout(r, wait));
  }
}

loop().catch((e) => {
  console.error(e);
  process.exit(1);
});
