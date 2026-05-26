import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatVND, formatDateVN, customerDisplayName, formatRoomNumber } from "@/lib/utils";
import { MonthYearFilter } from "./month-year-filter";
import { renderContentWithLinks } from "./render-content";
import { FinanceExportButton } from "./finance-export-button";
import { CashbookFilters } from "./cashbook-filters";
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
  buildingId, month, year, paymentMethods, partyKindConfigs, categories, categoryFilter, partyFilter,
}: {
  buildingId: string;
  month: number;
  year: number;
  paymentMethods: { id: string; name: string }[];
  partyKindConfigs: { code: string; label: string }[];
  categories: { id: string; name: string; type: "INCOME" | "EXPENSE" }[];
  categoryFilter: string;
  partyFilter: string;
}) {
  const PARTY_KIND_LABEL: Record<string, string> = Object.fromEntries(
    partyKindConfigs.map((p) => [p.code, p.label])
  );
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0, 23, 59, 59);

  const [transactions, allOpenings, priorTxs, contractList, invoiceList] = await Promise.all([
    prisma.transaction.findMany({
      where: { buildingId, showInCashbook: true, date: { gte: start, lte: end } },
      include: {
        paymentMethod: true,
        category: { select: { name: true } },
        customer: { select: { type: true, fullName: true, companyName: true } },
        party: { select: { name: true } },
        room: { select: { number: true } },
      },
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
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
      where: { buildingId, showInCashbook: true, date: { lt: start } },
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

  // Merge the prop PM list with any PM that already has a transaction in this
  // building (regardless of buildingType scope). Without this, a tx whose PM
  // wasn't in the type-filtered list (e.g. user-created PM with buildingType
  // mismatched, or a PM scoped to a different building type) would silently
  // disappear from Sổ Quỹ. Also pull priorTxs PMs so opening balance still
  // accumulates against the right card.
  const pmMap = new Map<string, { id: string; name: string }>();
  for (const p of paymentMethods) pmMap.set(p.id, { id: p.id, name: p.name });
  for (const t of transactions) {
    if (t.paymentMethod && !pmMap.has(t.paymentMethod.id)) {
      pmMap.set(t.paymentMethod.id, { id: t.paymentMethod.id, name: t.paymentMethod.name });
    }
  }
  // priorTxs only has paymentMethodId (not the PM record) → fetch missing ones.
  const priorPmIds = new Set<string>();
  for (const t of priorTxs) {
    if (t.paymentMethodId && !pmMap.has(t.paymentMethodId)) priorPmIds.add(t.paymentMethodId);
  }
  if (priorPmIds.size > 0) {
    const extras = await prisma.paymentMethod.findMany({
      where: { id: { in: Array.from(priorPmIds) } },
      select: { id: true, name: true },
    });
    for (const p of extras) pmMap.set(p.id, p);
  }
  const allPms = Array.from(pmMap.values()).sort((a, b) => a.name.localeCompare(b.name));

  const exportSheets: ExportSheet[] = allPms.map((pm) => {
    const txs = transactions.filter((t) => t.paymentMethodId === pm.id);
    const opening = computeOpening(pm.id, pm.name);
    let running = opening;
    // Accumulate running balance chronologically, then reverse to match the
    // web view (closing on top, newest tx first, opening on bottom).
    const txRows: Record<string, unknown>[] = [];
    for (const t of txs) {
      if (t.type === "INCOME") running += t.amount;
      else running -= t.amount;
      const partyLabel = t.customer
        ? customerDisplayName(t.customer)
        : t.party?.name ?? (t.partyKind ? PARTY_KIND_LABEL[t.partyKind] ?? "" : "");
      txRows.push({
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
    txRows.reverse();
    const rows: Record<string, unknown>[] = [
      { "Ngày": "Số dư cuối kỳ", "Số dư": Number(running) },
      ...txRows,
      { "Ngày": "Số dư đầu kỳ", "Số dư": Number(opening) },
    ];
    return {
      name: pm.name,
      rows,
      header: ["Ngày", "Loại thu/chi", "Đối tượng", "Phòng", "Nội dung", "Thu", "Chi", "Số dư"],
    };
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <MonthYearFilter buildingId={buildingId} month={month} year={year} tab="cashbook" />
        <CashbookFilters
          buildingId={buildingId}
          categories={categories}
          partyKindConfigs={partyKindConfigs}
          categoryFilter={categoryFilter}
          partyFilter={partyFilter}
        />
        <div className="ml-auto">
          <FinanceExportButton filename={`so-quy-${month}-${year}.xlsx`} sheets={exportSheets} />
        </div>
      </div>

      {allPms.map((pm) => {
        const txs = transactions.filter((t) => t.paymentMethodId === pm.id);
        const opening = computeOpening(pm.id, pm.name);
        const totalIn = txs.filter((t) => t.type === "INCOME").reduce((s, t) => s + t.amount, 0n);
        const totalOut = txs.filter((t) => t.type === "EXPENSE").reduce((s, t) => s + t.amount, 0n);
        const closing = opening + totalIn - totalOut;

        // Compute running balance chronologically across ALL transactions so
        // the "Số dư" column reflects the actual cash position regardless of
        // filter. Filtering (category/đối tượng) only hides display rows.
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
        const visible = rendered.filter(({ tx: t }) =>
          (categoryFilter === "ALL" || t.category?.name === categoryFilter) &&
          (partyFilter === "ALL" || t.partyKind === partyFilter),
        );
        visible.reverse();

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
                  {visible.length === 0 && (
                    <tr><td colSpan={7} className="px-4 py-4 text-center text-slate-500 text-sm">
                      {txs.length === 0 ? "Không có giao dịch" : "Không có giao dịch khớp bộ lọc"}
                    </td></tr>
                  )}
                  {visible.map(({ tx: t, partyLabel, roomLabel, runningAfter }) => (
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
                      <td className="px-4 py-2">{renderContentWithLinks({ content: t.content, buildingId, contractMap, invoiceMap })}</td>
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
