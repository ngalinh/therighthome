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
    EXPENSE: ["Lương nhân viên", "Sửa chữa", "Vệ sinh", "Điện nước toà", "Internet", "Bảo vệ", "Vật tư", "Khác"],
  },
  VP: {
    INCOME: ["Tiền thuê VP", "Tiền điện", "Phí gửi xe", "Phí dịch vụ", "Phí làm ngoài giờ", "Tiền cọc mất", "Khác"],
    EXPENSE: ["Lương nhân viên", "Sửa chữa", "Vệ sinh", "Điện nước toà", "Internet", "Bảo vệ", "Vật tư", "Khác"],
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
