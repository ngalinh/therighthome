import { prisma } from "@/lib/prisma";

function pad(n: number, w = 3) { return String(n).padStart(w, "0"); }

function ymPart(date = new Date()) {
  const y = String(date.getFullYear()).slice(-2);
  const m = pad(date.getMonth() + 1, 2);
  return `${y}${m}`;
}

/**
 * Contract code: <TYPE>-DDMMYY when this is the FIRST contract of that
 * (type, day) combination across all buildings of the type. The second
 * contract on the same day causes the first one to be renamed to -01 and
 * the new one becomes -02. Subsequent contracts continue -03, -04, ...
 *
 * Examples:
 *   First CHDV contract on 5/12/25 → CHDV-051225
 *   Second CHDV contract same day  → CHDV-051225-01 (renamed) + CHDV-051225-02
 */
export async function nextContractCode(buildingId: string, startDate: Date): Promise<string> {
  const building = await prisma.building.findUnique({
    where: { id: buildingId },
    select: { type: true },
  });
  if (!building) throw new Error("Building not found");
  const dd = pad(startDate.getDate(), 2);
  const mm = pad(startDate.getMonth() + 1, 2);
  const yy = String(startDate.getFullYear()).slice(-2);
  const base = `${building.type}-${dd}${mm}${yy}`;
  const prefix = `${base}-`;

  const sameDay = await prisma.contract.findMany({
    where: {
      OR: [{ code: base }, { code: { startsWith: prefix } }],
    },
    select: { id: true, code: true },
  });

  if (sameDay.length === 0) return base;

  // If a bare "BASE" exists, promote it to BASE-01 so the new one can be -02.
  const bareIdx = sameDay.findIndex((c) => c.code === base);
  if (bareIdx >= 0) {
    await prisma.contract.update({
      where: { id: sameDay[bareIdx].id },
      data: { code: `${base}-01` },
    });
  }

  let maxN = bareIdx >= 0 ? 1 : 0;
  for (const c of sameDay) {
    if (c.code === base) continue;
    const n = Number(c.code.slice(prefix.length));
    if (Number.isFinite(n) && n > maxN) maxN = n;
  }
  return `${base}-${pad(maxN + 1, 2)}`;
}

// NB: invoice.code has @unique GLOBALLY (not per-building), so we must scan
// the whole table for the prefix — not just this building — to avoid two
// buildings minting the same HD-YYMM-001 code in parallel.
export async function nextInvoiceCode(buildingId: string, month: number, year: number): Promise<string> {
  void buildingId;
  const ym = `${String(year).slice(-2)}${pad(month, 2)}`;
  const prefix = `HD-${ym}-`;
  const matches = await prisma.invoice.findMany({
    where: { code: { startsWith: prefix } },
    select: { code: true },
  });
  let maxN = 0;
  for (const { code } of matches) {
    const n = Number(code.slice(prefix.length));
    if (Number.isFinite(n) && n > maxN) maxN = n;
  }
  return `${prefix}${pad(maxN + 1)}`;
}

export async function nextTransactionCode(buildingId: string, type: "INCOME" | "EXPENSE"): Promise<string> {
  const ym = ymPart();
  const prefix = `${type === "INCOME" ? "PT" : "PC"}-${ym}-`;
  const last = await prisma.transaction.findFirst({
    where: { buildingId, code: { startsWith: prefix } },
    orderBy: { code: "desc" },
  });
  const lastN = last ? parseInt(last.code.slice(prefix.length), 10) : 0;
  return `${prefix}${pad(lastN + 1)}`;
}
