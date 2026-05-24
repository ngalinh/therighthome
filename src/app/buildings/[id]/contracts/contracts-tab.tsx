"use client";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty";
import { ExportExcelButton } from "@/components/ui/export-button";
import { FileText, Download, Calendar, Receipt } from "lucide-react";
import { formatDateVN, formatVND, compareRooms, customerDisplayName } from "@/lib/utils";

type Contract = {
  id: string;
  code: string;
  status: string;
  startDate: string;
  endDate: string;
  isOpenEnded: boolean;
  monthlyRent: string;
  vatRate: number;
  depositAmount: string;
  generatedDocxUrl: string | null;
  contractFileUrl: string | null;
  temporaryResidenceStatus: string | null;
  temporaryResidenceExpiresAt: string | null;
  temporaryResidenceIsIndefinite: boolean;
  room: { number: string };
  customers: {
    isPrimary: boolean;
    customer: { fullName: string | null; companyName: string | null; type: string };
  }[];
};

const STATUS: Record<string, { label: string; variant: "default" | "success" | "warning" | "destructive" | "secondary" }> = {
  ACTIVE: { label: "Đang thuê", variant: "success" },
  EXPIRED: { label: "Hết hạn", variant: "secondary" },
  TERMINATED: { label: "Dừng thuê", variant: "secondary" },
  TERMINATED_LOST_DEPOSIT: { label: "Mất cọc", variant: "destructive" },
};

const STATUS_ORDER: Record<string, number> = {
  ACTIVE: 0, EXPIRED: 1, TERMINATED: 2, TERMINATED_LOST_DEPOSIT: 3,
};

const TR_STATUS: Record<string, { label: string; variant: "default" | "success" | "warning" | "secondary" }> = {
  NOT_REGISTERED: { label: "Chưa đăng ký", variant: "secondary" },
  SUBMITTED: { label: "Đã gửi hồ sơ", variant: "warning" },
  REGISTERED: { label: "Đã đăng ký", variant: "success" },
};

