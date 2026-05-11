import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatVND, formatDateVN, customerDisplayName, formatRoomNumber } from "@/lib/utils";
import { MonthYearFilter } from "./month-year-filter";
import { renderContentWithLinks } from "./render-content";
import { FinanceExportButton } from "./finance-export-button";
import type { ExportSheet } from "@/lib/export-xlsx";

/**
 * Sổ quỹ — mỗi PTTT 1 bảng:
 * - Số dư đầu kỳ: lấy OpeningBalance gần nhất (cùng tháng → dùng trực tiếp,
 *   tháng trước → cộng dồn giao dịch tới đầu tháng này). Nếu chưa có OB,
 *   cộng dồn tất cả giao dịch từ xưa tới đầu tháng này.
 * - Tất cả giao dịch trong tháng dùng PTTT đó (mới nhất ở trên), hiển thị
 *   Thu / Chi / Số dư running.
 * - Số dư cuối kỳ.
 */
export async function CashbookTab({
  buildingId, month, year, paymentMethods, partyKindConfigs,
}: {
  buildingId: string;
  month: number;
  year: number;
  paymentMethods: { id: string; name: string }[];
  partyKindConfigs: { code: string; label: string }[];
}) {
  const PARTY_KIND_LABEL: Record<string, string> = Object.fromEntries(
    partyKindConfigs.map((p) => [p.code, p.label])
  );
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0, 23, 59, 59);

  const [transactions, allOpenings, priorTxs, contractList, invoiceList] = await Promise.all([
    prisma.transaction.findMany({
      where: { buildingId, date: { gte: start, lte: end } },
      include: {
        paymentMethod: true,
        category: { select: { name: true } },
        customer: { select: { type: true, fullName: true, companyName: true } },
        party: { select: { name: true } },
        room: { select: { number: true } },
      },
      orderBy: { date: "asc" },
    }),
    prisma.openingBalance.findMany({
      where: {
        buildingId,
        kind: "CASHBOOK",
        OR: [
          { asOfYear: { lt: year } },
          { asOfYear: year, asOfMonth: { lte: month } },
        ],
      },
      orderBy: [{ asOfYear: "desc" }, { asOfMonth: "desc" }],
    }),
    prisma.transaction.findMany({
      where: { buildingId, date: { lt: start } },
      select: { type: true, amount: true, paymentMethodId: true, date: true },
    }),
    prisma.contract.findMany({ where: { buildingId }, select: { id: true, code: true } }),
    prisma.invoice.findMany({ where: { buildingId }, select: { id: true, code: true } }),
  ]);

  // Latest OpeningBalance per PTTT name (already sorted desc → first wins).
  const latestOBByPM = new Map<string, { amount: bigint; asOfMonth: number; asOfYear: number }>();
  for (const ob of allOpenings) {
    const key = ob.paymentMethodLabel ?? "";
    if (!latestOBByPM.has(key)) {
      latestOBByPM.set(key, { amount: ob.amount, asOfMonth: ob.asOfMonth, asOfYear: ob.asOfYear });
    }
  }

  function computeOpening(pmId: string, pmName: string): bigint {
    const ob = latestOBByPM.get(pmName);
    // Manual override: an OB exists for this exact month → use as-is.
    if (ob && ob.asOfMonth === month && ob.asOfYear === year) return ob.amount;
    // Else accumulate transactions from after the OB's month (or from the
    // beginning of time if no OB) up to the start of the current month.
    const obStart = ob ? new Date(ob.asOfYear, ob.asOfMonth - 1, 1) : new Date(0);
    let bal = ob?.amount ?? 0n;
    for (const t of priorTxs) {
      if (t.paymentMethodId !== pmId) continue;
      if (t.date < obStart) continue;
      bal += t.type === "INCOME" ? t.amount : -t.amount;
    }
    return bal;
  }

  const contractMap = new Map(contractList.map((c) => [c.code, c.id]));
  const invoiceMap = new Map(invoiceList.map((i) => [i.code, i.id]));

  const exportSheets: ExportSheet[] = paymentMethods.map((pm) => {
    const txs = transactions.filter((t) => t.paymentMethodId === pm.id);
    const opening = computeOpening(pm.id, pm.name);
    let running = opening;
    const rows: Record<string, unknown>[] = [
      { "Ngày": "Số dư đầu kỳ", "Số dư": Number(opening) },
    ];
    for (const t of txs) {
      if (t.type === "INCOME") running += t.amount;
      else running -= t.amount;
      const partyLabel = t.customer
        ? customerDisplayName(t.customer)
        : t.party?.name ?? (t.partyKind ? PARTY_KIND_LABEL[t.partyKind] ?? "" : "");
      rows.push({
        "Ngày": formatDateVN(t.date),
        "Loại thu/chi": t.category?.name ?? "",
        "Đối tượng": partyLabel,
        "Phòng": t.room ? formatRoomNumber(t.room.number) : "",
        "Nội dung": t.content,
        "Thu": t.type === "INCOME" ? Number(t.amount) : "",
        "Chi": t.type === "EXPENSE" ? Number(t.amount) : "",
        "Số dư": Number(running),
      });
    }
    rows.push({ "Ngày": "Số dư cuối kỳ", "Số dư": Number(running) });
    return { name: pm.name, rows };
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <MonthYearFilter buildingId={buildingId} month={month} year={year} tab="cashbook" />
        <div className="ml-auto">
          <FinanceExportButton filename={`so-quy-${month}-${year}.xlsx`} sheets={exportSheets} />
        </div>
      </div>

      {paymentMethods.map((pm) => {
        const txs = transactions.filter((t) => t.paymentMethodId === pm.id);
        const opening = computeOpening(pm.id, pm.name);
        const totalIn = txs.filter((t) => t.type === "INCOME").reduce((s, t) => s + t.amount, 0n);
        const totalOut = txs.filter((t) => t.type === "EXPENSE").reduce((s, t) => s + t.amount, 0n);
        const closing = opening + totalIn - totalOut;

        // Compute running balance chronologically, then render in reverse so
        // the most recent transaction sits at the top of the table.
        let running = opening;
        const rendered = txs.map((t) => {
          if (t.type === "INCOME") running += t.amount;
          else running -= t.amount;
          const partyLabel = t.customer
            ? customerDisplayName(t.customer)
            : t.party?.name ?? (t.partyKind ? PARTY_KIND_LABEL[t.partyKind] ?? "" : "");
          const roomLabel = t.room ? formatRoomNumber(t.room.number) : "";
          return { tx: t, partyLabel, roomLabel, runningAfter: running };
        });
        rendered.reverse();

        return (
          <Card key={pm.id}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{pm.name}</span>
                <span className="text-sm font-normal text-slate-500">
                  Đầu: <strong>{formatVND(opening)}</strong> · Phát sinh: <strong className="text-emerald-600">+{formatVND(totalIn)}</strong> <strong className="text-rose-600">−{formatVND(totalOut)}</strong> · Cuối: <strong>{formatVND(closing)}</strong>
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                    <th className="px-4 py-2 text-left">Ngày</th>
                    <th className="px-4 py-2 text-left">Loại thu/chi</th>
                    <th className="px-4 py-2 text-left">Đối tượng</th>
                    <th className="px-4 py-2 text-left">Nội dung</th>
                    <th className="px-4 py-2 text-right">Thu</th>
                    <th className="px-4 py-2 text-right">Chi</th>
                    <th className="px-4 py-2 text-right">Số dư</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="bg-slate-50/50 italic">
                    <td colSpan={6} className="px-4 py-1.5 text-xs text-slate-500">Số dư cuối kỳ</td>
                    <td className="px-4 py-1.5 text-right text-xs font-semibold">{formatVND(closing)}</td>
                  </tr>
                  {txs.length === 0 && (
                    <tr><td colSpan={7} className="px-4 py-4 text-center text-slate-500 text-sm">Không có giao dịch</td></tr>
                  )}
                  {rendered.map(({ tx: t, partyLabel, roomLabel, runningAfter }) => (
                    <tr key={t.id} className="border-t hover:bg-slate-50">
                      <td className="px-4 py-2 whitespace-nowrap">{formatDateVN(t.date)}</td>
                      <td className="px-4 py-2 whitespace-nowrap">{t.category?.name || <span className="text-slate-400">—</span>}</td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        {partyLabel || roomLabel ? (
                          <>
                            {partyLabel && <div>{partyLabel}</div>}
                            {roomLabel && <div className="text-xs text-slate-500">{roomLabel}</div>}
                          </>
                        ) : <span className="text-slate-400">—</span>}
                      </td>
                      <td className="px-4 py-2 max-w-xs truncate">{renderContentWithLinks({ content: t.content, buildingId, contractMap, invoiceMap })}</td>
                      <td className="px-4 py-2 text-right text-emerald-700">{t.type === "INCOME" ? formatVND(t.amount) : ""}</td>
                      <td className="px-4 py-2 text-right text-rose-700">{t.type === "EXPENSE" ? formatVND(t.amount) : ""}</td>
                      <td className="px-4 py-2 text-right font-medium">{formatVND(runningAfter)}</td>
                    </tr>
                  ))}
                  <tr className="bg-slate-50/50 italic">
                    <td colSpan={6} className="px-4 py-1.5 text-xs text-slate-500">Số dư đầu kỳ</td>
                    <td className="px-4 py-1.5 text-right text-xs">{formatVND(opening)}</td>
                  </tr>
                </tbody>
              </table>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
