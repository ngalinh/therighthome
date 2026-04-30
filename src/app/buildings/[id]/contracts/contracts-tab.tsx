"use client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty";
import { FileText, User, Calendar, DollarSign, Download } from "lucide-react";
import Link from "next/link";
import { formatDateVN, formatVND } from "@/lib/utils";

type Contract = {
  id: string;
  code: string;
  status: string;
  startDate: string;
  endDate: string;
  monthlyRent: string;
  generatedDocxUrl: string | null;
  contractFileUrl: string | null;
  room: { number: string };
  customers: { isPrimary: boolean; customer: { fullName: string | null; companyName: string | null; type: string } }[];
};

const STATUS: Record<string, { label: string; variant: "default" | "success" | "warning" | "destructive" | "secondary" }> = {
  ACTIVE: { label: "Đang thuê", variant: "success" },
  EXPIRED: { label: "Hết hạn", variant: "secondary" },
  TERMINATED: { label: "Dừng thuê", variant: "secondary" },
  TERMINATED_LOST_DEPOSIT: { label: "Mất cọc", variant: "destructive" },
};

export function ContractsTab({
  contracts,
}: {
  contracts: Contract[];
  buildingId: string;
  buildingType: "CHDV" | "VP";
  canWrite: boolean;
}) {
  if (contracts.length === 0) {
    return <EmptyState icon={FileText} title="Chưa có hợp đồng nào" description="Bấm Tạo hợp đồng để bắt đầu." />;
  }

  return (
    <div className="space-y-3">
      {contracts.map((c) => {
        const primary = c.customers.find((cc) => cc.isPrimary)?.customer;
        const name = primary?.fullName || primary?.companyName || "—";
        const st = STATUS[c.status] ?? { label: c.status, variant: "secondary" as const };
        return (
          <Card key={c.id}>
            <CardContent className="p-4">
              <div className="flex flex-wrap items-start gap-3 justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-mono text-slate-500">{c.code}</span>
                    <Badge variant={st.variant}>{st.label}</Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                    <span className="flex items-center gap-1.5">
                      <User className="h-4 w-4 text-slate-400" /> {name}
                    </span>
                    <span className="flex items-center gap-1.5 text-slate-600">
                      Phòng <span className="font-medium">{c.room.number}</span>
                    </span>
                    <span className="flex items-center gap-1.5 text-slate-600">
                      <Calendar className="h-4 w-4 text-slate-400" />
                      {formatDateVN(c.startDate)} → {formatDateVN(c.endDate)}
                    </span>
                    <span className="flex items-center gap-1.5 font-medium text-emerald-700">
                      {formatVND(BigInt(c.monthlyRent))} /tháng
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  {c.generatedDocxUrl && (
                    <a
                      href={c.generatedDocxUrl}
                      target="_blank"
                      rel="noopener"
                      className="text-xs text-primary flex items-center gap-1 hover:underline"
                    >
                      <Download className="h-3.5 w-3.5" /> HĐ.docx
                    </a>
                  )}
                  {c.contractFileUrl && (
                    <a
                      href={c.contractFileUrl}
                      target="_blank"
                      rel="noopener"
                      className="text-xs text-primary flex items-center gap-1 hover:underline"
                    >
                      <FileText className="h-3.5 w-3.5" /> HĐ ký
                    </a>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
