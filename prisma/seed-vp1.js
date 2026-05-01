// One-off seed: nhập dữ liệu khách + hợp đồng cho toà "VP 1 - Lê Trung Nghĩa".
// Chạy trên server SAU KHI deploy:
//   docker compose exec app node prisma/seed-vp1.js
// Idempotent: skip room đã có hợp đồng ACTIVE.

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const BUILDING_NAME = "VP 1 - Lê Trung Nghĩa";

const CONTRACTS = [
  {
    room: "Lầu 1",
    customerType: "COMPANY",
    companyName: "CÔNG TY TNHH MARKERS VINA",
    contactName: "Ông Seo Donghoon",
    contactRole: "Tổng giám đốc",
    phone: "035.624.4074",
    email: "wowoopshcm@gmail.com",
    monthlyRent: 23_000_000,
    deposit: 40_000_000,
    vatRate: 0.1,
    startDate: "2024-03-01",
    endDate: "2027-02-28",
    paymentDay: 1,
    yearlyRents: [22_000_000, 23_000_000, 23_000_000],
    notes: "75m2. Giữ chìa khoá 2 toilet lầu 1. Lịch sử: 1/3/2024-28/2/2025: 22tr/tháng; 1/3/2025-28/2/2027: 23tr/tháng",
  },
  {
    room: "Lầu 2",
    customerType: "COMPANY",
    companyName: "Công ty TNHH Thiết bị Tat Hong",
    contactName: "Ông Chua Khong Hua",
    contactRole: "Giám Đốc",
    phone: "028 3811 0910",
    secondaryPhone: "c.Hiếu: 090 232 9566",
    email: "hieunguyen.theq@tathong.com",
    monthlyRent: 27_500_000,
    deposit: 55_000_000,
    vatRate: 0.1,
    startDate: "2022-04-01",
    endDate: "2027-03-31",
    paymentDay: 15,
    yearlyRents: [25_300_000, 27_500_000, 27_500_000, 27_500_000, 28_500_000],
    notes: "90m2. Lịch sử: 1/4/22-31/3/23: 25.3tr; 1/4/23-31/3/26: 27.5tr; 1/4/26-31/3/27: 28.5tr. Liên hệ thay: c.Hiếu 090 232 9566",
  },
  {
    room: "P301",
    customerType: "INDIVIDUAL",
    fullName: "Ông Bùi Minh Trí",
    phone: "0978 117 179",
    secondaryPhone: "0902167636",
    email: "minhtrilawyer@gmail.com",
    secondaryEmail: "luatsuphanduchieu@gmail.com",
    monthlyRent: 9_000_000,
    deposit: 15_000_000,
    vatRate: 0,
    startDate: "2022-09-05",
    endDate: "2026-09-04",
    paymentDay: 5,
    yearlyRents: [],
    notes: "35m2. Lịch sử: 5/9/24: 8.7tr/tháng chưa thuế (ko lấy hoá đơn); 5/9/25: 9tr/tháng chưa thuế. Email phụ: luatsuphanduchieu@gmail.com. SĐT phụ: 0902167636",
  },
  {
    room: "P302",
    customerType: "INDIVIDUAL",
    fullName: "Ông Vũ Xuân Tiệp",
    email: "info.tiffanyvn@gmail.com",
    monthlyRent: 11_500_000,
    deposit: 22_000_000,
    vatRate: 0,
    startDate: "2024-04-15",
    endDate: "2026-04-14",
    paymentDay: 15,
    yearlyRents: [11_000_000, 11_500_000],
    notes: "50m2. 15/4/24-14/4/25: 11tr/tháng chưa thuế, miễn phí 4 xe (tính phí từ xe thứ 5). 15/4/25-14/4/26: 11.5tr/tháng chưa thuế, ko miễn phí xe",
  },
  {
    room: "Lầu 5",
    customerType: "COMPANY",
    companyName: "CÔNG TY TNHH MARKERS VINA",
    contactName: "Ông Seo Donghoon",
    contactRole: "Giám đốc",
    phone: "035.624.4074",
    email: "wowoopshcm@gmail.com",
    monthlyRent: 25_300_000,
    deposit: 46_000_000,
    vatRate: 0.1,
    startDate: "2025-12-01",
    endDate: "2026-11-30",
    paymentDay: 1,
    yearlyRents: [],
    notes: "90m2. 01/12/2025-30/11/2026: 25.3tr/tháng. Cùng KH với Lầu 1.",
  },
  {
    room: "Lầu 6",
    customerType: "COMPANY",
    companyName: "Công ty TNHH ERGOLIFE",
    contactName: "Ông Nguyễn Thanh Luận",
    contactRole: "Giám đốc",
    phone: "091 8730 438",
    secondaryPhone: "0918730438",
    email: "Luan.nguyen@ergolife.vn",
    monthlyRent: 21_000_000,
    deposit: 60_000_000,
    vatRate: 0.1,
    startDate: "2025-11-18",
    endDate: "2026-11-17",
    paymentDay: 18,
    yearlyRents: [],
    notes: "90m2. KH lâu năm 5 năm. Lịch sử: 18/11/21-17/11/22: 20tr; 18/11/22 trở đi: 21tr/tháng",
  },
];

