"use client";
import { formatVND, formatVNDCompact } from "@/lib/utils";

export type PnLChartPoint = {
  label: string;
  income: number;
  expense: number;
  profit: number;
};

/**
 * Clustered vertical bar chart: 3 bars per period (Doanh thu / Chi phí / Lợi
 * nhuận). Period = week for "Trong tháng", month otherwise. Negative profit
 * renders the LN bar in rose; height uses |value|.
 */
export function PnLBarChart({ series }: { series: PnLChartPoint[] }) {
  if (series.length === 0) return null;
  const maxVal = Math.max(
    1,
    ...series.flatMap((p) => [Math.abs(p.income), Math.abs(p.expense), Math.abs(p.profit)]),
  );

  return (
    <div className="space-y-3">
      <div className="flex items-end gap-3 lg:gap-5 h-56 overflow-x-auto pb-1">
        {series.map((p) => (
          <div key={p.label} className="flex flex-col items-center gap-1.5 flex-1 min-w-[68px]">
            <div className="flex items-end justify-center gap-1 h-48 w-full">
              <BarColumn label="Thu" value={p.income} max={maxVal} color="emerald" />
              <BarColumn label="Chi" value={p.expense} max={maxVal} color="rose" />
              <BarColumn label="LN" value={p.profit} max={maxVal} color={p.profit >= 0 ? "amber" : "rose"} />
            </div>
            <div className="text-[11px] text-slate-600 font-medium whitespace-nowrap">{p.label}</div>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-4 text-[11px] text-slate-500 justify-center flex-wrap">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-3 rounded-sm bg-emerald-500" /> Doanh thu</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-3 rounded-sm bg-rose-500" /> Chi phí</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-3 rounded-sm bg-amber-500" /> Lợi nhuận</span>
      </div>
    </div>
  );
}

function BarColumn({ label, value, max, color }: {
  label: string;
  value: number;
  max: number;
  color: "emerald" | "rose" | "amber";
}) {
  const pct = max > 0 ? Math.min(100, (Math.abs(value) / max) * 100) : 0;
  const cls =
    color === "emerald"
      ? "bg-gradient-to-t from-emerald-600 to-emerald-400"
      : color === "rose"
      ? "bg-gradient-to-t from-rose-600 to-rose-400"
      : "bg-gradient-to-t from-amber-600 to-amber-400";
  const title = `${label}: ${formatVND(value)}`;
  return (
    <div className="flex flex-col items-center justify-end h-full w-full" title={title}>
      <div className="text-[9px] text-slate-500 leading-none mb-0.5 tabular-nums">
        {value === 0 ? "" : formatVNDCompact(value)}
      </div>
      <div className={`w-full max-w-[18px] rounded-t-sm ${cls}`} style={{ height: `${pct}%`, minHeight: value !== 0 ? 2 : 0 }} />
    </div>
  );
}
