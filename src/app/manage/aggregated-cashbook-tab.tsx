import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatVND, formatDateVN, customerDisplayName, formatRoomNumber } from "@/lib/utils";
import { renderContentWithLinks } from "@/app/buildings/[id]/finance/render-content";
import { FinanceExportButton } from "@/app/buildings/[id]/finance/finance-export-button";
import type { ExportSheet } from "@/lib/export-xlsx";
import { AggregatedCashbookFilter } from "./aggregated-cashbook-filter";

/**
 * Sổ quỹ tổng — chỉ list các Tài khoản TT được gắn cho ≥2 toà nhà của cùng
 * loại (CHDV / VP). Mỗi PTTT 1 bảng tương tự Sổ quỹ per-building, nhưng giao
 * dịch gom từ MỌI toà mà PTTT đó được dùng. Có thêm cột "Toà nhà" và filter
 * theo toà ở đầu trang.
 */
export async function AggregatedCashbookTab({
  kind,
  buildings,
  month,
  year,
  buildingFilter,
  partyKindConfigs,
  categoryFilter,
  partyFilter,
}: {
  kind: "CHDV" | "VP";
  buildings: { id: string; name: string; type: string }[];
  month: number;
  year: number;
  buildingFilter: string;
  partyKindConfigs: { code: string; label: string }[];
  categoryFilter: string;
  partyFilter: string;
}) {
  const PARTY_KIND_LABEL: Record<string, string> = Object.fromEntries(
    partyKindConfigs.map((p) => [p.code, p.label]),
  );
  const accessibleBuildingIds = buildings.map((b) => b.id);
  const buildingNameById = new Map(buildings.map((b) => [b.id, b.name]));
  const categories = await prisma.transactionCategory.findMany({
    where: { OR: [{ buildingType: kind }, { buildingType: null }] },
    orderBy: [{ type: "asc" }, { name: "asc" }],
    select: { id: true, name: true, type: true },
  });

  // PMs are shared across buildings via the BuildingPaymentMethods join. We
  // include `buildings` so we can count how many of THIS user's accessible
  // buildings the PM is tied to, and only keep those tied to ≥2.
  const allPMs = await prisma.paymentMethod.findMany({
    where: { buildings: { some: { id: { in: accessibleBuildingIds } } } },
    include: {
      buildings: {
        where: { id: { in: accessibleBuildingIds } },
        select: { id: true, name: true },
      },
    },
    orderBy: { name: "asc" },
  });
  const sharedPMs = allPMs.filter((pm) => pm.buildings.length >= 2);

  if (sharedPMs.length === 0) {
    return (
      <div className="space-y-3">
        <AggregatedCashbookFilter
          kind={kind}
          buildings={buildings}
          month={month}
          year={year}
          buildingFilter={buildingFilter}
          categories={categories}
          partyKindConfigs={partyKindConfigs}
          categoryFilter={categoryFilter}
          partyFilter={partyFilter}
        />
        <Card>
          <CardContent className="py-12 text-center text-sm text-slate-500">
            Không có Tài khoản TT nào đang dùng chung cho ≥2 toà nhà loại {kind === "CHDV" ? "Căn hộ DV" : "Văn phòng"}.
            <br />
            Vào Cài đặt chung → Tài khoản TT → tick thêm toà nhà cho 1 PTTT để bắt đầu.
          </CardContent>
        </Card>
      </div>
    );
  }

  // Building filter narrows the tx (and opening balances) to a single building.
  // PMs in `sharedPMs` are still all listed — even if filtered to 1 building,
  // we still see every shared PM (some may have no rows that month).
  const targetBuildingIds = buildingFilter === "ALL"
    ? accessibleBuildingIds
    : accessibleBuildingIds.filter((id) => id === buildingFilter);

  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0, 23, 59, 59);

  const sharedPMIds = sharedPMs.map((pm) => pm.id);
  const [transactions, allOpenings, priorTxs, contractList, invoiceList] = await Promise.all([
    prisma.transaction.findMany({
      where: {
        paymentMethodId: { in: sharedPMIds },
        buildingId: { in: targetBuildingIds },
        date: { gte: start, lte: end },
      },
      include: {
        building: { select: { id: true, name: true } },
        paymentMethod: { select: { id: true, name: true } },
        category: { select: { name: true } },
        customer: { select: { type: true, fullName: true, companyName: true } },
        party: { select: { name: true } },
        room: { select: { number: true } },
      },
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    }),
    prisma.openingBalance.findMany({
      where: {
        buildingId: { in: targetBuildingIds },
        kind: "CASHBOOK",
        OR: [
          { asOfYear: { lt: year } },
          { asOfYear: year, asOfMonth: { lte: month } },
        ],
      },
      orderBy: [{ asOfYear: "desc" }, { asOfMonth: "desc" }],
    }),
    prisma.transaction.findMany({
      where: {
        buildingId: { in: targetBuildingIds },
        paymentMethodId: { in: sharedPMIds },
        date: { lt: start },
      },
      select: { type: true, amount: true, paymentMethodId: true, buildingId: true, date: true },
    }),
    prisma.contract.findMany({
      where: { buildingId: { in: targetBuildingIds } },
      select: { id: true, code: true },
    }),
    prisma.invoice.findMany({
      where: { buildingId: { in: targetBuildingIds } },
      select: { id: true, code: true },
    }),
  ]);
  const contractMap = new Map(contractList.map((c) => [c.code, c.id]));
  const invoiceMap = new Map(invoiceList.map((i) => [i.code, i.id]));
  // Mirror per-building Sổ quỹ logic: opening for each (building, PM) is the
  // latest OB on/before this month, then accumulate prior-month txs from that
  // OB's month forward. Sum across buildings to get the aggregated opening.
  const latestOBByBldgPm = new Map<string, { amount: bigint; asOfMonth: number; asOfYear: number }>();
  for (const ob of allOpenings) {
    if (!ob.paymentMethodLabel) continue;
    const key = `${ob.buildingId}::${ob.paymentMethodLabel}`;
    if (!latestOBByBldgPm.has(key)) {
      latestOBByBldgPm.set(key, { amount: ob.amount, asOfMonth: ob.asOfMonth, asOfYear: ob.asOfYear });
    }
  }
  const openingByPMLabel = new Map<string, bigint>();
  for (const pm of sharedPMs) {
    let sum = 0n;
    for (const bId of targetBuildingIds) {
      const ob = latestOBByBldgPm.get(`${bId}::${pm.name}`);
      if (ob && ob.asOfMonth === month && ob.asOfYear === year) {
        sum += ob.amount;
        continue;
      }
      const obStart = ob ? new Date(ob.asOfYear, ob.asOfMonth - 1, 1) : new Date(0);
      let bal = ob?.amount ?? 0n;
      for (const t of priorTxs) {
        if (t.buildingId !== bId) continue;
        if (t.paymentMethodId !== pm.id) continue;
        if (t.date < obStart) continue;
        bal += t.type === "INCOME" ? t.amount : -t.amount;
      }
      sum += bal;
    }
    openingByPMLabel.set(pm.name, sum);
  }

  const exportSheets: ExportSheet[] = sharedPMs.map((pm) => {
    const txs = transactions.filter((t) => t.paymentMethodId === pm.id);
    const opening = openingByPMLabel.get(pm.name) ?? 0n;
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
        "Toà nhà": buildingNameById.get(t.buildingId) ?? t.building?.name ?? "",
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
        <AggregatedCashbookFilter
          kind={kind}
          buildings={buildings}
          month={month}
          year={year}
          buildingFilter={buildingFilter}
          categories={categories}
          partyKindConfigs={partyKindConfigs}
          categoryFilter={categoryFilter}
          partyFilter={partyFilter}
        />
        <div className="ml-auto">
          <FinanceExportButton filename={`so-quy-tong-${month}-${year}.xlsx`} sheets={exportSheets} />
        </div>
      </div>

      {sharedPMs.map((pm) => {
        const txs = transactions.filter((t) => t.paymentMethodId === pm.id);
        const opening = openingByPMLabel.get(pm.name) ?? 0n;
        const totalIn = txs.filter((t) => t.type === "INCOME").reduce((s, t) => s + t.amount, 0n);
        const totalOut = txs.filter((t) => t.type === "EXPENSE").reduce((s, t) => s + t.amount, 0n);
        const closing = opening + totalIn - totalOut;
        // Running balance computed over ALL txs; filter only hides display rows.
        let running = opening;
        const withRunning = txs.map((t) => {
          if (t.type === "INCOME") running += t.amount;
          else running -= t.amount;
          return { tx: t, runningAfter: running };
        });
        const visible = withRunning.filter(({ tx: t }) =>
          (categoryFilter === "ALL" || t.category?.name === categoryFilter) &&
          (partyFilter === "ALL" || t.partyKind === partyFilter),
        );
        visible.reverse();
        const linkedNames = pm.buildings.map((b) => b.name).join(", ");

        return (
          <Card key={pm.id}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between flex-wrap gap-2">
                <div className="min-w-0">
                  <span>{pm.name}</span>
                  <div className="text-[11px] text-slate-500 font-normal mt-0.5 truncate">
                    Toà dùng chung: {linkedNames}
                  </div>
                </div>
                <span className="text-sm font-normal text-slate-500">
                  Đầu: <strong>{formatVND(opening)}</strong>
                  {" · "}Phát sinh: <strong className="text-emerald-600">+{formatVND(totalIn)}</strong>{" "}
                  <strong className="text-rose-600">−{formatVND(totalOut)}</strong>
                  {" · "}Cuối: <strong>{formatVND(closing)}</strong>
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                    <th className="px-4 py-2 text-left">Ngày</th>
                    <th className="px-4 py-2 text-left">Toà nhà</th>
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
                    <td colSpan={7} className="px-4 py-1.5 text-xs text-slate-500">Số dư cuối kỳ</td>
                    <td className="px-4 py-1.5 text-right text-xs font-semibold">{formatVND(closing)}</td>
                  </tr>
                  {visible.length === 0 && (
                    <tr><td colSpan={8} className="px-4 py-4 text-center text-slate-500 text-sm">
                      {txs.length === 0 ? "Không có giao dịch" : "Không có giao dịch khớp bộ lọc"}
                    </td></tr>
                  )}
                  {visible.map(({ tx: t, runningAfter }) => {
                    const partyLabel = t.customer
                      ? customerDisplayName(t.customer)
                      : t.party?.name ?? (t.partyKind ? PARTY_KIND_LABEL[t.partyKind] ?? "" : "");
                    const roomLabel = t.room ? formatRoomNumber(t.room.number) : "";
                    return (
                      <tr key={t.id} className="border-t hover:bg-slate-50">
                        <td className="px-4 py-2 whitespace-nowrap">{formatDateVN(t.date)}</td>
                        <td className="px-4 py-2 whitespace-nowrap text-xs text-slate-600">
                          {buildingNameById.get(t.buildingId) ?? t.building?.name ?? "—"}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap">{t.category?.name || <span className="text-slate-400">—</span>}</td>
                        <td className="px-4 py-2 whitespace-nowrap">
                          {partyLabel || roomLabel ? (
                            <>
                              {partyLabel && <div>{partyLabel}</div>}
                              {roomLabel && <div className="text-xs text-slate-500">{roomLabel}</div>}
                            </>
                          ) : <span className="text-slate-400">—</span>}
                        </td>
                        <td className="px-4 py-2 max-w-xs truncate">
                          {renderContentWithLinks({ content: t.content, buildingId: t.buildingId, contractMap, invoiceMap })}
                        </td>
                        <td className="px-4 py-2 text-right text-emerald-700">{t.type === "INCOME" ? formatVND(t.amount) : ""}</td>
                        <td className="px-4 py-2 text-right text-rose-700">{t.type === "EXPENSE" ? formatVND(t.amount) : ""}</td>
                        <td className="px-4 py-2 text-right font-medium">{formatVND(runningAfter)}</td>
                      </tr>
                    );
                  })}
                  <tr className="bg-slate-50/50 italic">
                    <td colSpan={7} className="px-4 py-1.5 text-xs text-slate-500">Số dư đầu kỳ</td>
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
