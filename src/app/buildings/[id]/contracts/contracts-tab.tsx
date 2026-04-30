"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty";
import { FileText, User, Calendar, Download, XCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { formatDateVN, formatVND, formatNumber, parseVNDInput } from "@/lib/utils";

type Contract = {
  id: string;
  code: string;
  status: string;
  startDate: string;
  endDate: string;
  monthlyRent: string;
  depositAmount: string;
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
  contracts, canWrite,
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
        return (
          <Card key={c.id}>
            <CardContent className="p-4">
              <div className="flex flex-wrap items-start gap-3 justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
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
                <div className="flex gap-2 items-center">
                  {c.generatedDocxUrl && (
                    <a href={c.generatedDocxUrl} target="_blank" rel="noopener" className="text-xs text-primary flex items-center gap-1 hover:underline">
                      <Download className="h-3.5 w-3.5" /> HĐ.docx
                    </a>
                  )}
                  {c.contractFileUrl && (
                    <a href={c.contractFileUrl} target="_blank" rel="noopener" className="text-xs text-primary flex items-center gap-1 hover:underline">
                      <FileText className="h-3.5 w-3.5" /> HĐ ký
                    </a>
                  )}
                  {canWrite && c.status === "ACTIVE" && (
                    <Button onClick={() => setTerminateOpen(c)} variant="ghost" size="sm" className="text-rose-600 hover:text-rose-700 hover:bg-rose-50">
                      <XCircle className="h-3.5 w-3.5" /> Kết thúc
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
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