function pad(n, w = 3) { return String(n).padStart(w, "0"); }

async function nextContractCode(buildingId, startDate) {
  const d = new Date(startDate);
  const ym = `${String(d.getFullYear()).slice(-2)}${pad(d.getMonth() + 1, 2)}`;
  const prefix = `HD-${ym}-`;
  const last = await prisma.contract.findFirst({
    where: { buildingId, code: { startsWith: prefix } },
    orderBy: { code: "desc" },
  });
  const n = last ? parseInt(last.code.slice(prefix.length), 10) : 0;
  return `${prefix}${pad(n + 1)}`;
}

function monthsBetween(start, end) {
  const s = new Date(start);
  const e = new Date(end);
  return (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth()) + (e.getDate() >= s.getDate() ? 1 : 0);
}

async function main() {
  const building = await prisma.building.findFirst({ where: { name: BUILDING_NAME } });
  if (!building) {
    console.error(`❌ Building "${BUILDING_NAME}" not found. Run main seed first.`);
    process.exit(1);
  }
  const buildingId = building.id;
  console.log(`Building: ${BUILDING_NAME} (${buildingId})\n`);

  for (const c of CONTRACTS) {
    const room = await prisma.room.upsert({
      where: { buildingId_number: { buildingId, number: c.room } },
      create: { buildingId, number: c.room, status: "OCCUPIED" },
      update: { status: "OCCUPIED" },
    });

    const existing = await prisma.contract.findFirst({
      where: { roomId: room.id, status: "ACTIVE" },
    });
    if (existing) {
      console.log(`⏭  Phòng ${c.room}: đã có HĐ ACTIVE ${existing.code}, skip`);
      continue;
    }

    const customerData = c.customerType === "COMPANY"
      ? {
          buildingId, type: "COMPANY",
          companyName: c.companyName,
          fullName: c.contactName,
          notes: [c.contactRole && `Chức vụ: ${c.contactRole}`, c.secondaryPhone && `SĐT phụ: ${c.secondaryPhone}`].filter(Boolean).join(". ") || null,
          phone: c.phone,
          email: c.email,
        }
      : {
          buildingId, type: "INDIVIDUAL",
          fullName: c.fullName,
          phone: c.phone,
          email: c.email,
          notes: [c.secondaryPhone && `SĐT phụ: ${c.secondaryPhone}`, c.secondaryEmail && `Email phụ: ${c.secondaryEmail}`].filter(Boolean).join(". ") || null,
        };

    const customer = await prisma.customer.create({ data: customerData });

    const code = await nextContractCode(buildingId, c.startDate);
    const termMonths = monthsBetween(c.startDate, c.endDate);

    await prisma.contract.create({
      data: {
        buildingId,
        roomId: room.id,
        code,
        startDate: new Date(c.startDate),
        endDate: new Date(c.endDate),
        termMonths,
        paymentDay: c.paymentDay,
        monthlyRent: BigInt(c.monthlyRent),
        vatRate: c.vatRate,
        depositAmount: BigInt(c.deposit),
        electricityPricePerKwh: BigInt(3500),
        parkingCount: 0,
        parkingFeePerVehicle: BigInt(0),
        serviceFeeAmount: BigInt(0),
        status: "ACTIVE",
        notes: c.notes,
        customers: {
          create: { customerId: customer.id, isPrimary: true, orderIdx: 0 },
        },
        ...(c.yearlyRents.length > 0
          ? {
              yearlyRents: {
                create: c.yearlyRents.map((rent, i) => ({ yearIndex: i + 1, rent: BigInt(rent) })),
              },
            }
          : {}),
      },
    });

    const label = c.customerType === "COMPANY" ? c.companyName : c.fullName;
    console.log(`✅ ${c.room.padEnd(8)} ${code} ${label}`);
  }

  console.log("\nSeed VP 1 hoàn tất.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
