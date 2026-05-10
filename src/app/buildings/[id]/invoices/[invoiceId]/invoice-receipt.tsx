"use client";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Loader2, Share2 } from "lucide-react";
import { toast } from "sonner";
import { formatVND, formatDateVN, customerDisplayName } from "@/lib/utils";

type CustomerLite = {
  type: string;
  fullName: string | null;
  companyName: string | null;
  email: string | null;
  phone: string | null;
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
      <DialogContent className="max-w-3xl p-0 overflow-hidden max-h-[95vh] flex flex-col">
        <div className="flex items-center justify-between pl-4 pr-12 py-2.5 border-b bg-white shrink-0">
          <h3 className="text-sm font-semibold">Phiếu thanh toán</h3>
          {/* The built-in DialogContent close X is positioned at top-right (right-4). */}
        </div>
        <div className="overflow-y-auto bg-slate-100 p-4 flex-1">
          <ReceiptBody data={data} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ReceiptBody({ data }: { data: ReceiptData }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [sharing, setSharing] = useState(false);

  async function sharePdf() {
    if (!cardRef.current) return;
    setSharing(true);
    try {
      const [{ toPng }, { default: jsPDF }] = await Promise.all([
        import("html-to-image"),
        import("jspdf"),
      ]);

      const node = cardRef.current;
      // Render the card to a high-DPI PNG, then drop it into a single-page
      // A4 PDF (portrait), scaled to fit width while preserving aspect.
      const dataUrl = await toPng(node, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: "#ffffff",
      });
      const img = new Image();
      img.src = dataUrl;
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Không tải được ảnh để render PDF"));
      });

      const pdf = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait" });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 24;
      const usableW = pageW - margin * 2;
      const usableH = pageH - margin * 2;
      const imgRatio = img.width / img.height;
      let drawW = usableW;
      let drawH = drawW / imgRatio;
      if (drawH > usableH) {
        drawH = usableH;
        drawW = drawH * imgRatio;
      }
      const x = (pageW - drawW) / 2;
      const y = margin;
      pdf.addImage(dataUrl, "PNG", x, y, drawW, drawH);

      const filename = `phieu-${data.invoiceCode}.pdf`;
      const blob = pdf.output("blob");
      const file = new File([blob], filename, { type: "application/pdf" });

      const nav = navigator as Navigator & { canShare?: (data: { files?: File[] }) => boolean };
      if (nav.canShare?.({ files: [file] })) {
        try {
          await nav.share({ files: [file], title: "Phiếu thanh toán", text: `Phiếu thanh toán ${data.invoiceCode}` });
          return;
        } catch (err) {
          if ((err as DOMException)?.name === "AbortError") return;
          // Other errors → fall through to download
        }
      }

      // Desktop / fallback: download the PDF
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.download = filename;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
      toast.success("Đã tải PDF");
    } catch (err) {
      console.error(err);
      toast.error("Không share được. Hãy thử lại.");
    } finally {
      setSharing(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end max-w-[720px] mx-auto w-full">
        <Button variant="gradient" onClick={sharePdf} disabled={sharing} size="sm">
          {sharing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
          Share
        </Button>
      </div>
      <div className="max-w-[720px] mx-auto w-full">
        <ReceiptCard data={data} cardRef={cardRef} />
      </div>
    </div>
  );
}

function ReceiptCard({ data, cardRef }: { data: ReceiptData; cardRef: React.Ref<HTMLDivElement> }) {
  const remaining = data.totalAmount - data.paidAmount;
  const customerName = customerDisplayName(data.customer);
  const kwh =
    data.electricityStart !== null && data.electricityEnd !== null && data.electricityEnd > data.electricityStart
      ? data.electricityEnd - data.electricityStart
      : 0;

  // Month labels: rent = current month, all other costs = previous month
  const prevMonth = data.month === 1 ? 12 : data.month - 1;

  // Bank transfer reference: DT<digits-only-phone>. Customer might have stored
  // the phone with spaces or dashes, so strip non-digits. Falls back to
  // invoiceCode + room if no phone is on file.
  const phoneDigits = (data.customer?.phone ?? "").replace(/\D/g, "");
  const transferContent = phoneDigits
    ? `DT${phoneDigits}`
    : `${data.invoiceCode} P${data.roomNumber}`;

  return (
    <div ref={cardRef} className="bg-white rounded-2xl shadow-sm overflow-hidden">
      {/* Header: brand */}
      <div
        className="px-6 py-5 text-white"
        style={{ background: "linear-gradient(135deg, #c96442 0%, #d5866c 100%)" }}
      >
        <div className="flex items-center gap-3">
          <div
            className="h-12 w-12 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: "rgba(255,255,255,0.2)", border: "1px solid rgba(255,255,255,0.3)" }}
            aria-hidden
          >
            <KeyRoundIcon />
          </div>
          <div className="min-w-0 leading-snug">
            <div className="text-[10px] font-semibold tracking-[0.2em] opacity-90 mb-1">THE RIGHT HOME</div>
            <div className="text-lg font-bold mb-1">{data.buildingName}</div>
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
                label="Đầu kỳ"
                reading={data.electricityStart}
                src={data.electricityStartPhoto}
              />
            )}
            {data.electricityEndPhoto && (
              <MeterPhoto
                label="Cuối kỳ"
                reading={data.electricityEnd}
                src={data.electricityEndPhoto}
              />
            )}
          </div>
        </div>
      )}

      {/* Payment account: stacked on mobile, side-by-side on desktop. */}
      {data.paymentMethod && (
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
            Thông tin chuyển khoản
          </h4>
          <div className="flex flex-col sm:flex-row sm:items-start gap-4">
            <div className="flex-1 min-w-0 space-y-1.5 text-sm">
              {data.paymentMethod.bankName && (
                <KV label="Ngân hàng" value={data.paymentMethod.bankName} />
              )}
              {data.paymentMethod.accountHolder && (
                <KV label="Chủ tài khoản" value={data.paymentMethod.accountHolder} />
              )}
              {data.paymentMethod.accountNumber && (
                <KV label="Số tài khoản" value={data.paymentMethod.accountNumber} mono />
              )}
              <KV label="Nội dung chuyển khoản" value={transferContent} mono />
            </div>
            {data.paymentMethod.qrCodeUrl && (
              <div className="flex flex-col items-center shrink-0 self-center sm:self-start">
                <img
                  src={data.paymentMethod.qrCodeUrl}
                  alt="QR chuyển khoản"
                  className="block"
                  style={{ width: 200, height: 200, objectFit: "contain" }}
                />
                <div className="text-[10px] text-slate-500 mt-1">Quét để chuyển khoản</div>
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

// Inline KeyRound (matches the PWA app icon at /icons/icon-192.svg) so the
// receipt header logo is identical to the installed-app icon — and so the
// html-to-image PNG export embeds it without an extra HTTP fetch.
function KeyRoundIcon() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#fff7e8"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 0 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 0 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z" />
      <circle cx="16.5" cy="7.5" r=".5" fill="#fff7e8" />
    </svg>
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

function MeterPhoto({ label, reading, src }: { label: string; reading: number | null; src: string }) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-xs uppercase tracking-wider text-slate-500">{label}</span>
        {reading !== null && (
          <span className="text-base font-bold text-slate-800 tabular-nums">{reading}</span>
        )}
      </div>
      <div className="aspect-[3/2] rounded-lg overflow-hidden border border-slate-200 bg-slate-50">
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
