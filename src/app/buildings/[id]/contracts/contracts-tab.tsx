"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
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
  FileText, Download, XCircle, Loader2, Edit, Trash2,
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

// Sort: ACTIVE first, then others by startDate desc
const STATUS_ORDER: Record<string, number> = {
  ACTIVE: 0, EXPIRED: 1, TERMINATED: 2, TERMINATED_LOST_DEPOSIT: 3,
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
  const router = useRouter();
  const [terminateOpen, setTerminateOpen] = useState<Contract | null>(null);
  const [deleteOpen, setDeleteOpen] = useState<Contract | null>(null);

  if (contracts.length === 0) {
    return <EmptyState icon={FileText} title="Chưa có hợp đồng nào" description="Bấm Tạo hợp đồng để bắt đầu." />;
  }

  const sorted = [...contracts].sort((a, b) => {
    const so = (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99);
    if (so !== 0) return so;
    return new Date(b.startDate).getTime() - new Date(a.startDate).getTime();
  });

  async function deleteContract(c: Contract) {
    const res = await fetch(`/api/contracts/${c.id}`, { method: "DELETE" });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return toast.error(err.error || "Có lỗi");
    }
    toast.success(`Đã xoá HĐ ${c.code}`);
    setDeleteOpen(null);
    router.refresh();
  }

  return (
    <Card>
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
              <th className="px-3 py-2.5 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((c) => {
              const primary = c.customers.find((cc) => cc.isPrimary)?.customer;
              const name = primary?.fullName || primary?.companyName || "—";
              const st = STATUS[c.status] ?? { label: c.status, variant: "secondary" as const };
              const rent = BigInt(c.monthlyRent);
              const vatPct = Math.round(c.vatRate * 100);
              const deposit = BigInt(c.depositAmount);
              return (
                <tr key={c.id} className="border-t hover:bg-slate-50/60">
                  <td className="px-3 py-2.5 font-mono text-xs whitespace-nowrap">{c.code}</td>
                  <td className="px-3 py-2.5">
                    <Badge variant={st.variant} className="text-[10px] whitespace-nowrap">{st.label}</Badge>
                  </td>
                  <td className="px-3 py-2.5 max-w-[180px] truncate" title={name}>{name}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap">{c.room.number}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-xs text-slate-600">
                    {formatDateVN(c.startDate)} → {formatDateVN(c.endDate)}
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
                  <td className="px-3 py-2.5 text-right">
                    <div className="flex gap-1 justify-end">
                      {canWrite && (
                        <>
                          <Button asChild variant="outline" size="sm" className="h-7 px-2">
                            <Link href={`/buildings/${buildingId}/contracts/${c.id}/edit`}>
                              <Edit className="h-3 w-3" />
                            </Link>
                          </Button>
                          {c.status === "ACTIVE" && (
                            <Button
                              onClick={() => setTerminateOpen(c)}
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-rose-600 hover:bg-rose-50"
                              title="Kết thúc"
                            >
                              <XCircle className="h-3 w-3" />
                            </Button>
                          )}
                          <Button
                            onClick={() => setDeleteOpen(c)}
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-rose-600 hover:bg-rose-50"
                            title="Xoá"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </CardContent>

      <TerminateDialog contract={terminateOpen} onClose={() => setTerminateOpen(null)} />

      {/* Delete confirmation */}
      <Dialog open={!!deleteOpen} onOpenChange={(o) => !o && setDeleteOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-rose-600">Xoá hợp đồng</DialogTitle>
          </DialogHeader>
          {deleteOpen && (
            <div className="text-sm space-y-2">
              <p>Xoá vĩnh viễn hợp đồng <strong className="font-mono">{deleteOpen.code}</strong> không?</p>
              <p className="text-xs text-slate-500">
                Sẽ xoá kèm tất cả hoá đơn của HĐ này. Giao dịch liên quan sẽ tự gỡ liên kết invoice (vẫn giữ được record).
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteOpen(null)}>Huỷ</Button>
            <Button variant="destructive" onClick={() => deleteOpen && deleteContract(deleteOpen)}>
              Xoá vĩnh viễn
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
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
    toast.success(lostDeposit ? "Đã kết thúc HĐ - tiền cọc đã hạch toán vào doanh thu" : "Đã kết thúc HĐ");
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
