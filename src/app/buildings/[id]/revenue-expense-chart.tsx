"use client";
import { formatVND } from "@/lib/utils";

type Point = { month: number; year: number; income: number; expense: number };

const MONTH_LABELS = ["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8", "T9", "T10", "T11", "T12"];

// Match the KQKD chart palette.
const SAGE = "#4f8a5c";
const SAGE_SOFT = "#e3efd9";
const EARTHY = "#a04a30";
const EARTHY_SOFT = "#f5e1d9";

export function RevenueExpenseChart({ series }: { series: Point[] }) {
  const maxVal = Math.max(1, ...series.flatMap((p) => [p.income, p.expense]));
  const totalIncome = series.reduce((s, p) => s + p.income, 0);
  const totalExpense = series.reduce((s, p) => s + p.expense, 0);
  const diff = totalIncome - totalExpense;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2 text-xs">
        <Stat label="Tổng thu" value={formatVND(totalIncome)} color={SAGE} />
        <Stat label="Tổng chi" value={formatVND(totalExpense)} color={EARTHY} />
        <Stat label="Chênh lệch" value={formatVND(diff)} color={diff >= 0 ? SAGE : EARTHY} />
      </div>

      <div className="space-y-2">
        {series.map((p) => {
          const incomePct = (p.income / maxVal) * 100;
          const expensePct = (p.expense / maxVal) * 100;
          return (
            <div key={`${p.year}-${p.month}`} className="space-y-1">
              <div className="flex items-center justify-between text-[11px] text-slate-500">
                <span className="font-medium">{MONTH_LABELS[p.month - 1]}/{String(p.year).slice(-2)}</span>
                <span className="flex gap-3">
                  <span style={{ color: SAGE }}>{formatVND(p.income)}</span>
                  <span style={{ color: EARTHY }}>{formatVND(p.expense)}</span>
                  <span style={{ color: p.income - p.expense >= 0 ? SAGE : EARTHY }}>{formatVND(p.income - p.expense)}</span>
                </span>
              </div>
              <div className="space-y-0.5">
                <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: SAGE_SOFT }}>
                  <div className="h-full transition-all" style={{ width: `${incomePct}%`, backgroundColor: SAGE }} />
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: EARTHY_SOFT }}>
                  <div className="h-full transition-all" style={{ width: `${expensePct}%`, backgroundColor: EARTHY }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-4 text-[11px] text-slate-500 pt-1">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-3 rounded-full" style={{ backgroundColor: SAGE }} /> Thu
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-3 rounded-full" style={{ backgroundColor: EARTHY }} /> Chi
        </span>
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-lg bg-slate-50 p-2">
      <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className="text-sm font-bold mt-0.5" style={{ color }}>{value}</div>
    </div>
  );
}
