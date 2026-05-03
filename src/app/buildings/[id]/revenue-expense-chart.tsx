"use client";
import { formatVND } from "@/lib/utils";

type Point = { month: number; year: number; income: number; expense: number };

const MONTH_LABELS = ["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8", "T9", "T10", "T11", "T12"];

export function RevenueExpenseChart({ series }: { series: Point[] }) {
  const maxVal = Math.max(1, ...series.flatMap((p) => [p.income, p.expense]));
  const totalIncome = series.reduce((s, p) => s + p.income, 0);
  const totalExpense = series.reduce((s, p) => s + p.expense, 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2 text-xs">
        <Stat label="Tổng thu" value={formatVND(totalIncome)} className="text-emerald-700" />
        <Stat label="Tổng chi" value={formatVND(totalExpense)} className="text-rose-700" />
        <Stat label="Chênh lệch" value={formatVND(totalIncome - totalExpense)} className={totalIncome - totalExpense >= 0 ? "text-emerald-700" : "text-rose-700"} />
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
                  <span className="text-emerald-700">{formatVND(p.income)}</span>
                  <span className="text-rose-700">{formatVND(p.expense)}</span>
                </span>
              </div>
              <div className="space-y-0.5">
                <div className="h-2 rounded-full bg-emerald-50 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 transition-all"
                    style={{ width: `${incomePct}%` }}
                  />
                </div>
                <div className="h-2 rounded-full bg-rose-50 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-rose-400 to-rose-500 transition-all"
                    style={{ width: `${expensePct}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-4 text-[11px] text-slate-500 pt-1">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-3 rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500" /> Thu
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-3 rounded-full bg-gradient-to-r from-rose-400 to-rose-500" /> Chi
        </span>
      </div>
    </div>
  );
}

function Stat({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className="rounded-lg bg-slate-50 p-2">
      <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`text-sm font-bold mt-0.5 ${className ?? ""}`}>{value}</div>
    </div>
  );
}
