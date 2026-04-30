"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { formatVND, formatNumber, parseVNDInput } from "@/lib/utils";

type Opening = {
  id: string;
  kind: "CUSTOMER_REVENUE" | "PARTY_DEBT" | "CASHBOOK";
  customerId: string | null;
  partyId: string | null;
  paymentMethodLabel: string | null;
  amount: string;
  asOfMonth: number;
  asOfYear: number;
  customer: { fullName: string | null; companyName: string | null } | null;
  party: { name: string } | null;
};

const KIND_LABEL: Record<string, string> = {
  CUSTOMER_REVENUE: "Doanh thu khách",
  PARTY_DEBT: "Công nợ đối tượng",
  CASHBOOK: "Sổ quỹ (PTTT)",
};

export function OpeningBalancesForm({
  buildingId, openings, paymentMethods, customers, parties, canWrite,
}: {
  buildingId: string;
  openings: Opening[];
  paymentMethods: { id: string; name: string }[];
  customers: { id: string; fullName: string | null; companyName: string | null }[];
  parties: { id: string; name: string; kind: string }[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function deleteOne(obId: string) {
    if (!confirm("Xoá số dư này?")) return;
    const res = await fetch(`/api/buildings/${buildingId}/opening-balances?obId=${obId}`, { method: "DELETE" });
    if (!res.ok) return toast.error("Có lỗi");
    toast.success("Đã xoá");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Số dư đầu kỳ</CardTitle>
          {canWrite && (
            <Button variant="gradient" size="sm" onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" /> Thêm
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <p className="text-xs text-slate-500 mb-3">
            Cấu hình số dư đầu kỳ cho tháng đầu tiên dùng app. Báo cáo Doanh thu / Công nợ / Sổ quỹ sẽ dùng các giá trị này làm "Số dư đầu" cho tháng đó.
          </p>
          {openings.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-6">Chưa có số dư đầu kỳ nào.</p>
          ) : (
            <div className="space-y-2">
              {openings.map((o) => {
                const target = o.kind === "CUSTOMER_REVENUE"
                  ? (o.customer?.fullName || o.customer?.companyName || "—")
                  : o.kind === "PARTY_DEBT"
                  ? (o.party?.name || "—")
                  : (o.paymentMethodLabel || "—");
                return (
                  <div key={o.id} className="flex items-center justify-between rounded-xl border p-3 hover:bg-slate-50">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <Badge variant="outline" className="text-[10px]">{KIND_LABEL[o.kind]}</Badge>
                        <span className="text-xs text-slate-500">T{o.asOfMonth}/{o.asOfYear}</span>
                      </div>
                      <div className="font-medium text-sm">{target}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-semibold">{formatVND(BigInt(o.amount))}</span>
                      {canWrite && (
                        <button onClick={() => deleteOne(o.id)} className="text-slate-400 hover:text-rose-500">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <AddOpeningDialog
        open={open}
        onClose={() => setOpen(false)}
        buildingId={buildingId}
        paymentMethods={paymentMethods}
        customers={customers}
        parties={parties}
      />
    </div>
  );
}

function AddOpeningDialog({
  open, onClose, buildingId, paymentMethods, customers, parties,
}: {
  open: boolean;
  onClose: () => void;
  buildingId: string;
  paymentMethods: { id: string; name: string }[];
  customers: { id: string; fullName: string | null; companyName: string | null }[];
  parties: { id: string; name: string; kind: string }[];
}) {
  const router = useRouter();
  const now = new Date();
  const [kind, setKind] = useState<"CUSTOMER_REVENUE" | "PARTY_DEBT" | "CASHBOOK">("CUSTOMER_REVENUE");
  const [customerId, setCustomerId] = useState("");
  const [partyId, setPartyId] = useState("");
  const [pmLabel, setPmLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [loading, setLoading] = useState(false);

  async function submit() {
    const a = parseVNDInput(amount);
    setLoading(true);
    const payload: Record<string, unknown> = {
      kind,
      amount: a.toString(),
      asOfMonth: month,
      asOfYear: year,
    };
    if (kind === "CUSTOMER_REVENUE") {
      if (!customerId) { toast.error("Chọn khách"); setLoading(false); return; }
      payload.customerId = customerId;
    } else if (kind === "PARTY_DEBT") {
      if (!partyId) { toast.error("Chọn đối tượng"); setLoading(false); return; }
      payload.partyId = partyId;
    } else {
      if (!pmLabel) { toast.error("Chọn PTTT"); setLoading(false); return; }
      payload.paymentMethodLabel = pmLabel;
    }
    const res = await fetch(`/api/buildings/${buildingId}/opening-balances`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setLoading(false);
    if (!res.ok) return toast.error("Có lỗi");
    toast.success("Đã lưu");
    onClose();
    router.refresh();
    setAmount("");
    setCustomerId(""); setPartyId(""); setPmLabel("");
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Thêm số dư đầu kỳ</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Loại số dư</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as never)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="CUSTOMER_REVENUE">Doanh thu — số dư đầu của 1 khách</SelectItem>
                <SelectItem value="PARTY_DEBT">Công nợ — số dư đầu với 1 đối tượng</SelectItem>
                <SelectItem value="CASHBOOK">Sổ quỹ — số dư đầu kỳ của 1 PTTT</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {kind === "CUSTOMER_REVENUE" && (
            <div className="space-y-1.5">
              <Label className="text-xs">Khách</Label>
              <Select value={customerId} onValueChange={setCustomerId}>
                <SelectTrigger><SelectValue placeholder="Chọn khách" /></SelectTrigger>
                <SelectContent>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.fullName || c.companyName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {kind === "PARTY_DEBT" && (
            <div className="space-y-1.5">
              <Label className="text-xs">Đối tượng</Label>
              <Select value={partyId} onValueChange={setPartyId}>
                <SelectTrigger><SelectValue placeholder="Chọn đối tượng" /></SelectTrigger>
                <SelectContent>
                  {parties.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {kind === "CASHBOOK" && (
            <div className="space-y-1.5">
              <Label className="text-xs">PTTT</Label>
              <Select value={pmLabel} onValueChange={setPmLabel}>
                <SelectTrigger><SelectValue placeholder="Chọn PTTT" /></SelectTrigger>
                <SelectContent>
                  {paymentMethods.map((p) => (
                    <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Tháng</Label>
              <Input type="number" min={1} max={12} value={month} onChange={(e) => setMonth(Number(e.target.value))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Năm</Label>
              <Input type="number" min={2020} max={2100} value={year} onChange={(e) => setYear(Number(e.target.value))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Số dư (₫)</Label>
              <Input
                inputMode="numeric"
                value={amount ? formatNumber(parseVNDInput(amount)) : ""}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Huỷ</Button>
          <Button variant="gradient" onClick={submit} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Lưu
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
