import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatVND } from "@/lib/utils";
import { MonthYearFilter } from "./month-year-filter";

/**
 * KQKD = chỉ tính giao dịch tick countInBR.
 * Lợi nhuận = Tổng thu - Tổng chi.
 */
export async function PnLTab({
  buildingId, month, year,
}: {
  buildingId: string;
  month: number;
  year: number;
}) {
  const transactions = await prisma.transaction.findMany({
    where: {
      buildingId,
      accountingYear: year,
      accountingMonth: month,
      countInBR: true,
    },
    include: { category: true },
  });

  // Group by category type+name
  const incomeByCat = new Map<string, bigint>();
  const expenseByCat = new Map<string, bigint>();
  for (const t of transactions) {
    const key = t.category?.name ?? "Khác";
    const map = t.type === "INCOME" ? incomeByCat : expenseByCat;
    map.set(key, (map.get(key) ?? 0n) + t.amount);
  }
  const incomeRows = Array.from(incomeByCat.entries()).sort((a, b) => Number(b[1] - a[1]));
  const expenseRows = Array.from(expenseByCat.entries()).sort((a, b) => Number(b[1] - a[1]));
  const totalIn = incomeRows.reduce((s, [, v]) => s + v, 0n);
  const totalOut = expenseRows.reduce((s, [, v]) => s + v, 0n);
  const profit = totalIn - totalOut;

  return (
    <div className="space-y-4">
      <MonthYearFilter buildingId={buildingId} month={month} year={year} tab="pnl" />

      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-slate-500">Tổng thu (BCKD)</div>
            <div className="text-xl font-bold text-emerald-600 mt-1">{formatVND(totalIn)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-slate-500">Tổng chi (BCKD)</div>
            <div className="text-xl font-bold text-rose-600 mt-1">{formatVND(totalOut)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-slate-500">Lợi nhuận</div>
            <div className={`text-xl font-bold mt-1 ${profit >= 0n ? "text-emerald-600" : "text-rose-600"}`}>
              {formatVND(profit)}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle>Doanh thu theo loại</CardTitle></CardHeader>
          <CardContent className="p-0">
            <BreakdownTable rows={incomeRows} total={totalIn} accent="emerald" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Chi phí theo loại</CardTitle></CardHeader>
          <CardContent className="p-0">
            <BreakdownTable rows={expenseRows} total={totalOut} accent="rose" />
          </CardContent>
        </Card>
      </div>

      <p className="text-xs text-slate-500 text-center">
        Chỉ những giao dịch có tick "Hạch toán vào BCKD" mới được tính.
      </p>
    </div>
  );
}

function BreakdownTable({ rows, total, accent }: { rows: [string, bigint][]; total: bigint; accent: "emerald" | "rose" }) {
  if (rows.length === 0) {
    return <p className="px-4 py-6 text-center text-sm text-slate-500">Không có dữ liệu</p>;
  }
  return (
    <table className="w-full text-sm">
      <tbody>
        {rows.map(([name, amt]) => {
          const pct = total > 0n ? Number(amt * 1000n / total) / 10 : 0;
          return (
            <tr key={name} className="border-b last:border-0">
              <td className="px-4 py-2.5">
                <div className="flex justify-between items-baseline mb-1">
                  <span className="font-medium">{name}</span>
                  <span className="font-semibold">{formatVND(amt)}</span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className={`h-full ${accent === "emerald" ? "bg-emerald-500" : "bg-rose-500"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">{pct.toFixed(1)}%</div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
