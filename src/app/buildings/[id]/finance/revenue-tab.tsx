import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatVND } from "@/lib/utils";
import { MonthYearFilter } from "./month-year-filter";

/**
 * Doanh thu = mỗi khách 1 dòng cho tháng đó.
 * Phải thu  = tổng totalAmount của các invoice thuộc tháng đó cho khách
 * Đã thu    = tổng paidAmount tương ứng
 * Số dư đầu = (số dư cuối tháng trước) hoặc OpeningBalance(CUSTOMER_REVENUE) cho tháng hiện tại
 * Số dư cuối = số dư đầu + phải thu - đã thu
 */
export async function RevenueTab({
  buildingId, month, year,
}: {
  buildingId: string;
  month: number;
  year: number;
}) {
  // Get all customers that had any invoice in this building
  const invoicesThisMonth = await prisma.invoice.findMany({
    where: { buildingId, month, year, status: { not: "CANCELLED" } },
    include: {
      contract: {
        include: {
          room: true,
          customers: { where: { isPrimary: true }, include: { customer: true } },
        },
      },
    },
  });

  // Compute opening balance per primary-customer = previous month's closing
  // For simplicity at the row level: opening = OpeningBalance(month, year) if exists, else 0 (Phase 5 will add full carry-forward)
  const customerIds = invoicesThisMonth
    .map((i) => i.contract.customers[0]?.customer.id)
    .filter(Boolean) as string[];
  const openings = await prisma.openingBalance.findMany({
    where: {
      buildingId,
      kind: "CUSTOMER_REVENUE",
      customerId: { in: customerIds },
      asOfMonth: month,
      asOfYear: year,
    },
  });
  const openingMap = new Map(openings.map((o) => [o.customerId, o.amount]));

  // Aggregate per customer
  const rows = new Map<string, {
    customerId: string;
    name: string;
    rooms: string[];
    due: bigint;
    paid: bigint;
    opening: bigint;
  }>();
  for (const inv of invoicesThisMonth) {
    const cust = inv.contract.customers[0]?.customer;
    if (!cust) continue;
    const cur = rows.get(cust.id) ?? {
      customerId: cust.id,
      name: cust.fullName || cust.companyName || "—",
      rooms: [],
      due: 0n,
      paid: 0n,
      opening: openingMap.get(cust.id) ?? 0n,
    };
    cur.due += inv.totalAmount;
    cur.paid += inv.paidAmount;
    if (!cur.rooms.includes(inv.contract.room.number)) cur.rooms.push(inv.contract.room.number);
    rows.set(cust.id, cur);
  }
  const data = Array.from(rows.values()).sort((a, b) => a.name.localeCompare(b.name));

  const totalOpen = data.reduce((s, r) => s + r.opening, 0n);
  const totalDue = data.reduce((s, r) => s + r.due, 0n);
  const totalPaid = data.reduce((s, r) => s + r.paid, 0n);
  const totalClose = totalOpen + totalDue - totalPaid;

  return (
    <div className="space-y-4">
      <MonthYearFilter buildingId={buildingId} month={month} year={year} tab="revenue" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MiniStat label="Số dư đầu" value={formatVND(totalOpen)} />
        <MiniStat label="Phải thu" value={formatVND(totalDue)} />
        <MiniStat label="Đã thu" value={formatVND(totalPaid)} positive />
        <MiniStat label="Số dư cuối" value={formatVND(totalClose)} bold />
      </div>

      <Card>
        <CardHeader><CardTitle>Sổ Thu T{month}/{year}</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                <th className="px-4 py-2 text-left">STT</th>
                <th className="px-4 py-2 text-left">Phòng</th>
                <th className="px-4 py-2 text-left">Tên khách</th>
                <th className="px-4 py-2 text-right">Số dư đầu</th>
                <th className="px-4 py-2 text-right">Phải thu</th>
                <th className="px-4 py-2 text-right">Đã thu</th>
                <th className="px-4 py-2 text-right">Số dư cuối</th>
              </tr>
            </thead>
            <tbody>
              {data.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-6 text-center text-slate-500">Chưa có dữ liệu</td></tr>
              )}
              {data.map((r, i) => {
                const close = r.opening + r.due - r.paid;
                return (
                  <tr key={r.customerId} className="border-t hover:bg-slate-50">
                    <td className="px-4 py-2.5">{i + 1}</td>
                    <td className="px-4 py-2.5">{r.rooms.join(", ")}</td>
                    <td className="px-4 py-2.5 font-medium">{r.name}</td>
                    <td className="px-4 py-2.5 text-right">{formatVND(r.opening)}</td>
                    <td className="px-4 py-2.5 text-right">{formatVND(r.due)}</td>
                    <td className="px-4 py-2.5 text-right text-emerald-700">{formatVND(r.paid)}</td>
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

function MiniStat({ label, value, positive, bold }: { label: string; value: string; positive?: boolean; bold?: boolean }) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="text-[11px] text-slate-500">{label}</div>
        <div className={`${bold ? "text-lg" : "text-base"} font-bold mt-0.5 ${positive ? "text-emerald-600" : ""}`}>{value}</div>
      </CardContent>
    </Card>
  );
}
