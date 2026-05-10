"use client";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Download, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { formatVND, formatDateVN, customerDisplayName } from "@/lib/utils";

type CustomerLite = {
  type: string;
  fullName: string | null;
  companyName: string | null;
  email: string | null;
};

type ReceiptPM = {
  name: string;
  bankName: string | null;
  accountHolder: string | null;
  accountNumber: string | null;
  qrCodeUrl: string | null;
} | null;

export type ReceiptData = {
  invoiceCode: string;
  month: number;
  year: number;
  rentPeriod: string;
  dueDate: string;
  buildingName: string;
  buildingAddress: string;
  buildingType: "CHDV" | "VP";
  roomNumber: string;
  customer: CustomerLite | undefined;
  rentAmount: bigint;
  vatAmount: bigint;
  electricityStart: number | null;
  electricityEnd: number | null;
  electricityFee: bigint;
  electricityPricePerKwh: bigint;
  electricityStartPhoto: string | null;
  electricityEndPhoto: string | null;
  parkingCount: number;
  parkingFee: bigint;
  overtimeFee: bigint;
  serviceFee: bigint;
  waterOccupants: number;
  waterPricePerPerson: bigint;
  waterFee: bigint;
  totalAmount: bigint;
  paidAmount: bigint;
  notes: string | null;
  paymentMethod: ReceiptPM;
};

