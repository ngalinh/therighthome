"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Camera, Send, X as XIcon, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ImageLightbox } from "@/components/ui/image-lightbox";
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
  electricityStart: number | null;
  electricityEnd: number | null;
  electricityStartPhoto: string | null;
  electricityEndPhoto: string | null;
  electricityPricePerKwh: string;
  electricityFee: string;
  parkingCount: number;
  parkingFeePerVehicle: string;
  parkingFee: string;
  overtimeFee: string;
  serviceFee: string;
  totalAmount: string;
  paidAmount: string;
  notes: string | null;
  contract: {
    room: { number: string };
    customers: { isPrimary: boolean; customer: { fullName: string | null; companyName: string | null; email: string | null } }[];
  };
  payments: { id: string; amount: string; paidAt: string; transaction: { code: string } }[];
};

const STATUS: Record<string, { label: string; variant: "secondary" | "warning" | "success" | "destructive" }> = {
  PENDING: { label: "Chờ thanh toán", variant: "warning" },
  PARTIAL: { label: "Thanh toán 1 phần", variant: "warning" },
  PAID: { label: "Đã thanh toán", variant: "success" },
  OVERDUE: { label: "Quá hạn", variant: "destructive" },
  CANCELLED: { label: "Đã huỷ", variant: "secondary" },
};

