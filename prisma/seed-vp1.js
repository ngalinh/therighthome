// One-off seed: nhập dữ liệu khách + hợp đồng cho toà "VP 1 - Lê Trung Nghĩa".
// Idempotent: skip phòng đã có HĐ ACTIVE. Tự tạo building + room nếu chưa có.
// Chạy trên server:
//   docker compose exec app node prisma/seed-vp1.js

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const BUILDING_NAME = "30 Lê Trung Nghĩa";
const BUILDING_ADDRESS = "30 Lê Trung Nghĩa";

const CONTRACTS = [
  {
    room: "Lầu 1",
    area: 75,
    customerType: "COMPANY",
    companyName: "CÔNG TY TNHH MARKERS VINA",
    contactName: "Ông Seo Donghoon",
    contactRole: "Tổng giám đốc",
    phone: "035.624.4074",
    email: "wowoopshcm@gmail.com",
    monthlyRent: 23_000_000,
    cyclicRent: 23_000_000, // Tiền thuê trả hàng kỳ
    deposit: 40_000_000,
    vatRate: 0.1,
    startDate: "2024-03-01",
    endDate: "2027-02-28",
    paymentDay: 1,
    yearlyRents: [22_000_000, 23_000_000, 23_000_000],
    notes:
      "Diện tích: 75m². Trả hàng tháng 23tr. Giữ chìa khoá 2 toilet lầu 1.\n" +
      "Lịch sử giá thuê: 1/3/2024-28/2/2025: 22tr/tháng; 1/3/2025-28/2/2026: 23tr/tháng; 1/3/2026-28/2/2027: 23tr/tháng.",
  },
  {
    room: "Lầu 2",
    area: 90,
    customerType: "COMPANY",
    companyName: "Công ty TNHH Thiết bị Tat Hong",
    contactName: "Ông Chua Khong Hua",
    contactRole: "Giám Đốc",
    phone: "028 3811 0910",
    secondaryContact: "c.Hiếu",
    secondaryPhone: "090 232 9566",
    email: "hieunguyen.theq@tathong.com",
    monthlyRent: 27_500_000,
    cyclicRent: 27_500_000,
    deposit: 55_000_000,
    vatRate: 0.1,
    startDate: "2022-04-01",
    endDate: "2027-03-31",
    paymentDay: 15,
    yearlyRents: [25_300_000, 27_500_000, 27_500_000, 27_500_000, 28_500_000],
    notes:
      "Diện tích: 90m². Trả hàng tháng 27.5tr. Liên hệ thay (c.Hiếu): 090 232 9566.\n" +
      "Lịch sử giá thuê: 1/4/2022-31/3/2023: 25.300.000đ/tháng; 1/4/2023-31/3/2026: 27.500.000đ/tháng; 1/4/2026-31/3/2027: 28.500.000đ/tháng.",
  },
  {
    room: "P301",
    area: 35,
    customerType: "INDIVIDUAL",
    fullName: "Ông Bùi Minh Trí",
    phone: "0978 117 179",
    secondaryPhone: "0902167636",
    email: "minhtrilawyer@gmail.com",
    secondaryEmail: "luatsuphanduchieu@gmail.com",
    monthlyRent: 9_000_000,
    cyclicRent: 9_000_000,
    deposit: 15_000_000,
    vatRate: 0,
    startDate: "2022-09-05",
    endDate: "2026-09-04",
    paymentDay: 5,
    yearlyRents: [],
    notes:
      "Diện tích: 35m². Trả hàng tháng 9tr (chưa thuế).\n" +
      "SĐT phụ: 0902167636. Email phụ: luatsuphanduchieu@gmail.com.\n" +
      "Lịch sử giá thuê: 5/9/2024-4/9/2025: 8.700.000đ/tháng chưa thuế (không lấy hoá đơn); 5/9/2025-4/9/2026: 9.000.000đ/tháng chưa thuế.",
  },
  {
    room: "P302",
    area: 50,
    customerType: "INDIVIDUAL",
    fullName: "Ông Vũ Xuân Tiệp",
    email: "info.tiffanyvn@gmail.com",
    monthlyRent: 11_500_000,
    cyclicRent: 11_500_000,
    deposit: 22_000_000,
    vatRate: 0,
    startDate: "2024-04-15",
    endDate: "2026-04-14",
    paymentDay: 15,
    yearlyRents: [11_000_000, 11_500_000],
    notes:
      "Diện tích: 50m². Trả hàng tháng 11.5tr (chưa thuế).\n" +
      "Lịch sử giá thuê: 15/4/2024-14/4/2025: 11.000.000đ/tháng chưa thuế, miễn phí 4 xe (tính phí từ xe thứ 5); 15/4/2025-14/4/2026: 11.500.000đ/tháng chưa thuế, KO miễn phí xe.",
  },
  {
    room: "Lầu 5",
    area: 90,
    customerType: "COMPANY",
    companyName: "CÔNG TY TNHH MARKERS VINA",
    contactName: "Ông Seo Donghoon",
    contactRole: "Giám đốc",
    phone: "035.624.4074",
    email: "wowoopshcm@gmail.com",
    monthlyRent: 25_300_000,
    cyclicRent: 25_300_000,
    deposit: 46_000_000,
    vatRate: 0.1,
    startDate: "2025-12-01",
    endDate: "2026-11-30",
    paymentDay: 1,
    yearlyRents: [],
    notes:
      "Diện tích: 90m². Trả hàng tháng 25.3tr.\n" +
      "Cùng khách hàng với Lầu 1.\n" +
      "Lịch sử giá thuê: 1/12/2025-30/11/2026: 25.300.000đ/tháng.",
  },
  {
    room: "Lầu 6",
    area: 90,
    customerType: "COMPANY",
    companyName: "Công ty TNHH ERGOLIFE",
    contactName: "Ông Nguyễn Thanh Luận",
    contactRole: "Giám đốc",
    phone: "091 8730 438",
    secondaryPhone: "0918730438",
    email: "Luan.nguyen@ergolife.vn",
    monthlyRent: 21_000_000,
    cyclicRent: 21_000_000,
    deposit: 60_000_000,
    vatRate: 0.1,
    startDate: "2025-11-18",
    endDate: "2026-11-17",
    paymentDay: 18,
    yearlyRents: [],
    notes:
      "Diện tích: 90m². Trả hàng tháng 21tr. Khách hàng lâu năm (5 năm).\n" +
      "Lịch sử giá thuê: 18/11/2021-17/11/2022: 20tr/tháng; 18/11/2022-17/11/2023: 21tr/tháng; 18/11/2023-17/11/2024: 21tr/tháng; 18/11/2024-17/11/2025: 21tr/tháng; 18/11/2025-17/11/2026: 21tr/tháng.",
  },
  {
    // Khách không có phòng cụ thể (quảng cáo/biển hiệu/...)
    room: "Quảng cáo",
    area: null,
    customerType: "COMPANY",
    companyName: "CÔNG TY CỔ PHẦN TRUYỀN THÔNG TẬP TRUNG MẶT TRỜI VÀNG",
    email: "trongnghia@focusmedia.vn",
    monthlyRent: 1_166_667,
    cyclicRent: 3_500_000, // Trả 3 tháng/lần
    deposit: 0,
    vatRate: 0.1,
    startDate: "2024-09-01",
    endDate: "2026-08-31",
    paymentDay: 1, // không có hạn cụ thể trong ảnh, mặc định ngày 1
    yearlyRents: [],
    notes:
      "Không gắn với phòng cụ thể (vd dịch vụ quảng cáo/biển hiệu).\n" +
      "Trả 3 tháng/kỳ: 3.500.000đ/kỳ (≈1.166.667đ/tháng). VAT có.",
  },
];

