import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatVND, formatVNDCompact, customerDisplayName, serializeBigInt } from "@/lib/utils";
import { PnLFilter } from "./pnl-filter";
import { PnLBreakdownTable, type DetailRow } from "./pnl-breakdown-table";

/**
 * KQKD = chỉ tính giao dịch tick countInBR.
 * Lợi nhuận = Tổng thu - Tổng chi.
 *
 * Hỗ trợ lọc theo khoảng thời gian (Trong tháng / 6 tháng / 1 năm / Tất cả /
 * Tuỳ chọn). Mỗi tháng trong khoảng được hiển thị thành 1 bảng riêng.
 *
 * Với giao dịch là khoản thu hoá đơn (transaction.invoiceId != null), tách
 * tỷ lệ theo các khoản trên hoá đơn (tiền phòng, điện, nước, gửi xe, dịch
 * vụ, ngoài giờ, VAT) thay vì gộp thành "Tiền thuê phòng".
 */
export async function PnLTab({
  buildingId, range, from, to,
}: {
  buildingId: string;
  range: string;
  from: string | null;
  to: string | null;
}) {
  const now = new Date();
  let fromY: number | null = null;
  let fromM: number | null = null;
  let toY: number | null = null;
  let toM: number | null = null;

  if (range === "month") {
    fromY = toY = now.getFullYear();
    fromM = toM = now.getMonth() + 1;
  } else if (range === "6m") {
    toY = now.getFullYear();
    toM = now.getMonth() + 1;
    const start = new Date(toY, toM - 6, 1);
    fromY = start.getFullYear();
    fromM = start.getMonth() + 1;
  } else if (range === "1y") {
    toY = now.getFullYear();
    toM = now.getMonth() + 1;
    const start = new Date(toY, toM - 12, 1);
    fromY = start.getFullYear();
    fromM = start.getMonth() + 1;
  } else if (range === "custom" && from && to) {
    const f = new Date(from);
    const t = new Date(to);
    fromY = f.getFullYear();
    fromM = f.getMonth() + 1;
    toY = t.getFullYear();
    toM = t.getMonth() + 1;
  }
  // range === "all" or invalid custom → leave bounds null (no filter)

  const where: Prisma.TransactionWhereInput = { buildingId, countInBR: true };
  if (fromY != null && fromM != null && toY != null && toM != null) {
    // Build a list of (year, month) pairs in range and use OR — simpler and
    // less error-prone than nested year/month range expressions.
    const pairs: Array<{ accountingYear: number; accountingMonth: number }> = [];
    let yy = fromY, mm = fromM;
    while (yy < toY || (yy === toY && mm <= toM)) {
      pairs.push({ accountingYear: yy, accountingMonth: mm });
      mm++;
      if (mm > 12) { mm = 1; yy++; }
    }
    where.OR = pairs;
  }

  const transactions = await prisma.transaction.findMany({
    where,
    include: {
      category: { select: { name: true, type: true } },
      customer: { select: { type: true, fullName: true, companyName: true } },
      party: { select: { name: true } },
      room: { select: { number: true } },
      invoice: {
        select: {
          id: true,
          code: true,
          isManual: true,
          totalAmount: true,
          rentAmount: true,
          electricityFee: true,
          waterFee: true,
          parkingFee: true,
          serviceFee: true,
          overtimeFee: true,
          vatAmount: true,
          lineItems: {
            select: {
              amount: true,
              countInBR: true,
              category: { select: { name: true } },
            },
          },
        },
      },
    },
  });

  type CatBucket = { total: bigint; details: DetailRow[] };
  type MonthlyAgg = {
    incomeByCat: Map<string, CatBucket>;
    expenseByCat: Map<string, CatBucket>;
  };
  const byMonth = new Map<string, MonthlyAgg>();
  function bucket(y: number, m: number) {
    const key = `${y}-${String(m).padStart(2, "0")}`;
    let agg = byMonth.get(key);
    if (!agg) {
      agg = { incomeByCat: new Map(), expenseByCat: new Map() };
      byMonth.set(key, agg);
    }
    return agg;
  }
  function add(map: Map<string, CatBucket>, name: string, amount: bigint, detail: DetailRow) {
    const cur = map.get(name) ?? { total: 0n, details: [] };
    cur.total += amount;
    cur.details.push(detail);
    map.set(name, cur);
  }

  for (const t of transactions) {
    const y = t.accountingYear ?? new Date(t.date).getFullYear();
    const m = t.accountingMonth ?? new Date(t.date).getMonth() + 1;
    const agg = bucket(y, m);
    const map = t.type === "INCOME" ? agg.incomeByCat : agg.expenseByCat;
    const partyLabel = t.customer
      ? customerDisplayName(t.customer)
      : t.party?.name ?? "";

    if (t.type === "INCOME" && t.invoice && t.invoice.totalAmount > 0n) {
      const inv = t.invoice;
      // Manual invoice: split the payment proportionally across non-deposit
      // (countInBR=true) line items, grouped by their category. Deposit lines
      // are explicitly excluded from BCKD by their countInBR=false flag, which
      // also keeps the deposit per-line transaction out of `transactions`.
      const breakdown: [string, bigint][] = inv.isManual
        ? inv.lineItems
            .filter((l) => l.countInBR && l.amount > 0n)
            .map<[string, bigint]>((l) => [l.category?.name ?? "Khác", l.amount])
        : ([
            ["Tiền phòng", inv.rentAmount],
            ["Tiền điện", inv.electricityFee],
            ["Tiền nước", inv.waterFee],
            ["Phí gửi xe", inv.parkingFee],
            ["Phí dịch vụ", inv.serviceFee],
            ["Phí ngoài giờ", inv.overtimeFee],
            ["VAT", inv.vatAmount],
          ].filter(([, v]) => (v as bigint) > 0n) as [string, bigint][]);
      // Sum used for proportional allocation. For manual invoices this is the
      // BCKD-eligible portion only — for auto invoices it's the full
      // totalAmount (matches the existing behavior).
      const breakdownTotal = inv.isManual
        ? breakdown.reduce((s, [, v]) => s + v, 0n)
        : inv.totalAmount;
      if (breakdown.length > 0 && breakdownTotal > 0n) {
        let allocated = 0n;
        for (let i = 0; i < breakdown.length; i++) {
          const [name, fee] = breakdown[i];
          const amt = i === breakdown.length - 1
            ? t.amount - allocated
            : (fee * t.amount) / breakdownTotal;
          if (amt > 0n) {
            add(map, name, amt, {
              txId: t.id,
              date: t.date.toISOString(),
              amount: amt.toString(),
              content: t.content,
              partyLabel,
              roomNumber: t.room?.number ?? null,
              invoiceId: inv.id,
              invoiceCode: inv.code,
            });
            allocated += amt;
          }
        }
      } else {
        // Manual invoice with no eligible lines (e.g. deposit-only). Bucket
        // under the transaction's own category so it doesn't silently vanish.
        const key = t.category?.name ?? "Khác";
        add(map, key, t.amount, {
          txId: t.id,
          date: t.date.toISOString(),
          amount: t.amount.toString(),
          content: t.content,
          partyLabel,
          roomNumber: t.room?.number ?? null,
          invoiceId: inv.id,
          invoiceCode: inv.code,
        });
      }
    } else {
      const key = t.category?.name ?? "Khác";
      add(map, key, t.amount, {
        txId: t.id,
        date: t.date.toISOString(),
        amount: t.amount.toString(),
        content: t.content,
        partyLabel,
        roomNumber: t.room?.number ?? null,
        invoiceId: t.invoice?.id ?? null,
        invoiceCode: t.invoice?.code ?? null,
      });
    }
  }

  const monthKeys = Array.from(byMonth.keys()).sort().reverse();

  // Overall totals across the range.
  let grandIn = 0n;
  let grandOut = 0n;
  for (const k of monthKeys) {
    const agg = byMonth.get(k)!;
    for (const v of agg.incomeByCat.values()) grandIn += v.total;
    for (const v of agg.expenseByCat.values()) grandOut += v.total;
  }
  const grandProfit = grandIn - grandOut;

  return (
    <div className="space-y-4">
      <PnLFilter buildingId={buildingId} range={range} from={from} to={to} />

      <div className="grid grid-cols-3 gap-3">
        <div className="stat sage flex flex-col justify-center min-h-[100px]">
          <div className="stat-label">Tổng thu (BCKD)</div>
          <div className="stat-value text-base lg:text-xl break-words">
            <span className="lg:hidden">{formatVNDCompact(grandIn)}</span>
            <span className="hidden lg:inline">{formatVND(grandIn)}</span>
          </div>
        </div>
        <div className="stat accent flex flex-col justify-center min-h-[100px]">
          <div className="stat-label">Tổng chi (BCKD)</div>
          <div className="stat-value text-base lg:text-xl break-words">
            <span className="lg:hidden">{formatVNDCompact(grandOut)}</span>
            <span className="hidden lg:inline">{formatVND(grandOut)}</span>
          </div>
        </div>
        <div className="stat dark flex flex-col justify-center min-h-[100px]">
          <div className="stat-label">Lợi nhuận</div>
          <div className="stat-value text-base lg:text-xl break-words">
            <span className="lg:hidden">{formatVNDCompact(grandProfit)}</span>
            <span className="hidden lg:inline">{formatVND(grandProfit)}</span>
          </div>
        </div>
      </div>

      {monthKeys.length === 0 && (
        <Card>
          <CardContent className="p-6 text-center text-sm text-slate-500">
            Không có dữ liệu trong khoảng đã chọn
          </CardContent>
        </Card>
      )}

      {monthKeys.map((k) => {
        const [yStr, mStr] = k.split("-");
        const y = Number(yStr);
        const m = Number(mStr);
        const agg = byMonth.get(k)!;
        const incomeRows = Array.from(agg.incomeByCat.entries())
          .sort((a, b) => Number(b[1].total - a[1].total))
          .map(([name, v]) => ({ name, total: v.total, details: v.details }));
        const expenseRows = Array.from(agg.expenseByCat.entries())
          .sort((a, b) => Number(b[1].total - a[1].total))
          .map(([name, v]) => ({ name, total: v.total, details: v.details }));
        const totalIn = incomeRows.reduce((s, r) => s + r.total, 0n);
        const totalOut = expenseRows.reduce((s, r) => s + r.total, 0n);
        const profit = totalIn - totalOut;

        return (
          <Card key={k}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between flex-wrap gap-2">
                <span>Tháng {m}/{y}</span>
                <span className="text-sm font-normal">
                  Thu: <strong className="text-emerald-600">{formatVND(totalIn)}</strong>
                  {" · "}Chi: <strong className="text-rose-600">{formatVND(totalOut)}</strong>
                  {" · "}LN: <strong className={profit >= 0n ? "text-emerald-600" : "text-rose-600"}>{formatVND(profit)}</strong>
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 border-t">
                <div className="border-b lg:border-b-0 lg:border-r">
                  <div className="px-4 py-2 text-xs uppercase tracking-wider text-slate-500 bg-slate-50">Doanh thu theo loại</div>
                  <PnLBreakdownTable
                    buildingId={buildingId}
                    rows={serializeBigInt(incomeRows)}
                    total={totalIn.toString()}
                    accent="emerald"
                  />
                </div>
                <div>
                  <div className="px-4 py-2 text-xs uppercase tracking-wider text-slate-500 bg-slate-50">Chi phí theo loại</div>
                  <PnLBreakdownTable
                    buildingId={buildingId}
                    rows={serializeBigInt(expenseRows)}
                    total={totalOut.toString()}
                    accent="rose"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}

      <p className="text-xs text-slate-500 text-center">
        Chỉ những giao dịch có tick &quot;Hạch toán vào BCKD&quot; mới được tính.
      </p>
    </div>
  );
}