export function InvoiceReceiptDialog({
  open, onClose, data,
}: {
  open: boolean;
  onClose: () => void;
  data: ReceiptData;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="max-w-3xl p-0 overflow-hidden max-h-[95vh] flex flex-col"
        // Keep our own close button — hide the default
      >
        <div className="flex items-center justify-between px-4 py-2.5 border-b bg-white shrink-0">
          <h3 className="text-sm font-semibold">Phiếu thanh toán</h3>
          <button onClick={onClose} aria-label="Đóng" className="text-slate-400 hover:text-slate-600">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="overflow-y-auto bg-slate-100 p-4 flex-1">
          <ReceiptBody data={data} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ReceiptBody({ data }: { data: ReceiptData }) {
  const ref = useRef<HTMLDivElement>(null);
  const [saving, setSaving] = useState(false);

  async function saveImage() {
    if (!ref.current) return;
    setSaving(true);
    try {
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(ref.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: "#ffffff",
      });
      const link = document.createElement("a");
      link.download = `phieu-${data.invoiceCode}.png`;
      link.href = dataUrl;
      link.click();
      toast.success("Đã lưu ảnh phiếu");
    } catch (err) {
      console.error(err);
      toast.error("Không lưu được ảnh. Hãy thử lại.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button variant="gradient" onClick={saveImage} disabled={saving} size="sm">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Lưu ảnh
        </Button>
      </div>
      <div ref={ref}>
        <ReceiptCard data={data} />
      </div>
    </div>
  );
}

function ReceiptCard({ data }: { data: ReceiptData }) {
  const remaining = data.totalAmount - data.paidAmount;
  const customerName = customerDisplayName(data.customer);
  const kwh =
    data.electricityStart !== null && data.electricityEnd !== null && data.electricityEnd > data.electricityStart
      ? data.electricityEnd - data.electricityStart
      : 0;

  // Month labels: rent = current month, all other costs = previous month
  const prevMonth = data.month === 1 ? 12 : data.month - 1;

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden mx-auto" style={{ maxWidth: 720 }}>
      {/* Header: brand */}
      <div
        className="px-6 py-5 text-white"
        style={{ background: "linear-gradient(135deg, #c96442 0%, #d5866c 100%)" }}
      >
        <div className="flex items-center gap-3">
          <div
            className="h-12 w-12 rounded-xl flex items-center justify-center text-xl font-bold"
            style={{ background: "rgba(255,255,255,0.2)", border: "1px solid rgba(255,255,255,0.3)" }}
          >
            TRH
          </div>
          <div>
            <div className="text-[10px] font-semibold tracking-[0.2em] opacity-90">THE RIGHT HOME</div>
            <div className="text-lg font-bold leading-tight">{data.buildingName}</div>
            <div className="text-[11px] opacity-90">{data.buildingAddress}</div>
          </div>
        </div>
        <div className="mt-4 flex items-end justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-wider opacity-80">Phiếu thanh toán</div>
            <div className="text-base font-semibold">
              Tháng {String(data.month).padStart(2, "0")}/{data.year}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wider opacity-80">Mã hoá đơn</div>
            <div className="font-mono text-sm font-semibold">{data.invoiceCode}</div>
          </div>
        </div>
      </div>

      {/* Customer info */}
      <div className="px-6 py-4 grid grid-cols-2 gap-4 border-b border-slate-200">
        <InfoBox label="Khách hàng" value={customerName || "—"} />
        <InfoBox label="Phòng" value={data.roomNumber} />
        <InfoBox label="Hạn thanh toán" value={formatDateVN(data.dueDate)} />
        <InfoBox label="Loại" value={data.buildingType === "CHDV" ? "Căn hộ dịch vụ" : "Văn phòng"} />
      </div>

      {/* Cost breakdown */}
      <div className="px-6 py-4">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Chi tiết chi phí</h4>
        <table className="w-full text-sm">
          <tbody>
            <CostRow
              label={
                data.vatAmount > 0n
                  ? `Tiền thuê (${data.rentPeriod}) · đã VAT, gồm ${formatVND(data.vatAmount)}`
                  : `Tiền thuê (${data.rentPeriod})`
              }
              value={formatVND(data.rentAmount)}
            />
            {data.electricityFee > 0n && (
              <CostRow
                label={`Tiền điện T${prevMonth}${kwh > 0 ? ` (${kwh} kWh × ${formatVND(data.electricityPricePerKwh)})` : ""}`}
                value={formatVND(data.electricityFee)}
              />
            )}
            {data.buildingType === "CHDV" && data.waterFee > 0n && (
              <CostRow
                label={`Tiền nước T${prevMonth} (${data.waterOccupants} người × ${formatVND(data.waterPricePerPerson)})`}
                value={formatVND(data.waterFee)}
              />
            )}
            {data.parkingFee > 0n && (
              <CostRow
                label={`Phí xe T${prevMonth} (${data.parkingCount} xe)`}
                value={formatVND(data.parkingFee)}
              />
            )}
            {data.buildingType === "VP" && data.overtimeFee > 0n && (
              <CostRow label={`Làm ngoài giờ T${prevMonth}`} value={formatVND(data.overtimeFee)} />
            )}
            {data.buildingType === "CHDV" && data.serviceFee > 0n && (
              <CostRow label={`Phí dịch vụ T${prevMonth}`} value={formatVND(data.serviceFee)} />
            )}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={2} style={{ paddingTop: 8 }}>
                <div className="border-t border-slate-200" />
              </td>
            </tr>
            <CostRow label="Tổng phải thu" value={formatVND(data.totalAmount)} bold />
            {data.paidAmount > 0n && (
              <CostRow label="Đã thu" value={formatVND(data.paidAmount)} positive />
            )}
            {remaining > 0n && (
              <CostRow label="Còn lại" value={formatVND(remaining)} bold danger />
            )}
          </tfoot>
        </table>
        {data.notes && (
          <div className="mt-3 text-xs text-slate-600 bg-slate-50 rounded-lg px-3 py-2">
            <span className="font-medium">Ghi chú: </span>
            {data.notes}
          </div>
        )}
      </div>

      {/* Electricity meter photos */}
      {(data.electricityStartPhoto || data.electricityEndPhoto) && (
        <div className="px-6 pb-4">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Ảnh công tơ điện</h4>
          <div className="grid grid-cols-2 gap-3">
            {data.electricityStartPhoto && (
              <MeterPhoto
                label={`Đầu kỳ${data.electricityStart !== null ? ` · ${data.electricityStart}` : ""}`}
                src={data.electricityStartPhoto}
              />
            )}
            {data.electricityEndPhoto && (
              <MeterPhoto
                label={`Cuối kỳ${data.electricityEnd !== null ? ` · ${data.electricityEnd}` : ""}`}
                src={data.electricityEndPhoto}
              />
            )}
          </div>
        </div>
      )}

      {/* Payment account */}
      {data.paymentMethod && (
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
            Thông tin chuyển khoản
          </h4>
          <div className="flex gap-4 items-start">
            <div className="flex-1 space-y-1.5 text-sm">
              {data.paymentMethod.bankName && (
                <KV label="Ngân hàng" value={data.paymentMethod.bankName} />
              )}
              {data.paymentMethod.accountHolder && (
                <KV label="Chủ tài khoản" value={data.paymentMethod.accountHolder} />
              )}
              {data.paymentMethod.accountNumber && (
                <KV label="Số tài khoản" value={data.paymentMethod.accountNumber} mono />
              )}
              <KV
                label="Nội dung chuyển khoản"
                value={`${data.invoiceCode} P${data.roomNumber}`}
                mono
              />
            </div>
            {data.paymentMethod.qrCodeUrl && (
              <div className="shrink-0">
                <div className="bg-white rounded-lg p-2 border border-slate-200">
                  <img
                    src={data.paymentMethod.qrCodeUrl}
                    alt="QR chuyển khoản"
                    className="block"
                    style={{ width: 140, height: 140, objectFit: "contain" }}
                  />
                </div>
                <div className="text-[10px] text-center text-slate-500 mt-1">Quét để chuyển khoản</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="px-6 py-3 text-center text-[11px] text-slate-400 border-t border-slate-200">
        Cảm ơn quý khách đã sử dụng dịch vụ của {data.buildingName}
      </div>
    </div>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className="text-sm font-medium text-slate-800 mt-0.5">{value}</div>
    </div>
  );
}

function CostRow({
  label, value, bold, positive, danger,
}: {
  label: string; value: string; bold?: boolean; positive?: boolean; danger?: boolean;
}) {
  const valueClass = [
    bold ? "font-bold text-base" : "text-sm",
    positive ? "text-emerald-700" : "",
    danger ? "text-rose-600" : "text-slate-800",
  ].filter(Boolean).join(" ");
  return (
    <tr>
      <td style={{ padding: "6px 0", color: "#475569" }}>{label}</td>
      <td style={{ padding: "6px 0", textAlign: "right" }} className={valueClass}>
        {value}
      </td>
    </tr>
  );
}

function MeterPhoto({ label, src }: { label: string; src: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">{label}</div>
      <div className="aspect-video rounded-lg overflow-hidden border border-slate-200 bg-slate-50">
        <img src={src} alt={label} className="w-full h-full object-cover" crossOrigin="anonymous" />
      </div>
    </div>
  );
}

function KV({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-xs text-slate-500 min-w-[110px] shrink-0">{label}:</span>
      <span className={`font-medium text-slate-800 ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}
