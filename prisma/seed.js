// Idempotent seed — runs on every container start.
// Uses CommonJS to avoid needing tsx in production.
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

const BUILDINGS = [
  { name: "CHDV 1 - Trần Thái Tông", address: "45/10 Trần Thái Tông", type: "CHDV" },
  { name: "CHDV 2 - Phạm Đăng Giảng", address: "62/6 Phạm Đăng Giảng", type: "CHDV" },
  { name: "CHDV 3 - Đường số 18", address: "46/57 Đường số 18", type: "CHDV" },
  { name: "VP 1 - Lê Trung Nghĩa", address: "30 Lê Trung Nghĩa", type: "VP" },
  { name: "VP 2 - Lê Trung Nghĩa", address: "60 Lê Trung Nghĩa", type: "VP" },
  { name: "VP 3 - Thép Mới", address: "51 Thép Mới", type: "VP" },
];

const TX_CATEGORIES = {
  CHDV: {
    INCOME: ["Tiền thuê phòng", "Tiền điện", "Tiền nước", "Phí gửi xe", "Phí dịch vụ", "Tiền cọc mất", "Khác"],
    EXPENSE: ["Lương nhân viên", "Sửa chữa", "Vệ sinh", "Điện nước toà", "Internet", "Bảo vệ", "Vật tư", "Phí môi giới", "Khác"],
  },
  VP: {
    INCOME: ["Tiền thuê VP", "Tiền điện", "Phí gửi xe", "Phí dịch vụ", "Phí làm ngoài giờ", "Tiền cọc mất", "Khác"],
    EXPENSE: ["Lương nhân viên", "Sửa chữa", "Vệ sinh", "Điện nước toà", "Internet", "Bảo vệ", "Vật tư", "Phí môi giới", "Khác"],
  },
};

const PAYMENT_METHODS = {
  CHDV: [
    { name: "Tiền mặt", isCash: true },
    { name: "Chuyển khoản BIDV", isCash: false },
    { name: "Chuyển khoản VCB", isCash: false },
    { name: "Momo/Zalo Pay", isCash: false },
  ],
  VP: [
    { name: "Tiền mặt", isCash: true },
    { name: "Chuyển khoản BIDV", isCash: false },
    { name: "Chuyển khoản VCB", isCash: false },
  ],
};

const PARTY_KINDS = {
  THO_SUA_CHUA: "Thợ sửa chữa",
  THO_XAY: "Thợ xây",
  DON_VE_SINH: "Dọn vệ sinh",
  BAO_VE: "Bảo vệ",
  NHA_NUOC: "Nhà nước",
  NCC_KHAC: "NCC khác",
};