export function InvoiceDetail({
  invoice, buildingType, canWrite, canSend,
}: {
  invoice: Invoice;
  buildingType: "CHDV" | "VP";
  canWrite: boolean;
  canSend: boolean;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);

  const [elecStart, setElecStart] = useState<string>(invoice.electricityStart?.toString() ?? "");
  const [elecEnd, setElecEnd] = useState<string>(invoice.electricityEnd?.toString() ?? "");
  const [parkingCount, setParkingCount] = useState<number>(invoice.parkingCount);
  const [overtime, setOvertime] = useState(invoice.overtimeFee);
  const [serviceFee, setServiceFee] = useState(invoice.serviceFee);
  const [notes, setNotes] = useState(invoice.notes ?? "");
  const [dueDate, setDueDate] = useState(invoice.dueDate.slice(0, 10));

  const primary = invoice.contract.customers.find((c) => c.isPrimary)?.customer;
  const st = STATUS[invoice.status] ?? { label: invoice.status, variant: "secondary" as const };

  // Live compute preview
  const elecStartN = elecStart ? Number(elecStart) : null;
  const elecEndN = elecEnd ? Number(elecEnd) : null;
  const kwh = elecStartN !== null && elecEndN !== null && elecEndN > elecStartN ? elecEndN - elecStartN : 0;
  const elecFee = BigInt(kwh) * BigInt(invoice.electricityPricePerKwh);
  const parkingFee = BigInt(parkingCount) * BigInt(invoice.parkingFeePerVehicle);
  // rentAmount already includes VAT (after-VAT). Don't add vatAmount on top.
  const totalPreview = BigInt(invoice.rentAmount) + elecFee + parkingFee + parseVNDInput(overtime) + parseVNDInput(serviceFee);
  const remaining = BigInt(invoice.totalAmount) - BigInt(invoice.paidAmount);

  async function save() {
    setSaving(true);
    const res = await fetch(`/api/invoices/${invoice.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        electricityStart: elecStart ? Number(elecStart) : null,
        electricityEnd: elecEnd ? Number(elecEnd) : null,
        parkingCount,
        overtimeFee: parseVNDInput(overtime).toString(),
        serviceFee: parseVNDInput(serviceFee).toString(),
        notes,
        dueDate,
      }),
    });
    setSaving(false);
    if (!res.ok) return toast.error("Lưu thất bại");
    toast.success("Đã lưu");
    router.refresh();
  }

  async function send() {
    if (!primary?.email) return toast.error("Khách thuê chưa có email");
    setSending(true);
    const res = await fetch(`/api/invoices/${invoice.id}/send`, { method: "POST" });
    setSending(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return toast.error(err.error || "Gửi thất bại");
    }
    toast.success("Đã gửi email");
    router.refresh();
  }

  async function cancelInvoice() {
    if (!confirm("Huỷ hoá đơn này?")) return;
    const res = await fetch(`/api/invoices/${invoice.id}`, { method: "DELETE" });
    if (!res.ok) return toast.error("Có lỗi");
    toast.success("Đã huỷ");
    router.refresh();
  }

  const headerGradient =
    invoice.status === "OVERDUE" ? "from-orange-500 via-rose-500 to-rose-600" :
    invoice.status === "PAID"    ? "from-emerald-500 to-teal-500" :
    invoice.status === "PARTIAL" ? "from-amber-400 to-orange-500" :
    "from-slate-500 to-slate-700";

  return (
    <div className="grid lg:grid-cols-3 gap-4 lg:gap-6">
      <div className="lg:col-span-2 space-y-4">
        <Card className="overflow-hidden">
          {/* Gradient status header */}
          <div className={`bg-gradient-to-br ${headerGradient} px-5 py-4 text-white`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-white/75">Hoá đơn · {invoice.code}</p>
                <h3 className="text-lg font-bold mt-0.5">
                  Phòng {invoice.contract.room.number} · {primary?.fullName || primary?.companyName}
                </h3>
              </div>
              <Badge className="bg-white/20 text-white border-white/30 text-xs">
                {st.label}
              </Badge>
            </div>
            <div className="mt-3 flex items-baseline gap-1.5">
              <span className="text-2xl font-bold">{formatVND(BigInt(invoice.totalAmount))}</span>
              {remaining > 0n && (
                <span className="text-sm text-white/75">· còn {formatVND(remaining)}</span>
              )}
            </div>
          </div>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pt-4">
            <CardTitle className="text-base">Chi tiết</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Row
              label={
                BigInt(invoice.vatAmount) > 0n
                  ? `Tiền thuê (đã VAT, gồm ${formatVND(BigInt(invoice.vatAmount))} VAT)`
                  : "Tiền thuê"
              }
              value={formatVND(BigInt(invoice.rentAmount))}
            />
            <Row label={`Tiền điện${kwh ? ` (${kwh} kWh × ${formatVND(BigInt(invoice.electricityPricePerKwh))})` : ""}`} value={formatVND(elecFee)} />
            {parkingFee > 0n && <Row label={`Phí xe (${parkingCount} xe)`} value={formatVND(parkingFee)} />}
            {buildingType === "VP" && parseVNDInput(overtime) > 0n && (
              <Row label="Phí ngoài giờ" value={formatVND(parseVNDInput(overtime))} />
            )}
            {buildingType === "CHDV" && parseVNDInput(serviceFee) > 0n && (
              <Row label="Phí dịch vụ" value={formatVND(parseVNDInput(serviceFee))} />
            )}
            <hr />
            <Row label="Tổng phải thu" value={formatVND(totalPreview)} bold />
            <Row label="Đã thu" value={formatVND(BigInt(invoice.paidAmount))} positive />
            {remaining > 0n && <Row label="Còn lại" value={formatVND(remaining)} bold danger />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Số điện</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <PhotoUploadField
                invoiceId={invoice.id}
                which="start"
                label="Số điện đầu kỳ"
                photoUrl={invoice.electricityStartPhoto}
                value={elecStart}
                onChange={setElecStart}
                disabled={!canWrite}
              />
              <PhotoUploadField
                invoiceId={invoice.id}
                which="end"
                label="Số điện cuối kỳ"
                photoUrl={invoice.electricityEndPhoto}
                value={elecEnd}
                onChange={setElecEnd}
                disabled={!canWrite}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Khác</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Số xe</Label>
                <Input type="number" min={0} value={parkingCount} onChange={(e) => setParkingCount(Number(e.target.value))} disabled={!canWrite} />
                <p className="text-[10px] text-slate-500">Mặc định lấy từ HĐ. Có thể chỉnh tay tháng này.</p>
              </div>
              {buildingType === "CHDV" ? (
                <div className="space-y-1">
                  <Label className="text-xs">Phí dịch vụ (₫)</Label>
                  <Input
                    inputMode="numeric"
                    value={formatNumber(parseVNDInput(serviceFee))}
                    onChange={(e) => setServiceFee(e.target.value)}
                    disabled={!canWrite}
                  />
                </div>
              ) : (
                <div className="space-y-1">
                  <Label className="text-xs">Phí ngoài giờ (₫)</Label>
                  <Input
                    inputMode="numeric"
                    value={formatNumber(parseVNDInput(overtime))}
                    onChange={(e) => setOvertime(e.target.value)}
                    disabled={!canWrite}
                  />
                </div>
              )}
              <div className="space-y-1">
                <Label className="text-xs">Hạn thanh toán</Label>
                <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} disabled={!canWrite} />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Ghi chú</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} disabled={!canWrite} />
            </div>
          </CardContent>
        </Card>

        {canWrite && (
          <div className="flex justify-end gap-2">
            {invoice.status !== "CANCELLED" && (
              <Button variant="outline" onClick={cancelInvoice}>
                <XIcon className="h-4 w-4" /> Huỷ HĐ
              </Button>
            )}
            <Button variant="gradient" onClick={save} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Lưu thay đổi
            </Button>
          </div>
        )}
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader><CardTitle>Gửi hoá đơn</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {primary?.email ? (
              <p className="text-sm text-slate-600">Email khách: <strong>{primary.email}</strong></p>
            ) : (
              <p className="text-sm text-amber-600">Khách thuê chưa có email — vui lòng cập nhật.</p>
            )}
            {canSend && primary?.email && (
              <Button variant="gradient" className="w-full" onClick={send} disabled={sending}>
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Gửi qua email
              </Button>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Lịch sử thanh toán</CardTitle></CardHeader>
          <CardContent>
            {invoice.payments.length === 0 ? (
              <p className="text-sm text-slate-500">Chưa có thanh toán</p>
            ) : (
              <div className="space-y-2">
                {invoice.payments.map((p) => (
                  <div key={p.id} className="flex justify-between items-start text-sm">
                    <div>
                      <div className="font-medium">{formatVND(BigInt(p.amount))}</div>
                      <div className="text-xs text-slate-500">{formatDateVN(p.paidAt)} · <span className="font-mono">{p.transaction.code}</span></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value, bold, positive, danger }: { label: string; value: string; bold?: boolean; positive?: boolean; danger?: boolean }) {
  return (
    <div className="flex justify-between items-baseline">
      <span className="text-sm text-slate-600">{label}</span>
      <span className={`${bold ? "font-bold text-base" : "text-sm"} ${positive ? "text-emerald-700" : ""} ${danger ? "text-rose-600" : ""}`}>{value}</span>
    </div>
  );
}

function PhotoUploadField({
  invoiceId, which, label, photoUrl, value, onChange, disabled,
}: {
  invoiceId: string;
  which: "start" | "end";
  label: string;
  photoUrl: string | null;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [localPhoto, setLocalPhoto] = useState(photoUrl);
  const [zoom, setZoom] = useState(false);
  const [removing, setRemoving] = useState(false);

  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) {
      toast.error("Ảnh quá lớn (>10MB). Hãy chọn ảnh nhỏ hơn.");
      e.target.value = "";
      return;
    }
    setUploading(true);
    const fd = new FormData();
    fd.append("file", f);
    fd.append("which", which);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/electricity-photo`, { method: "POST", body: fd });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || `Upload thất bại (${res.status})`);
        return;
      }
      const { url } = await res.json();
      setLocalPhoto(url);
      toast.success("Đã upload ảnh");
      router.refresh();
    } catch (err) {
      toast.error("Lỗi mạng. Thử lại.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function removePhoto() {
    if (!confirm("Xoá ảnh này?")) return;
    setRemoving(true);
    const res = await fetch(`/api/invoices/${invoiceId}/electricity-photo?which=${which}`, { method: "DELETE" });
    setRemoving(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return toast.error(err.error || "Xoá thất bại");
    }
    setLocalPhoto(null);
    toast.success("Đã xoá ảnh");
    router.refresh();
  }

  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Input type="number" inputMode="numeric" value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} placeholder="0" />
      {localPhoto ? (
        <div className="relative aspect-video rounded-lg overflow-hidden border bg-slate-50 group">
          <button
            type="button"
            onClick={() => setZoom(true)}
            className="block w-full h-full cursor-zoom-in"
          >
            <img src={localPhoto} alt={label} className="w-full h-full object-cover group-hover:opacity-90 transition-opacity" />
            <div className="absolute inset-0 flex items-end justify-end p-2 pointer-events-none">
              <span className="text-[10px] bg-black/60 text-white px-2 py-0.5 rounded">Click để xem to</span>
            </div>
          </button>
          {!disabled && (
            <button
              type="button"
              onClick={removePhoto}
              disabled={removing}
              className="absolute top-1.5 right-1.5 h-7 w-7 rounded-full bg-black/60 hover:bg-rose-600 text-white flex items-center justify-center transition-colors disabled:opacity-50"
              aria-label="Xoá ảnh"
              title="Xoá ảnh"
            >
              {removing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            </button>
          )}
        </div>
      ) : null}
      <ImageLightbox src={zoom ? localPhoto : null} alt={label} onClose={() => setZoom(false)} />
      {!disabled && (
        // Use a <label> wrapping the file input → native click flows through,
        // works reliably on iOS PWA + Android Chrome where programmatic
        // .click() on a hidden input is sometimes blocked.
        <label
          className={
            "flex items-center justify-center gap-1.5 h-9 px-3 rounded-xl border bg-background text-sm font-medium cursor-pointer hover:bg-accent/10 hover:text-accent transition-colors w-full" +
            (uploading ? " opacity-50 pointer-events-none" : "")
          }
        >
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={upload}
            disabled={uploading}
          />
          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
          {localPhoto ? "Thay ảnh" : "Chụp / chọn ảnh đồng hồ"}
        </label>
      )}
    </div>
  );
}
