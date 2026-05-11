"use client";
import { formatVND, formatVNDCompact } from "@/lib/utils";

export type PnLChartPoint = {
  label: string;
  income: number;
  expense: number;
  profit: number;
};

// Brand palette (matches the stat card variants on the same page).
const COLORS = {
  income: "#4f8a5c",  // sage
  expense: "#c96442", // terra coral
  profit: "#6b4226",  // dark brown
};

/**
 * Clustered vertical bar chart with Y-axis ticks, gridlines and brand colors.
 * 3 bars per period (Doanh thu / Chi phí / Lợi nhuận). Profit height uses
 * |value| so negative profit still renders; the bar tooltip carries the sign.
 */
export function PnLBarChart({ series }: { series: PnLChartPoint[] }) {
  if (series.length === 0) return null;
  const maxVal = Math.max(
    1,
    ...series.flatMap((p) => [Math.abs(p.income), Math.abs(p.expense), Math.abs(p.profit)]),
  );
  const ticks = niceTicks(maxVal, 5);
  const yTop = ticks[ticks.length - 1];
  const chartHeight = 220; // px

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <div className="flex" style={{ minWidth: Math.max(420, series.length * 110) }}>
          {/* Y-axis labels */}
          <div
            className="flex flex-col justify-between text-[10px] text-slate-500 pr-2 text-right tabular-nums"
            style={{ height: chartHeight + 24 /* room for x-axis label */ }}
          >
            {[...ticks].reverse().map((t) => (
              <div key={t} className="leading-none" style={{ height: 1 }}>
                {t === 0 ? "0" : formatVNDCompact(t)}
              </div>
            ))}
            <div style={{ height: 24 }} />
          </div>
          {/* Plot area + bars */}
          <div className="flex-1 relative">
            <div className="relative" style={{ height: chartHeight }}>
              {/* Gridlines */}
              {ticks.map((t) => (
                <div
                  key={t}
                  className="absolute left-0 right-0 border-t border-slate-200"
                  style={{ bottom: (t / yTop) * chartHeight }}
                />
              ))}
              {/* Bar groups */}
              <div className="absolute inset-0 flex items-end justify-around gap-2 px-2">
                {series.map((p) => (
                  <div key={p.label} className="flex items-end justify-center gap-1.5 h-full flex-1">
                    <Bar value={p.income} max={yTop} color={COLORS.income} title={`Doanh thu: ${formatVND(p.income)}`} />
                    <Bar value={p.expense} max={yTop} color={COLORS.expense} title={`Chi phí: ${formatVND(p.expense)}`} />
                    <Bar value={p.profit} max={yTop} color={COLORS.profit} title={`Lợi nhuận: ${formatVND(p.profit)}`} />
                  </div>
                ))}
              </div>
            </div>
            {/* X-axis labels */}
            <div className="flex justify-around gap-2 px-2 pt-1.5">
              {series.map((p) => (
                <div key={p.label} className="text-[11px] text-slate-700 font-medium text-center flex-1 whitespace-nowrap">
                  {p.label}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-5 text-xs text-slate-600 justify-center flex-wrap">
        <LegendDot color={COLORS.income} label="Doanh thu" />
        <LegendDot color={COLORS.expense} label="Chi phí" />
        <LegendDot color={COLORS.profit} label="Lợi nhuận" />
      </div>
    </div>
  );
}

function Bar({ value, max, color, title }: { value: number; max: number; color: string; title: string }) {
  const pct = max > 0 ? Math.min(100, (Math.abs(value) / max) * 100) : 0;
  return (
    <div
      title={title}
      className="rounded-t-sm transition-all"
      style={{
        width: 16,
        height: `${pct}%`,
        minHeight: value !== 0 ? 2 : 0,
        backgroundColor: color,
      }}
    />
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

// Pick a "nice" tick step (1·10^n, 2·10^n, 5·10^n) so labels are round numbers.
function niceTicks(max: number, count: number): number[] {
  if (max <= 0) return [0];
  const rough = max / (count - 1);
  const exp = Math.floor(Math.log10(rough));
  const base = Math.pow(10, exp);
  const norm = rough / base;
  const mul = norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10;
  const step = mul * base;
  const top = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = 0; v <= top + step / 2; v += step) ticks.push(v);
  return ticks;
}