function pad(n, w = 3) { return String(n).padStart(w, "0"); }

async function nextContractCode(buildingId, startDate, buildingType) {
  const d = new Date(startDate);
  const dd = pad(d.getDate(), 2);
  const mm = pad(d.getMonth() + 1, 2);
  const yy = String(d.getFullYear()).slice(-2);
  const prefix = `${buildingType}-${dd}${mm}${yy}-`;
  const last = await prisma.contract.findFirst({
    where: { code: { startsWith: prefix } },
    orderBy: { code: "desc" },
  });
  const n = last ? parseInt(last.code.slice(prefix.length), 10) : 0;
  return `${prefix}${pad(n + 1)}`;
}

function monthsBetween(start, end) {
  const s = new Date(start);
  const e = new Date(end);
  return (
    (e.getFullYear() - s.getFullYear()) * 12 +
    (e.getMonth() - s.getMonth()) +
    (e.getDate() >= s.getDate() ? 1 : 0)
  );
}

async function main() {
  // Tự tạo building nếu chưa có (in case user xoá rồi, hoặc fresh install).
  let building = await prisma.building.findFirst({
    where: { name: BUILDING_NAME },
    include: { setting: true },
  });
  if (!building) {
    building = await prisma.building.create({
      data: {
        name: BUILDING_NAME,
        address: BUILDING_ADDRESS,
        type: "VP",
        setting: {
          create: {
            electricityPricePerKwh: BigInt(3500),
            parkingFeePerVehicle: BigInt(200000),
            serviceFeeAmount: BigInt(0),
          },
        },
      },
      include: { setting: true },
    });
    console.log(`✅ Tạo building: ${BUILDING_NAME}`);
  }
  const buildingId = building.id;
  // Use building setting as default for elec/parking (not hardcoded 3500/0)
  const defaultElecPrice = building.setting?.electricityPricePerKwh ?? BigInt(3500);
  const defaultParkingFee = building.setting?.parkingFeePerVehicle ?? BigInt(0);
  console.log(`Building: ${BUILDING_NAME} (${buildingId})`);
  console.log(`Default electricity: ${defaultElecPrice}đ/kWh, parking: ${defaultParkingFee}đ/xe\n`);

  for (const c of CONTRACTS) {
    const room = await prisma.room.upsert({
      where: { buildingId_number: { buildingId, number: c.room } },
      create: { buildingId, number: c.room, status: "OCCUPIED", area: c.area ?? null },
      update: { status: "OCCUPIED", area: c.area ?? undefined },
    });

    // Check for ANY contract (not just ACTIVE) with the same room + startDate.
    // Previously this only checked ACTIVE which meant the worker auto-expiring
    // a past contract caused seed-vp1 to recreate it on every container start.
    const existing = await prisma.contract.findFirst({
      where: { roomId: room.id, startDate: new Date(c.startDate) },
    });
    if (existing) {
      console.log(`⏭  ${c.room.padEnd(10)} đã có HĐ (${existing.code}, ${existing.status}), skip`);
      continue;
    }

    const customerData =
      c.customerType === "COMPANY"
        ? {
            buildingId,
            type: "COMPANY",
            companyName: c.companyName,
            fullName: c.contactName ?? null,
            phone: c.phone ?? null,
            email: c.email ?? null,
            notes: [
              c.contactRole && `Chức vụ: ${c.contactRole}`,
              c.secondaryContact && c.secondaryPhone && `Liên hệ phụ: ${c.secondaryContact} - ${c.secondaryPhone}`,
              !c.secondaryContact && c.secondaryPhone && `SĐT phụ: ${c.secondaryPhone}`,
            ].filter(Boolean).join(". ") || null,
          }
        : {
            buildingId,
            type: "INDIVIDUAL",
            fullName: c.fullName,
            phone: c.phone ?? null,
            email: c.email ?? null,
            notes: [
              c.secondaryPhone && `SĐT phụ: ${c.secondaryPhone}`,
              c.secondaryEmail && `Email phụ: ${c.secondaryEmail}`,
            ].filter(Boolean).join(". ") || null,
          };

    const customer = await prisma.customer.create({ data: customerData });

    const code = await nextContractCode(buildingId, c.startDate, building.type);
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
        electricityPricePerKwh: defaultElecPrice,
        parkingCount: 0,
        parkingFeePerVehicle: defaultParkingFee,
        serviceFeeAmount: BigInt(0),
        status: "ACTIVE",
        notes: c.notes,
        customers: {
          create: { customerId: customer.id, isPrimary: true, orderIdx: 0 },
        },
        ...(c.yearlyRents.length > 0
          ? {
              yearlyRents: {
                create: c.yearlyRents.map((rent, i) => ({
                  yearIndex: i + 1,
                  rent: BigInt(rent),
                })),
              },
            }
          : {}),
      },
    });

    const label = c.customerType === "COMPANY" ? c.companyName : c.fullName;
    console.log(`✅ ${c.room.padEnd(10)} ${code}  ${label}`);
  }

  console.log("\nSeed VP 1 hoàn tất.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
