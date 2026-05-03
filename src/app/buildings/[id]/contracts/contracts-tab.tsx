"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  FileText, User, Calendar, Download, XCircle, Loader2, Edit, Receipt,
} from "lucide-react";
import { toast } from "sonner";
import { formatDateVN, formatVND, formatNumber, parseVNDInput } from "@/lib/utils";

type Contract = {
  id: string;
  code: string;
  status: string;
  startDate: string;
  endDate: string;
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

export function ContractsTab({
  contracts,
  buildingId,
  canWrite,
}: {
  contracts: Contract[];
  buildingId: string;
  buildingType: "CHDV" | "VP";
  canWrite: boolean;
}) {
  const [terminateOpen, setTerminateOpen] = useState<Contract | null>(null);

  if (contracts.length === 0) {
    return <EmptyState icon={FileText} title="Chưa có hợp đồng nào" description="Bấm Tạo hợp đồng để bắt đầu." />;
  }

  return (
    <div className="space-y-3">
      {contracts.map((c) => {
        const primary = c.customers.find((cc) => cc.isPrimary)?.customer;
        const name = primary?.fullName || primary?.companyName || "—";
        const st = STATUS[c.status] ?? { label: c.status, variant: "secondary" as const };
        const rent = BigInt(c.monthlyRent);
        const vatPct = Math.round(c.vatRate * 100);
        const vatAmount = (rent * BigInt(Math.round(c.vatRate * 100))) / 100n;
        const deposit = BigInt(c.depositAmount);
        const isActive = c.status === "ACTIVE";
        return (
          <div
            key={c.id}
            className="flex overflow-hidden rounded-2xl bg-white border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_-12px_rgba(99,102,241,0.08)]"
          >
            {/* Left accent bar */}
            <div className={`w-1 shrink-0 ${isActive ? "bg-gradient-to-b from-indigo-500 via-purple-500 to-pink-500" : "bg-slate-200"}`} />

            <div className="flex-1 min-w-0 p-4">
              {/* Top row: code + badge */}
              <div className="flex items-center justify-between gap-2 mb-2.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs font-semibold text-slate-500 tracking-wide">{c.code}</span>
                  <Badge variant={st.variant}>{st.label}</Badge>
                </div>
                <div className="flex flex-wrap gap-1.5 items-center shrink-0">
                  {c.generatedDocxUrl && (
                    <a href={c.generatedDocxUrl} target="_blank" rel="noopener"
                      className="text-xs text-primary flex items-center gap-1 px-2 py-1 rounded-lg bg-primary/8 hover:bg-primary/15 transition-colors font-medium">
                      <Download className="h-3 w-3" /> DOCX
                    </a>
                  )}
                  {c.contractFileUrl && (
                    <a href={c.contractFileUrl} target="_blank" rel="noopener"
                      className="text-xs text-primary flex items-center gap-1 px-2 py-1 rounded-lg bg-primary/8 hover:bg-primary/15 transition-colors font-medium">
                      <FileText className="h-3 w-3" /> HĐ ký
                    </a>
                  )}
                  {canWrite && (
                    <Button asChild variant="outline" size="sm" className="h-7 text-xs px-2.5">
                      <Link href={`/buildings/${buildingId}/contracts/${c.id}/edit`}>
                        <Edit className="h-3.5 w-3.5" /> Sửa
                      </Link>
                    </Button>
                  )}
                  {canWrite && isActive && (
                    <Button onClick={() => setTerminateOpen(c)} variant="ghost" size="sm"
                      className="h-7 text-xs px-2.5 text-rose-600 hover:text-rose-700 hover:bg-rose-50">
                      <XCircle className="h-3.5 w-3.5" /> Kết thúc
                    </Button>
                  )}
                </div>
              </div>

              {/* Tenant name */}
              <div className="flex items-center gap-2 mb-1.5">
                <div className="h-7 w-7 rounded-full bg-gradient-brand flex items-center justify-center text-white text-xs font-bold shrink-0">
                  {name.charAt(0).toUpperCase()}
                </div>
                <span className="font-semibold text-slate-900 text-sm">{name}</span>
              </div>

              {/* Room + dates */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 mb-2">
                <span className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 shrink-0" />
                  Phòng <span className="font-semibold text-slate-700 ml-0.5">{c.room.number}</span>
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5 text-slate-400" />
                  {formatDateVN(c.startDate)} → {formatDateVN(c.endDate)}
                </span>
              </div>

              {/* Rent + deposit */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg">
                  <Receipt className="h-3.5 w-3.5" />
                  {formatVND(rent)}/tháng
                  {vatPct > 0 && <span className="font-normal text-slate-500">(VAT {vatPct}%)</span>}
                </span>
                {deposit > 0n && (
                  <span className="text-xs text-slate-500">
                    Cọc: <span className="font-semibold text-slate-700">{formatVND(deposit)}</span>
                  </span>
                )}
                {vatPct > 0 && rent > 0n && (
                  <span className="text-xs text-slate-400 hidden sm:inline">
                    ({formatVND(rent - vatAmount)} + {formatVND(vatAmount)} VAT)
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}

      <TerminateDialog contract={terminateOpen} onClose={() => setTerminateOpen(null)} />
    </div>
  );
}

function TerminateDialog({ contract, onClose }: { contract: Contract | null; onClose: () => void }) {
  const router = useRouter();
  const [reason, setReason] = useState<"EXPIRED" | "TERMINATED" | "TERMINATED_LOST_DEPOSIT">("TERMINATED");
  const [terminatedAt, setTerminatedAt] = useState(new Date().toISOString().slice(0, 10));
  const [refund, setRefund] = useState("");
  const [loading, setLoading] = useState(false);

  if (!contract) return null;
  const lostDeposit = reason === "TERMINATED_LOST_DEPOSIT";

  async function submit() {
    setLoading(true);
    const res = await fetch(`/api/contracts/${contract!.id}/terminate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reason,
        terminatedAt,
        depositRefund: !lostDeposit && refund ? parseVNDInput(refund).toString() : undefined,
      }),
    });
    setLoading(false);
    if (!res.ok) return toast.error("Có lỗi");
    toast.success(
      lostDeposit
        ? "Đã kết thúc HĐ - tiền cọc đã hạch toán vào doanh thu"
        : "Đã kết thúc HĐ"
    );
    onClose();
    router.refresh();
  }

  return (
    <Dialog open={!!contract} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Kết thúc HĐ {contract.code}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Lý do</Label>
            <Select value={reason} onValueChange={(v) => setReason(v as never)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="EXPIRED">Hết hạn HĐ</SelectItem>
                <SelectItem value="TERMINATED">Dừng thuê (trả cọc bình thường)</SelectItem>
                <SelectItem value="TERMINATED_LOST_DEPOSIT">Dừng thuê - mất cọc</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Ngày kết thúc</Label>
            <Input type="date" value={terminatedAt} onChange={(e) => setTerminatedAt(e.target.value)} />
          </div>
          {lostDeposit ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
              Tiền cọc <strong>{formatVND(BigInt(contract.depositAmount))}</strong> sẽ tự động hạch toán vào doanh thu (loại "Tiền cọc mất").
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label className="text-xs">Tiền cọc đã trả lại (₫)</Label>
              <Input
                inputMode="numeric"
                value={refund ? formatNumber(parseVNDInput(refund)) : ""}
                onChange={(e) => setRefund(e.target.value)}
                placeholder={formatNumber(BigInt(contract.depositAmount))}
              />
              <button type="button" className="text-xs text-primary" onClick={() => setRefund(contract.depositAmount)}>
                Trả đủ {formatVND(BigInt(contract.depositAmount))}
              </button>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Huỷ</Button>
          <Button variant="destructive" onClick={submit} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Xác nhận kết thúc
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
