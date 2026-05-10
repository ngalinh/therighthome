"use client";
import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight } from "lucide-react";
import { formatVND, formatDateVN } from "@/lib/utils";

export type DetailRow = {
  txId: string;
  date: string;       // ISO
  amount: string;     // BigInt as string
  content: string;
  partyLabel: string;
  roomNumber: string | null;
  invoiceId: string | null;
  invoiceCode: string | null;
};

type Row = {
  name: string;
  total: string;      // BigInt as string
  details: DetailRow[];
};

export function PnLBreakdownTable({
  buildingId, rows, total, accent,
}: {
  buildingId: string;
  rows: Row[];
  total: string;
  accent: "emerald" | "rose";
}) {
  const [openName, setOpenName] = useState<string | null>(null);
  if (rows.length === 0) {
    return <p className="px-4 py-6 text-center text-sm text-slate-500">Không có dữ liệu</p>;
  }
  const totalN = BigInt(total);
  return (
    <div className="text-sm">
      {rows.map((r) => {
        const amt = BigInt(r.total);
        const pct = totalN > 0n ? Number(amt * 1000n / totalN) / 10 : 0;
        const isOpen = openName === r.name;
        return (
          <div key={r.name} className="border-b last:border-0">
            <button
              type="button"
              onClick={() => setOpenName(isOpen ? null : r.name)}
              className="w-full text-left px-4 py-2.5 hover:bg-slate-50/60 focus:outline-none focus:bg-slate-50"
            >
              <div className="flex justify-between items-baseline mb-1 gap-2">
                <span className="font-medium flex items-center gap-1">
                  {isOpen ? <ChevronDown className="h-3.5 w-3.5 text-slate-400" /> : <ChevronRight className="h-3.5 w-3.5 text-slate-400" />}
                  {r.name}
                  <span className="text-[11px] text-slate-400 font-normal">({r.details.length})</span>
                </span>
                <span className="font-semibold tabular-nums">{formatVND(amt)}</span>
              </div>
              <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden ml-4">
                <div
                  className={`h-full ${accent === "emerald" ? "bg-emerald-500" : "bg-rose-500"}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5 ml-4">{pct.toFixed(1)}%</div>
            </button>
            {isOpen && (
              <div className="bg-slate-50/40 border-t">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-wider text-slate-500">
                      <th className="px-4 py-1.5 text-left">Ngày</th>
                      <th className="px-2 py-1.5 text-left">Phòng / Đối tượng</th>
                      <th className="px-2 py-1.5 text-left">Nội dung</th>
                      <th className="px-4 py-1.5 text-right">Số tiền</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.details.map((d, idx) => (
                      <tr key={`${d.txId}-${idx}`} className="border-t border-slate-200/60">
                        <td className="px-4 py-1.5 whitespace-nowrap">{formatDateVN(d.date)}</td>
                        <td className="px-2 py-1.5">
                          <div>
                            {d.roomNumber && <span className="font-medium">{d.roomNumber}</span>}
                            {d.roomNumber && d.partyLabel && <span className="text-slate-400"> · </span>}
                            {d.partyLabel && <span>{d.partyLabel}</span>}
                          </div>
                        </td>
                        <td className="px-2 py-1.5">
                          <div className="line-clamp-2">
                            {d.invoiceId && d.invoiceCode ? (
                              <>
                                <span className="text-slate-600">{d.content.replace(d.invoiceCode, "").trim() || "Hoá đơn"} · </span>
                                <Link
                                  href={`/buildings/${buildingId}/invoices/${d.invoiceId}`}
                                  className="text-primary hover:underline"
                                >
                                  {d.invoiceCode}
                                </Link>
                              </>
                            ) : (
                              <span className="text-slate-600">{d.content}</span>
                            )}
                          </div>
                        </td>
                        <td className={`px-4 py-1.5 text-right tabular-nums font-medium ${accent === "emerald" ? "text-emerald-700" : "text-rose-700"}`}>
                          {formatVND(BigInt(d.amount))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
