"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty";
import { Receipt, Send, Plus, Loader2, DollarSign } from "lucide-react";
import { toast } from "sonner";
import { formatVND, formatNumber, parseVNDInput, formatDateVN } from "@/lib/utils";

type Invoice = {
  id: string;
  code: string;
  month: number;
  year: number;
  dueDate: string;
  status: string;
  rentAmount: string;
  vatAmount: string;
  electricityFee: string;
  parkingFee: string;
  overtimeFee: string;
  serviceFee: string;
  totalAmount: string;
  paidAmount: string;
  sentAt: string | null;
  notes: string | null;
  contract: {
    id: string;
    room: { number: string };
    customers: { customer: { fullName: string | null; companyName: string | null; email: string | null } }[];
  };
};

const STATUS: Record<string, { label: string; variant: "secondary" | "warning" | "success" | "destructive" }> = {
  PENDING: { label: "Chờ thanh toán", variant: "warning" },
  PARTIAL: { label: "Thanh toán 1 phần", variant: "warning" },
  PAID: { label: "Đã thanh toán", variant: "success" },
  OVERDUE: { label: "Quá hạn", variant: "destructive" },
  CANCELLED: { label: "Đã huỷ", variant: "secondary" },
};

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

export function InvoicesView({
  buildingId, month, year, status, invoices, paymentMethods, canWrite, canSend,
}: {
  buildingId: string;
  buildingType: "CHDV" | "VP";
  month: number;
  year: number;
  status: string;
  invoices: Invoice[];
  paymentMethods: { id: string; name: string }[];
  canWrite: boolean;
  canSend: boolean;
}) {
  const router = useRouter();
  const [generating, setGenerating] = useState(false);
  const [payOpen, setPayOpen] = useState<Invoice | null>(null);
  const [sending, setSending] = useState<string | null>(null);

  function navigate(m: number, y: number, s: string) {
    const sp = new URLSearchParams();
    sp.set("month", String(m));
    sp.set("year", String(y));
    if (s !== "ALL") sp.set("status", s);
    router.push(`/buildings/${buildingId}/invoices?${sp.toString()}`);
  }

  async function generate() {
    setGenerating(true);
    const res = await fetch(`/api/buildings/${buildingId}/invoices`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month, year }),
    });
    setGenerating(false);
    if (!res.ok) return toast.error("Tạo hoá đơn thất bại");
    const { created } = await res.json();
    toast.success(created > 0 ? `Đã tạo ${created} hoá đơn` : "Tất cả HĐ đã tồn tại");
    router.refresh();
  }

  async function send(inv: Invoice) {
    const primary = inv.contract.customers[0]?.customer;
    if (!primary?.email) return toast.error("Khách thuê chưa có email");
    setSending(inv.id);
    const res = await fetch(`/api/invoices/${inv.id}/send`, { method: "POST" });
    setSending(null);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return toast.error(err.error || "Gửi thất bại");
    }
    toast.success("Đã gửi email");
    router.refresh();
  }

  // Stats
  const totalDue = invoices.reduce((s, i) => s + Number(i.totalAmount), 0);
  const totalPaid = invoices.reduce((s, i) => s + Number(i.paidAmount), 0);
  const overdueCount = invoices.filter((i) => i.status === "OVERDUE").length;

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <Select value={String(month)} onValueChange={(v) => navigate(Number(v), year, status)}>
          <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {MONTHS.map((m) => <SelectItem key={m} value={String(m)}>Tháng {m}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={String(year)} onValueChange={(v) => navigate(month, Number(v), status)}>
          <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {[year - 1, year, year + 1].map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={(v) => navigate(month, year, v)}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Tất cả trạng thái</SelectItem>
            {Object.entries(STATUS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="ml-auto flex gap-2">
          {canWrite && (
            <Button onClick={generate} variant="gradient" disabled={generating}>
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Tạo HĐ tháng này
            </Button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MiniStat label="Tổng phải thu" value={formatVND(totalDue)} />
        <MiniStat label="Đã thu" value={formatVND(totalPaid)} positive />
        <MiniStat label="Còn lại" value={formatVND(totalDue - totalPaid)} warning />
        <MiniStat label="Quá hạn" value={String(overdueCount)} danger />
      </div>

      {/* List */}
      {invoices.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="Chưa có hoá đơn"
          description={`Bấm "Tạo HĐ tháng này" để tự tạo cho tất cả HĐ đang hoạt động.`}
        />
      ) : (
        <div className="space-y-2">
          {invoices.map((inv) => (
            <InvoiceRow
              key={inv.id}
              inv={inv}
              canWrite={canWrite}
              canSend={canSend}
              sending={sending === inv.id}
              buildingId={buildingId}
              onSend={() => send(inv)}
              onPay={() => setPayOpen(inv)}
            />
          ))}
        </div>
      )}

      {/* Pay dialog */}
      <PayDialog
        invoice={payOpen}
        paymentMethods={paymentMethods}
        onClose={() => setPayOpen(null)}
        onSuccess={() => { setPayOpen(null); router.refresh(); }}
      />
    </div>
  );
}

function MiniStat({ label, value, positive, warning, danger }: { label: string; value: string; positive?: boolean; warning?: boolean; danger?: boolean }) {
  const color = danger ? "text-rose-600" : warning ? "text-amber-600" : positive ? "text-emerald-600" : "";
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-slate-500">{label}</div>
        <div className={`text-lg font-bold mt-1 ${color}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

function InvoiceRow({ inv, canWrite, canSend, sending, buildingId, onSend, onPay }: {
  inv: Invoice;
  canWrite: boolean;
  canSend: boolean;
  sending: boolean;
  buildingId: string;
  onSend: () => void;
  onPay: () => void;
}) {
  const primary = inv.contract.customers[0]?.customer;
  const name = primary?.fullName || primary?.companyName || "—";
  const st = STATUS[inv.status] ?? { label: inv.status, variant: "secondary" as const };
  const remaining = BigInt(inv.totalAmount) - BigInt(inv.paidAmount);
  const overdueDays = inv.status === "OVERDUE" ? Math.max(1, Math.ceil((Date.now() - new Date(inv.dueDate).getTime()) / (24 * 3600 * 1000))) : null;

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex flex-wrap items-start gap-3 justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-xs font-mono text-slate-500">{inv.code}</span>
              <Badge variant={st.variant}>
                {st.label}
                {overdueDays !== null && ` ${overdueDays}d`}
              </Badge>
              {inv.sentAt && <Badge variant="secondary" className="text-[10px]">Đã gửi</Badge>}
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <span className="font-medium">Phòng {inv.contract.room.number}</span>
              <span className="text-slate-700">{name}</span>
              <span className="text-slate-500">Hạn: {formatDateVN(inv.dueDate)}</span>
              <span className="font-semibold text-emerald-700">{formatVND(BigInt(inv.totalAmount))}</span>
              {remaining > 0n && (
                <span className="text-rose-600 text-xs">Còn {formatVND(remaining)}</span>
              )}
            </div>
          </div>
          <div className="flex gap-1.5 items-center">
            <Button asChild variant="outline" size="sm">
              <Link href={`/buildings/${buildingId}/invoices/${inv.id}`}>Chi tiết</Link>
            </Button>
            {canWrite && inv.status !== "PAID" && inv.status !== "CANCELLED" && (
              <Button onClick={onPay} variant="gradient" size="sm">
                <DollarSign className="h-3.5 w-3.5" /> Ghi nhận
              </Button>
            )}
            {canSend && primary?.email && inv.status !== "CANCELLED" && (
              <Button onClick={onSend} variant="ghost" size="sm" disabled={sending}>
                {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function PayDialog({
  invoice, paymentMethods, onClose, onSuccess,
}: {
  invoice: Invoice | null;
  paymentMethods: { id: string; name: string }[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [pmId, setPmId] = useState<string>("");
  const [paidAt, setPaidAt] = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);

  if (!invoice) return null;
  const remaining = BigInt(invoice.totalAmount) - BigInt(invoice.paidAmount);

  async function submit() {
    const a = parseVNDInput(amount);
    if (a <= 0n) return toast.error("Số tiền > 0");
    setLoading(true);
    const res = await fetch(`/api/invoices/${invoice!.id}/pay`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: a.toString(), paymentMethodId: pmId || undefined, paidAt }),
    });
    setLoading(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return toast.error(err.error || "Có lỗi");
    }
    toast.success("Đã ghi nhận thanh toán");
    onSuccess();
  }

  return (
    <Dialog open={!!invoice} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ghi nhận thanh toán — {invoice.code}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="text-sm text-slate-600">Còn lại: <strong>{formatVND(remaining)}</strong></div>
          <div className="space-y-1.5">
            <Label>Số tiền nhận</Label>
            <Input
              inputMode="numeric"
              value={amount ? formatNumber(parseVNDInput(amount)) : ""}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={formatNumber(remaining)}
            />
            <button type="button" className="text-xs text-primary" onClick={() => setAmount(remaining.toString())}>
              Dùng số còn lại
            </button>
          </div>
          <div className="space-y-1.5">
            <Label>Ngày thanh toán</Label>
            <Input type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Phương thức thanh toán</Label>
            <Select value={pmId} onValueChange={setPmId}>
              <SelectTrigger><SelectValue placeholder="Chọn PTTT" /></SelectTrigger>
              <SelectContent>
                {paymentMethods.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Huỷ</Button>
          <Button variant="gradient" onClick={submit} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Ghi nhận
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
