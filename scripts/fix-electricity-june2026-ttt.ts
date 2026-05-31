/**
 * Tính lại tiền điện tháng 6/2026 cho nhà 45/10 Trần Thái Tông theo giá 4.000đ/kWh.
 * Chỉ cập nhật hoá đơn tự động (isManual = false) có electricityFee > 0.
 *
 * Run: npx tsx scripts/fix-electricity-june2026-ttt.ts
 * Thêm --apply để thực sự ghi vào DB (mặc định chỉ dry-run).
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const NEW_PRICE = 4000n;
const apply = process.argv.includes("--apply");

async function main() {
  const building = await prisma.building.findFirst({
    where: { name: { contains: "Trần Thái Tông" } },
    select: { id: true, name: true },
  });
  if (!building) { console.error("Không tìm thấy toà nhà Trần Thái Tông"); process.exit(1); }
  console.log(`Toà nhà: ${building.name} (${building.id})`);

  const invoices = await prisma.invoice.findMany({
    where: { buildingId: building.id, month: 6, year: 2026, isManual: false, electricityFee: { gt: 0n } },
    include: { electricityLines: true },
  });
  console.log(`Tìm thấy ${invoices.length} hoá đơn cần cập nhật\n`);

  for (const inv of invoices) {
    let newElecFee: bigint;

    if (inv.electricityLines.length > 0) {
      // Multi-room
      newElecFee = inv.electricityLines.reduce((sum, line) => {
        const kwh = BigInt((line.end ?? 0) - (line.start ?? 0));
        return sum + kwh * NEW_PRICE;
      }, 0n);
    } else {
      const kwh = BigInt((inv.electricityEnd ?? 0) - (inv.electricityStart ?? 0));
      newElecFee = kwh * NEW_PRICE;
    }

    const diff = newElecFee - inv.electricityFee;
    const newTotal = inv.totalAmount + diff;

    console.log(`  ${inv.code} | điện cũ: ${inv.electricityFee} → mới: ${newElecFee} | tổng: ${inv.totalAmount} → ${newTotal}`);

    if (apply) {
      await prisma.invoice.update({
        where: { id: inv.id },
        data: { electricityFee: newElecFee, electricityPricePerKwh: NEW_PRICE, totalAmount: newTotal },
      });
    }
  }

  if (apply) {
    console.log("\nĐã cập nhật xong.");
  } else {
    console.log("\n[DRY RUN] Thêm --apply để ghi vào DB.");
  }
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
