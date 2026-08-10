/**
 * Gộp PTTT "ACB TTTL" (tạo nhầm riêng) vào PTTT "TTTL" (đã đổi thành Dùng
 * chung CHDV+VP) — chuyển toàn bộ giao dịch thu/chi và công việc bảo trì
 * đang gắn "ACB TTTL" sang "TTTL", đồng thời đổi tên nhãn số dư đầu kỳ cho
 * khớp, để Sổ quỹ tổng không bị lệch số dư.
 *
 * Run: npx tsx scripts/merge-acb-tttl-into-tttl.ts
 * Thêm --apply để thực sự ghi vào DB (mặc định chỉ dry-run).
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const apply = process.argv.includes("--apply");

const FROM_NAME = "ACB TTTL";
const TO_NAME = "TTTL";

async function main() {
  const from = await prisma.paymentMethod.findFirst({ where: { name: FROM_NAME } });
  const to = await prisma.paymentMethod.findFirst({ where: { name: TO_NAME } });
  if (!from) { console.error(`Không tìm thấy PTTT "${FROM_NAME}"`); process.exit(1); }
  if (!to) { console.error(`Không tìm thấy PTTT "${TO_NAME}"`); process.exit(1); }
  console.log(`Từ: ${from.name} (${from.id})`);
  console.log(`Sang: ${to.name} (${to.id})\n`);

  const txCount = await prisma.transaction.count({ where: { paymentMethodId: from.id } });
  const taskCount = await prisma.maintenanceTask.count({ where: { paymentMethodId: from.id } });
  const openings = await prisma.openingBalance.findMany({
    where: { kind: "CASHBOOK", paymentMethodLabel: FROM_NAME },
    select: { id: true, buildingId: true, asOfMonth: true, asOfYear: true, amount: true },
  });

  // Nếu cùng toà + cùng kỳ đã có sẵn 1 dòng số dư đầu kỳ tên "TTTL", đổi
  // nhãn dòng "ACB TTTL" sang trùng tên sẽ tạo 2 dòng đụng nhau — bỏ qua,
  // để người dùng tự đối chiếu tay.
  const conflicts: typeof openings = [];
  const safeToRename: typeof openings = [];
  for (const ob of openings) {
    const clash = await prisma.openingBalance.findFirst({
      where: { kind: "CASHBOOK", paymentMethodLabel: TO_NAME, buildingId: ob.buildingId, asOfMonth: ob.asOfMonth, asOfYear: ob.asOfYear },
    });
    (clash ? conflicts : safeToRename).push(ob);
  }

  console.log(`Giao dịch thu/chi cần chuyển: ${txCount}`);
  console.log(`Công việc bảo trì cần chuyển: ${taskCount}`);
  console.log(`Số dư đầu kỳ cần đổi nhãn "${FROM_NAME}" → "${TO_NAME}": ${safeToRename.length}`);
  for (const ob of safeToRename) {
    console.log(`  toà ${ob.buildingId} — ${ob.asOfMonth}/${ob.asOfYear}: ${ob.amount}`);
  }
  if (conflicts.length > 0) {
    console.log(`\n⚠ ${conflicts.length} dòng số dư đầu kỳ ĐỤNG với dòng "TTTL" đã có sẵn cùng toà/kỳ — KHÔNG tự đổi nhãn, cần đối chiếu tay:`);
    for (const ob of conflicts) {
      console.log(`  toà ${ob.buildingId} — ${ob.asOfMonth}/${ob.asOfYear}: ${ob.amount} (id: ${ob.id})`);
    }
  }

  if (apply) {
    await prisma.$transaction([
      prisma.transaction.updateMany({ where: { paymentMethodId: from.id }, data: { paymentMethodId: to.id } }),
      prisma.maintenanceTask.updateMany({ where: { paymentMethodId: from.id }, data: { paymentMethodId: to.id } }),
      ...safeToRename.map((ob) =>
        prisma.openingBalance.update({ where: { id: ob.id }, data: { paymentMethodLabel: TO_NAME } }),
      ),
    ]);
    console.log(`\nĐã chuyển xong. PTTT "${FROM_NAME}" (${from.id}) giờ không còn giao dịch nào — có thể xoá ở Cài đặt.`);
  } else {
    console.log("\n[DRY RUN] Thêm --apply để ghi vào DB.");
  }
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
