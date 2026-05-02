import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatVND } from "@/lib/utils";
import { MonthYearFilter } from "./month-year-filter";

/**
 * Công nợ = đối với mỗi đối tượng (party / NCC), trong tháng đã có expense nào.
 * Phải trả = tổng amount EXPENSE chưa được "trả" (giả định = amount của giao dịch trong tháng đó)
 * Đã trả   = ... (đơn giản, giả định toàn bộ EXPENSE = đã trả nếu không tracking riêng)
 *
 * Vì hệ thống hiện chỉ track 1 ledger giao dịch, mặc định mỗi expense vừa là "phát sinh" vừa là "trả".
 * Người dùng có thể tạo phiếu chi với amount<thực để biểu diễn "phải trả" còn nợ.
 *
 * Cách diễn giải đơn giản:
 * - Phải trả = sum amount của tất cả EXPENSE trong tháng cho party đó
 * - Đã trả  = sum amount của EXPENSE trong tháng dùng PTTT là tiền mặt/CK (tức đã chi)
 * Số dư đầu = OpeningBalance(PARTY_DEBT)
 *
 * Cho đơn giản v1: cả 2 cột bằng nhau, người dùng tự nhập opening + thêm phiếu khi muốn ghi nợ
 */
export async function DebtTab({
  buildingId, month, year,
}: {
  buildingId: string;
  month: number;
  year: number;
}) {
  const expenses = await prisma.transaction.findMany({
    where: { buildingId, accountingYear: year, accountingMonth: month, type: "EXPENSE" },
    include: { party: true, customer: true, paymentMethod: true },
  });

  const partyIds = Array.from(new Set(expenses.map((e) => e.partyId).filter(Boolean))) as string[];
  const openings = await prisma.openingBalance.findMany({
    where: { buildingId, kind: "PARTY_DEBT", partyId: { in: partyIds }, asOfMonth: month, asOfYear: year },
  });
  const openingMap = new Map(openings.map((o) => [o.partyId, o.amount]));

  const rows = new Map<string, {
    key: string; name: string; opening: bigint; payable: bigint; paid: bigint; details: string[];
  }>();
  for (const e of expenses) {
    const key = e.partyId ?? "_unassigned";
    const name = e.party?.name ?? "(chưa gán đối tượng)";
    const cur = rows.get(key) ?? {
      key, name,
      opening: openingMap.get(e.partyId ?? "") ?? 0n,
      payable: 0n, paid: 0n, details: [],
    };
    cur.payable += e.amount;
    cur.paid += e.amount;
    cur.details.push(e.content);
    rows.set(key, cur);
  }
  const data = Array.from(rows.values()).sort((a, b) => a.name.localeCompare(b.name));

  const totalOpen = data.reduce((s, r) => s + r.opening, 0n);
  const totalDue = data.reduce((s, r) => s + r.payable, 0n);
  const totalPaid = data.reduce((s, r) => s + r.paid, 0n);
  const totalClose = totalOpen + totalDue - totalPaid;

  return (
    <div className="space-y-4">
      <MonthYearFilter buildingId={buildingId} month={month} year={year} tab="debt" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Số dư đầu" value={formatVND(totalOpen)} />
        <Stat label="Phải trả" value={formatVND(totalDue)} />
        <Stat label="Đã trả" value={formatVND(totalPaid)} />
        <Stat label="Số dư cuối" value={formatVND(totalClose)} bold />
      </div>

      <Card>
        <CardHeader><CardTitle>Sổ Chi T{month}/{year}</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                <th className="px-4 py-2 text-left">STT</th>
                <th className="px-4 py-2 text-left">Đối tượng</th>
                <th className="px-4 py-2 text-left">Nội dung</th>
                <th className="px-4 py-2 text-right">Số dư đầu</th>
                <th className="px-4 py-2 text-right">Phải trả</th>
                <th className="px-4 py-2 text-right">Đã trả</th>
                <th className="px-4 py-2 text-right">Số dư cuối</th>
              </tr>
            </thead>
            <tbody>
              {data.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-6 text-center text-slate-500">Chưa có dữ liệu</td></tr>
              )}
              {data.map((r, i) => {
                const close = r.opening + r.payable - r.paid;
                return (
                  <tr key={r.key} className="border-t hover:bg-slate-50">
                    <td className="px-4 py-2.5">{i + 1}</td>
                    <td className="px-4 py-2.5 font-medium">{r.name}</td>
                    <td className="px-4 py-2.5 text-xs text-slate-600">{r.details.slice(0, 2).join(", ")}{r.details.length > 2 ? `, +${r.details.length - 2}` : ""}</td>
                    <td className="px-4 py-2.5 text-right">{formatVND(r.opening)}</td>
                    <td className="px-4 py-2.5 text-right">{formatVND(r.payable)}</td>
                    <td className="px-4 py-2.5 text-right">{formatVND(r.paid)}</td>
                    <td className={`px-4 py-2.5 text-right font-semibold ${close > 0n ? "text-rose-600" : ""}`}>
                      {formatVND(close)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="text-[11px] text-slate-500">{label}</div>
        <div className={`${bold ? "text-lg" : "text-base"} font-bold mt-0.5`}>{value}</div>
      </CardContent>
    </Card>
  );
}