export function ContractsTab({
  contracts,
  buildingId,
  buildingType,
}: {
  contracts: Contract[];
  buildingId: string;
  buildingType: "CHDV" | "VP";
  canWrite: boolean;
}) {
  if (contracts.length === 0) {
    return <EmptyState icon={FileText} title="Chưa có hợp đồng nào" description="Bấm Tạo hợp đồng để bắt đầu." />;
  }

  const sorted = [...contracts].sort((a, b) => {
    const so = (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99);
    if (so !== 0) return so;
    return compareRooms(a.room.number, b.room.number);
  });

  function buildExport() {
    return [{
      name: "Hop dong",
      rows: sorted.map((c) => {
        const primary = c.customers.find((cc) => cc.isPrimary)?.customer;
        const name = customerDisplayName(primary);
        const status = STATUS[c.status]?.label ?? c.status;
        return {
          "Mã HĐ": c.code,
          "Phòng": c.room.number,
          "Khách thuê": name,
          "Trạng thái": status,
          "Bắt đầu": formatDateVN(c.startDate),
          "Kết thúc": formatDateVN(c.endDate),
          "Giá thuê": Number(c.monthlyRent),
          "VAT %": Math.round(c.vatRate * 100),
          "Cọc": Number(c.depositAmount),
        };
      }),
    }];
  }

  return (
    <>
      <div className="flex justify-end mb-2">
        <ExportExcelButton filename={`hop-dong-${buildingId}.xlsx`} sheets={buildExport} />
      </div>

      {/* Mobile: card list with gradient left bar */}
      <div className="space-y-2 lg:hidden">
        {sorted.map((c) => {
          const primary = c.customers.find((cc) => cc.isPrimary)?.customer;
          const name = customerDisplayName(primary);
          const st = STATUS[c.status] ?? { label: c.status, variant: "secondary" as const };
          const rent = BigInt(c.monthlyRent);
          const vatPct = Math.round(c.vatRate * 100);
          const deposit = BigInt(c.depositAmount);
          const isActive = c.status === "ACTIVE";
          return (
            <Link
              key={c.id}
              href={`/buildings/${buildingId}/contracts/${c.id}/edit`}
              className="flex overflow-hidden rounded-2xl bg-white border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-md transition-shadow"
            >
              {/* Brand left bar */}
              <div
                className="w-1 shrink-0"
                style={{ background: isActive ? "var(--accent-coral)" : "var(--line, #e5e7eb)" }}
              />
              <div className="flex-1 min-w-0 p-4">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="text-xs font-mono font-semibold text-slate-500 tracking-wide">{c.code}</span>
                  <Badge variant={st.variant} className="text-[10px]">{st.label}</Badge>
                </div>
                <div className="font-semibold text-sm text-slate-900 mb-0.5">{name}</div>
                <div className="flex items-center gap-1 text-xs text-slate-500 mb-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 shrink-0" />
                  Phòng <strong className="text-slate-700 ml-0.5">{c.room.number}</strong>
                  <span className="mx-1">·</span>
                  <Calendar className="h-3 w-3" />
                  {formatDateVN(c.startDate)} → {c.isOpenEnded ? <span className="text-primary font-medium ml-0.5">Vô thời hạn</span> : formatDateVN(c.endDate)}
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs pt-2 border-t border-slate-100">
                  <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                    <Receipt className="h-3 w-3" />
                    {formatVND(rent)}/tháng
                    {vatPct > 0 && <span className="text-slate-500 font-normal">(VAT {vatPct}%)</span>}
                  </span>
                  {deposit > 0n && <span className="text-slate-600">Cọc: <strong>{formatVND(deposit)}</strong></span>}
                  {(c.generatedDocxUrl || c.contractFileUrl) && (
                    <span className="flex gap-2 ml-auto">
                      {c.generatedDocxUrl && (
                        <a href={c.generatedDocxUrl} target="_blank" rel="noopener" className="text-primary" onClick={(e) => e.stopPropagation()}><Download className="h-3.5 w-3.5" /></a>
                      )}
                      {c.contractFileUrl && (
                        <a href={c.contractFileUrl} target="_blank" rel="noopener" className="text-primary" onClick={(e) => e.stopPropagation()}><FileText className="h-3.5 w-3.5" /></a>
                      )}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Desktop: table */}
      <Card className="hidden lg:block">
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 text-center">
              <th className="px-3 py-2.5">Mã HĐ</th>
              <th className="px-3 py-2.5">Trạng thái</th>
              <th className="px-3 py-2.5">Khách thuê</th>
              <th className="px-3 py-2.5">Phòng</th>
              <th className="px-3 py-2.5">Thời hạn</th>
              <th className="px-3 py-2.5">Giá thuê</th>
              <th className="px-3 py-2.5">Cọc</th>
              {buildingType === "CHDV" && <th className="px-3 py-2.5">Tạm trú</th>}
              <th className="px-3 py-2.5">File</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((c) => {
              const primary = c.customers.find((cc) => cc.isPrimary)?.customer;
              const name = customerDisplayName(primary);
              const st = STATUS[c.status] ?? { label: c.status, variant: "secondary" as const };
              const rent = BigInt(c.monthlyRent);
              const vatPct = Math.round(c.vatRate * 100);
              const deposit = BigInt(c.depositAmount);
              return (
                <tr key={c.id} className="border-t hover:bg-slate-50/60">
                  <td className="px-3 py-2.5 font-mono text-xs whitespace-nowrap">
                    <Link href={`/buildings/${buildingId}/contracts/${c.id}/edit`} className="text-primary hover:underline">
                      {c.code}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5">
                    <Badge variant={st.variant} className="text-[10px] whitespace-nowrap">{st.label}</Badge>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="line-clamp-2 break-words" style={{ maxWidth: 220, minWidth: 160 }} title={name}>{name}</div>
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">{c.room.number}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-xs text-slate-600">
                    {formatDateVN(c.startDate)} → {c.isOpenEnded ? <span className="text-primary font-medium">Vô thời hạn</span> : formatDateVN(c.endDate)}
                  </td>
                  <td className="px-3 py-2.5 text-right whitespace-nowrap">
                    <div className="font-medium text-emerald-700">{formatVND(rent)}</div>
                    {vatPct > 0 && <div className="text-[10px] text-slate-500">đã VAT {vatPct}%</div>}
                  </td>
                  <td className="px-3 py-2.5 text-right whitespace-nowrap text-xs">{formatVND(deposit)}</td>
                  {buildingType === "CHDV" && (
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      {c.temporaryResidenceStatus ? (
                        <div className="flex flex-col items-center gap-0.5">
                          <Badge variant={TR_STATUS[c.temporaryResidenceStatus]?.variant ?? "secondary"} className="text-[10px] whitespace-nowrap">
                            {TR_STATUS[c.temporaryResidenceStatus]?.label ?? c.temporaryResidenceStatus}
                          </Badge>
                          {c.temporaryResidenceStatus === "REGISTERED" && (
                            <span className="text-[10px] text-slate-500">
                              {c.temporaryResidenceIsIndefinite ? "Vô thời hạn" : c.temporaryResidenceExpiresAt ? formatDateVN(c.temporaryResidenceExpiresAt) : ""}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                  )}
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <div className="flex gap-2 text-xs">
                      {c.generatedDocxUrl && (
                        <a href={c.generatedDocxUrl} target="_blank" rel="noopener" className="text-primary hover:underline" title="HĐ.docx">
                          <Download className="h-3.5 w-3.5" />
                        </a>
                      )}
                      {c.contractFileUrl && (
                        <a href={c.contractFileUrl} target="_blank" rel="noopener" className="text-primary hover:underline" title="HĐ ký">
                          <FileText className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </CardContent>
      </Card>
    </>
  );
}