async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL || "admin@therighthome.vn";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || "ChangeMe123!";

  if (!(await prisma.user.findUnique({ where: { email: adminEmail } }))) {
    await prisma.user.create({
      data: {
        email: adminEmail,
        name: "Admin",
        passwordHash: await bcrypt.hash(adminPassword, 12),
        role: "ADMIN",
      },
    });
    console.log(`Created admin: ${adminEmail} / ${adminPassword}`);
    console.log("Change this password after first login!");
  }

  // Only seed default buildings on FRESH install (no buildings, no Building DELETE
  // audit log). This prevents the seed from "resurrecting" buildings the user has
  // deliberately deleted on every container restart.
  const buildingCount = await prisma.building.count();
  const deletedBuildingsCount = await prisma.auditLog.count({
    where: { action: "DELETE", entityType: "Building" },
  });
  const isFreshInstall = buildingCount === 0 && deletedBuildingsCount === 0;
  if (isFreshInstall) {
    for (const b of BUILDINGS) {
      await prisma.building.create({
        data: {
          ...b,
          setting: {
            create: {
              electricityPricePerKwh: BigInt(3500),
              parkingFeePerVehicle: BigInt(b.type === "CHDV" ? 100000 : 200000),
              serviceFeeAmount: BigInt(0),
            },
          },
        },
      });
      console.log(`Created building: ${b.name}`);
    }
  } else {
    console.log(`Skipping building seed (count=${buildingCount}, deleted=${deletedBuildingsCount}).`);
  }

  for (const buildingType of ["CHDV", "VP"]) {
    for (const t of ["INCOME", "EXPENSE"]) {
      for (const name of TX_CATEGORIES[buildingType][t]) {
        await prisma.transactionCategory.upsert({
          where: { buildingType_name_type: { buildingType, name, type: t } },
          create: { buildingType, name, type: t },
          update: {},
        });
      }
    }
    for (const pm of PAYMENT_METHODS[buildingType]) {
      await prisma.paymentMethod.upsert({
        where: { buildingType_name: { buildingType, name: pm.name } },
        create: { buildingType, ...pm },
        update: {},
      });
    }
  }

  for (const [kind, name] of Object.entries(PARTY_KINDS)) {
    const exists = await prisma.party.findFirst({ where: { kind, name } });
    if (!exists) await prisma.party.create({ data: { kind, name } });
  }

  // One-off: dedupe contracts that were created multiple times because earlier
  // versions of seed-vp1 only checked ACTIVE status, so when a contract auto-
  // expired the next deploy re-created it. Group by (roomId, startDate, monthlyRent),
  // keep oldest, delete the rest along with any orphan customers.
  const dedupeDone = await prisma.auditLog.findFirst({
    where: { action: "DEDUPE_CONTRACTS_v1", entityType: "Contract" },
  });
  if (!dedupeDone) {
    const all = await prisma.contract.findMany({
      orderBy: { createdAt: "asc" },
      include: { customers: { select: { customerId: true } } },
    });
    const seen = new Map();
    let removed = 0;
    for (const c of all) {
      const key = `${c.roomId}|${c.startDate.toISOString()}|${c.monthlyRent}`;
      if (seen.has(key)) {
        // Duplicate — delete it. Need to clean up FKs (no cascade to invoice).
        const invoiceIds = (
          await prisma.invoice.findMany({ where: { contractId: c.id }, select: { id: true } })
        ).map((i) => i.id);
        if (invoiceIds.length > 0) {
          await prisma.transaction.updateMany({
            where: { invoiceId: { in: invoiceIds } },
            data: { invoiceId: null },
          });
          await prisma.invoice.deleteMany({ where: { contractId: c.id } });
        }
        const customerIds = c.customers.map((cc) => cc.customerId);
        await prisma.contract.delete({ where: { id: c.id } });
        // Delete orphan customers (those that were only attached to this contract)
        for (const cid of customerIds) {
          const otherCount = await prisma.contractCustomer.count({ where: { customerId: cid } });
          if (otherCount === 0) {
            await prisma.customer.delete({ where: { id: cid } }).catch(() => {});
          }
        }
        removed++;
      } else {
        seen.set(key, c);
      }
    }
    await prisma.auditLog.create({
      data: { action: "DEDUPE_CONTRACTS_v1", entityType: "Contract", after: { removed } },
    });
    if (removed > 0) console.log(`Deduped ${removed} duplicate contracts.`);
  }

  // One-off renames: address-based names are clearer when several buildings
  // share a street. Idempotent via AuditLog marker.
  const renames = [
    { from: "VP 1 - Lê Trung Nghĩa", to: "30 Lê Trung Nghĩa" },
    { from: "VP 2 - Lê Trung Nghĩa", to: "60 Lê Trung Nghĩa" },
  ];
  const renameMarker = await prisma.auditLog.findFirst({
    where: { action: "RENAME", entityType: "Buildings_v1" },
  });
  if (!renameMarker) {
    let renamedCount = 0;
    for (const r of renames) {
      const b = await prisma.building.findFirst({ where: { name: r.from } });
      if (b) {
        await prisma.building.update({ where: { id: b.id }, data: { name: r.to } });
        console.log(`Renamed building: ${r.from} → ${r.to}`);
        renamedCount++;
      }
    }
    await prisma.auditLog.create({
      data: {
        action: "RENAME",
        entityType: "Buildings_v1",
        after: { renamedCount, list: renames },
      },
    });
  }

  // One-off: migrate existing contract codes to new format <TYPE>-DDMMYY-NN.
  // Numbers are reassigned per (type, day) group ordered by createdAt for
  // stability. Idempotent via AuditLog marker.
  const codeMigDone = await prisma.auditLog.findFirst({
    where: { action: "MIGRATE_CONTRACT_CODES_v2", entityType: "Contract" },
  });
  if (!codeMigDone) {
    const allContracts = await prisma.contract.findMany({
      include: { building: { select: { type: true } } },
      orderBy: [{ startDate: "asc" }, { createdAt: "asc" }],
    });
    const fmt = (d) => {
      const z = (n) => String(n).padStart(2, "0");
      return `${z(d.getDate())}${z(d.getMonth() + 1)}${String(d.getFullYear()).slice(-2)}`;
    };
    const groups = new Map();
    for (const c of allContracts) {
      const key = `${c.building.type}-${fmt(new Date(c.startDate))}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(c);
    }
    let migrated = 0;
    // To avoid unique-constraint clashes when intermediate codes overlap between
    // the existing and new schemes, do it in two passes: first set every code to
    // a temporary unique value, then assign the final codes.
    for (const c of allContracts) {
      await prisma.contract.update({
        where: { id: c.id },
        data: { code: `__tmp_${c.id}` },
      });
    }
    for (const [prefix, list] of groups) {
      for (let i = 0; i < list.length; i++) {
        const newCode = `${prefix}-${String(i + 1).padStart(2, "0")}`;
        if (list[i].code !== newCode) {
          await prisma.contract.update({
            where: { id: list[i].id },
            data: { code: newCode },
          });
          migrated++;
        }
      }
    }
    await prisma.auditLog.create({
      data: { action: "MIGRATE_CONTRACT_CODES_v2", entityType: "Contract", after: { migrated } },
    });
    if (migrated > 0) console.log(`Migrated ${migrated} contract codes to new format.`);
  }

  // One-off: sync existing contracts' electricity/parking fees to match their
  // building's current setting. After this, defaults always come from setting.
  const feeSyncDone = await prisma.auditLog.findFirst({
    where: { action: "SYNC_CONTRACT_FEES", entityType: "Contract" },
  });
  if (!feeSyncDone) {
    const contracts = await prisma.contract.findMany({
      include: { building: { include: { setting: true } } },
    });
    let synced = 0;
    for (const c of contracts) {
      const s = c.building.setting;
      if (!s) continue;
      if (
        c.electricityPricePerKwh !== s.electricityPricePerKwh ||
        c.parkingFeePerVehicle !== s.parkingFeePerVehicle
      ) {
        await prisma.contract.update({
          where: { id: c.id },
          data: {
            electricityPricePerKwh: s.electricityPricePerKwh,
            parkingFeePerVehicle: s.parkingFeePerVehicle,
          },
        });
        synced++;
      }
    }
    await prisma.auditLog.create({
      data: { action: "SYNC_CONTRACT_FEES", entityType: "Contract", after: { synced } },
    });
    if (synced > 0) console.log(`Synced ${synced} contracts to building fee settings.`);
  }

  // One-off cleanup: remove buildings with 0 rooms (default seed leftovers
  // user explicitly wants gone). Marker via AuditLog so it only runs once.
  const cleanupDone = await prisma.auditLog.findFirst({
    where: { action: "CLEANUP", entityType: "EmptyBuildings" },
  });
  if (!cleanupDone) {
    const empty = await prisma.building.findMany({
      where: { rooms: { none: {} } },
      select: { id: true, name: true },
    });
    for (const b of empty) {
      // Building has FK relations w/o cascade (contract/invoice/transaction);
      // since the building has 0 rooms it likely also has 0 of those, but
      // guard anyway.
      const txCount = await prisma.transaction.count({ where: { buildingId: b.id } });
      const invCount = await prisma.invoice.count({ where: { buildingId: b.id } });
      const conCount = await prisma.contract.count({ where: { buildingId: b.id } });
      if (txCount + invCount + conCount === 0) {
        await prisma.building.delete({ where: { id: b.id } });
        console.log(`Cleaned up empty building: ${b.name}`);
      }
    }
    await prisma.auditLog.create({
      data: {
        action: "CLEANUP",
        entityType: "EmptyBuildings",
        after: { deletedCount: empty.length },
      },
    });
  }

  console.log("Seed complete");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
