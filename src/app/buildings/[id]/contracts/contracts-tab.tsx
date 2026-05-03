"use client";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty";
import { ExportExcelButton } from "@/components/ui/export-button";
import { FileText, Download } from "lucide-react";
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

// Sort: ACTIVE first, then others; secondary key = room number (G first).
const STATUS_ORDER: Record<string, number> = {
  ACTIVE: 0, EXPIRED: 1, TERMINATED: 2, TERMINATED_LOST_DEPOSIT: 3,
};

export function ContractsTab({
  contracts,
  buildingId,
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

      {/* Mobile: card list */}
      <div className="space-y-2 lg:hidden">
        {sorted.map((c) => {
          const primary = c.customers.find((cc) => cc.isPrimary)?.customer;
          const name = customerDisplayName(primary);
          const st = STATUS[c.status] ?? { label: c.status, variant: "secondary" as const };
          const rent = BigInt(c.monthlyRent);
          const vatPct = Math.round(c.vatRate * 100);
          const deposit = BigInt(c.depositAmount);
          return (
            <Link key={c.id} href={`/buildings/${buildingId}/contracts/${c.id}/edit`} className="block">
              <Card className="hover:bg-slate-50 transition-colors">
                <CardContent className="p-4">
                  <div className="min-w-0 mb-2">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-xs font-mono text-primary hover:underline">{c.code}</span>
                      <Badge variant={st.variant} className="text-[10px]">{st.label}</Badge>
                    </div>
                    <div className="font-medium text-sm">{name}</div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      Phòng <strong className="text-slate-700">{c.room.number}</strong> · {formatDateVN(c.startDate)} → {c.isOpenEnded ? "Vô thời hạn" : formatDateVN(c.endDate)}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs pt-2 border-t">
                    <span className="font-medium text-emerald-700">
                      {formatVND(rent)}/tháng
                      {vatPct > 0 && <span className="text-slate-500 font-normal"> (đã VAT {vatPct}%)</span>}
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
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      {/* Desktop: table */}
      <Card className="hidden lg:block">
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
              <th className="px-3 py-2.5 text-left">Mã HĐ</th>
              <th className="px-3 py-2.5 text-left">Trạng thái</th>
              <th className="px-3 py-2.5 text-left">Khách thuê</th>
              <th className="px-3 py-2.5 text-left">Phòng</th>
              <th className="px-3 py-2.5 text-left">Thời hạn</th>
              <th className="px-3 py-2.5 text-right">Giá thuê</th>
              <th className="px-3 py-2.5 text-right">Cọc</th>
              <th className="px-3 py-2.5 text-left">File</th>
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
