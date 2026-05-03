"use client";
import { useMemo, useState } from "react";
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

type BuildingLite = { id: string; name: string };
type RoomLite = { id: string; buildingId: string; number: string };

type Invoice = {
  id: string;
  code: string;
  buildingId: string;
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
  building: { id: string; name: string };
  contract: {
    id: string;
    roomId: string;
    room: { number: string };
    customers: { customer: { fullName: string | null; companyName: string | null; email: string | null } }[];
  };
};

const STATUS: Record<string, { label: string; variant: "secondary" | "warning" | "success" | "destructive" }> = {
  PENDING: { label: "Chờ thanh toán", variant: "warning" },
  PARTIAL: { label: "TT một phần", variant: "warning" },
  PAID: { label: "Đã thanh toán", variant: "success" },
  OVERDUE: { label: "Quá hạn", variant: "destructive" },
  CANCELLED: { label: "Đã huỷ", variant: "secondary" },
};

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

export function AggregatedInvoicesView({
  buildingType, buildings, rooms, month, year, status, buildingFilter, roomFilter,
  invoices, paymentMethods, canWrite, canSend,
}: {
  buildingType: "CHDV" | "VP";
  buildings: BuildingLite[];
  rooms: RoomLite[];
  month: number;
  year: number;
  status: string;
  buildingFilter: string; // "ALL" or buildingId
  roomFilter: string; // "ALL" or roomId
  invoices: Invoice[];
  paymentMethods: { id: string; name: string }[];
  canWrite: boolean;
  canSend: boolean;
}) {
  const router = useRouter();
  const [generating, setGenerating] = useState(false);
  const [payOpen, setPayOpen] = useState<Invoice | null>(null);
  const [sending, setSending] = useState<string | null>(null);

  const filteredRooms = useMemo(
    () => buildingFilter === "ALL" ? [] : rooms.filter((r) => r.buildingId === buildingFilter),
    [rooms, buildingFilter],
  );

  function navigate(next: Partial<{ month: number; year: number; status: string; building: string; room: string }>) {
    const sp = new URLSearchParams();
    sp.set("tab", "invoices");
    sp.set("month", String(next.month ?? month));
    sp.set("year", String(next.year ?? year));
    const s = next.status ?? status;
    if (s !== "ALL") sp.set("status", s);
    const b = next.building ?? buildingFilter;
    if (b !== "ALL") sp.set("building", b);
    const r = next.room ?? roomFilter;
    if (r !== "ALL" && (next.building ?? buildingFilter) !== "ALL") sp.set("room", r);
    const base = buildingType === "CHDV" ? "/manage/chdv" : "/manage/vp";
    router.push(`${base}?${sp.toString()}`);
  }

  async function generate() {
    if (buildingFilter === "ALL") {
      // Generate for all buildings of this type
      if (!confirm(`Tạo hoá đơn tháng ${month}/${year} cho toàn bộ ${buildingType === "CHDV" ? "Căn hộ DV" : "Văn phòng"}?`)) return;
      setGenerating(true);
      let total = 0;
      for (const b of buildings) {
        const res = await fetch(`/api/buildings/${b.id}/invoices`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ month, year }),
        });
        if (res.ok) {
          const { created } = await res.json();
          total += created;
        }
      }
      setGenerating(false);
      toast.success(total > 0 ? `Đã tạo ${total} hoá đơn` : "Tất cả HĐ đã tồn tại");
      router.refresh();
      return;
    }
    setGenerating(true);
    const res = await fetch(`/api/buildings/${buildingFilter}/invoices`, {
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

  const totalDue = invoices.reduce((s, i) => s + Number(i.totalAmount), 0);
  const totalPaid = invoices.reduce((s, i) => s + Number(i.paidAmount), 0);
  const overdueCount = invoices.filter((i) => i.status === "OVERDUE").length;

  const isVP = buildingType === "VP";

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <Select value={String(month)} onValueChange={(v) => navigate({ month: Number(v) })}>
          <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {MONTHS.map((m) => <SelectItem key={m} value={String(m)}>Tháng {m}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={String(year)} onValueChange={(v) => navigate({ year: Number(v) })}>
          <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {[year - 1, year, year + 1].map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={(v) => navigate({ status: v })}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Tất cả trạng thái</SelectItem>
            {Object.entries(STATUS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={buildingFilter} onValueChange={(v) => navigate({ building: v, room: "ALL" })}>
          <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Tất cả toà nhà</SelectItem>
            {buildings.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
          </SelectContent>
        </Select>
        {buildingFilter !== "ALL" && (
          <Select value={roomFilter} onValueChange={(v) => navigate({ room: v })}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Tất cả phòng</SelectItem>
              {filteredRooms.map((r) => <SelectItem key={r.id} value={r.id}>Phòng {r.number}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        <div className="ml-auto flex gap-2">
          {canWrite && (
            <Button onClick={generate} variant="gradient" disabled={generating}>
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {buildingFilter === "ALL" ? "Tạo HĐ toàn bộ" : "Tạo HĐ tháng này"}
            </Button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <GradStat label="Tổng phải thu" value={formatVND(totalDue)} gradient="from-slate-500 to-slate-700" />
        <GradStat label="Đã thu" value={formatVND(totalPaid)} gradient="from-emerald-500 to-teal-500" />
        <GradStat label="Còn lại" value={formatVND(totalDue - totalPaid)} gradient="from-amber-400 to-orange-500" />
        <GradStat label="Quá hạn" value={`${overdueCount} HĐ`} gradient="from-rose-500 to-pink-500" />
      </div>

      {invoices.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="Chưa có hoá đơn"
          description={`Bấm "Tạo HĐ" để tự tạo cho tất cả HĐ đang hoạt động.`}
        />
      ) : (
        <>
          {/* Mobile cards */}
          <div className="space-y-2 lg:hidden">
            {invoices.map((inv) => (
              <InvoiceCard
                key={inv.id}
                inv={inv}
                canWrite={canWrite}
                canSend={canSend}
                sending={sending === inv.id}
                onSend={() => send(inv)}
                onPay={() => setPayOpen(inv)}
              />
            ))}
          </div>

          {/* Desktop table */}
          <Card className="hidden lg:block">
            <CardContent className="p-0 overflow-x-auto">
              <InvoiceTable
                invoices={invoices}
                isVP={isVP}
                canWrite={canWrite}
                canSend={canSend}
                sending={sending}
                onSend={send}
                onPay={(inv) => setPayOpen(inv)}
              />
            </CardContent>
          </Card>
        </>
      )}

      <PayDialog
        invoice={payOpen}
        paymentMethods={paymentMethods}
        onClose={() => setPayOpen(null)}
        onSuccess={() => { setPayOpen(null); router.refresh(); }}
      />
    </div>
  );
}

function GradStat({ label, value, gradient }: { label: string; value: string; gradient: string }) {
  return (
    <div className={`stat-tile bg-gradient-to-br ${gradient}`}>
      <div className="relative">
        <div className="text-[11px] font-medium text-white/80 uppercase tracking-wide">{label}</div>
        <div className="text-xl font-bold mt-1 leading-tight">{value}</div>
      </div>
    </div>
  );
}

function InvoiceTable({
  invoices, isVP, canWrite, canSend, sending, onSend, onPay,
}: {
  invoices: Invoice[];
  isVP: boolean;
  canWrite: boolean;
  canSend: boolean;
  sending: string | null;
  onSend: (inv: Invoice) => void;
  onPay: (inv: Invoice) => void;
}) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
          <th className="px-3 py-2.5 text-left">Toà nhà</th>
          <th className="px-3 py-2.5 text-left">Phòng / Mã HĐ</th>
          <th className="px-3 py-2.5 text-left">Khách thuê</th>
          <th className="px-3 py-2.5 text-center">Hạn TT / Tình trạng</th>
          <th className="px-3 py-2.5 text-right">Tiền thuê</th>
          <th className="px-3 py-2.5 text-right">Tiền điện</th>
          <th className="px-3 py-2.5 text-right">Phí xe</th>
          <th className="px-3 py-2.5 text-right">{isVP ? "Phí ngoài giờ" : "Phí DV"}</th>
          <th className="px-3 py-2.5 text-right">Tổng</th>
          <th className="px-3 py-2.5 text-right">Đã thu</th>
          <th className="px-3 py-2.5 text-right">Còn lại</th>
          <th className="px-3 py-2.5 text-right">Thao tác</th>
        </tr>
      </thead>
      <tbody>
        {invoices.map((inv) => {
          const primary = inv.contract.customers[0]?.customer;
          const name = primary?.fullName || primary?.companyName || "—";
          const st = STATUS[inv.status] ?? { label: inv.status, variant: "secondary" as const };
          const remaining = BigInt(inv.totalAmount) - BigInt(inv.paidAmount);
          const overdueDays = inv.status === "OVERDUE"
            ? Math.max(1, Math.ceil((Date.now() - new Date(inv.dueDate).getTime()) / (24 * 3600 * 1000)))
            : null;
          return (
            <tr key={inv.id} className="border-t hover:bg-slate-50/60">
              <td className="px-3 py-2.5 max-w-[140px] line-clamp-2 break-words" title={inv.building.name}>{inv.building.name}</td>
              <td className="px-3 py-2.5 whitespace-nowrap">
                <Link href={`/buildings/${inv.buildingId}/invoices/${inv.id}`} className="block hover:underline">
                  <div className="font-semibold text-sm text-slate-900">{inv.contract.room.number}</div>
                  <div className="font-mono text-[11px] text-primary">{inv.code}</div>
                </Link>
              </td>
              <td className="px-3 py-2.5 max-w-[280px] line-clamp-2 break-words" title={name}>{name}</td>
              <td className="px-3 py-2.5 text-center whitespace-nowrap">
                <div className="text-sm font-semibold text-slate-800">{formatDateVN(inv.dueDate)}</div>
                <Badge variant={st.variant} className="text-[10px] whitespace-nowrap mt-1">
                  {st.label}{overdueDays !== null && ` ${overdueDays}d`}
                </Badge>
              </td>
              <td className="px-3 py-2.5 text-right whitespace-nowrap">{formatVND(BigInt(inv.rentAmount))}</td>
              <td className="px-3 py-2.5 text-right whitespace-nowrap">{formatVND(BigInt(inv.electricityFee))}</td>
              <td className="px-3 py-2.5 text-right whitespace-nowrap">{formatVND(BigInt(inv.parkingFee))}</td>
              <td className="px-3 py-2.5 text-right whitespace-nowrap">
                {formatVND(BigInt(isVP ? inv.overtimeFee : inv.serviceFee))}
              </td>
              <td className="px-3 py-2.5 text-right font-semibold whitespace-nowrap text-emerald-700">
                {formatVND(BigInt(inv.totalAmount))}
              </td>
              <td className="px-3 py-2.5 text-right whitespace-nowrap">{formatVND(BigInt(inv.paidAmount))}</td>
              <td className={`px-3 py-2.5 text-right whitespace-nowrap font-medium ${remaining > 0n ? "text-rose-600" : ""}`}>
                {formatVND(remaining)}
              </td>
              <td className="px-3 py-2.5 text-right">
                <div className="flex gap-1 justify-end">
                  {canWrite && inv.status !== "PAID" && inv.status !== "CANCELLED" && (
                    <Button onClick={() => onPay(inv)} variant="gradient" size="sm" className="h-7 px-2">
                      <DollarSign className="h-3 w-3" />
                    </Button>
                  )}
                  {canSend && primary?.email && inv.status !== "CANCELLED" && (
                    <Button onClick={() => onSend(inv)} variant="ghost" size="sm" className="h-7 px-2" disabled={sending === inv.id}>
                      {sending === inv.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                    </Button>
                  )}
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function InvoiceCard({ inv, canWrite, canSend, sending, onSend, onPay }: {
  inv: Invoice;
  canWrite: boolean;
  canSend: boolean;
  sending: boolean;
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
            <div className="text-xs text-slate-500 mb-1">{inv.building.name}</div>
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
              <Link href={`/buildings/${inv.buildingId}/invoices/${inv.id}`}>Chi tiết</Link>
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
          <div className="text-sm text-slate-600">{invoice.building.name} · Phòng {invoice.contract.room.number}</div>
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
