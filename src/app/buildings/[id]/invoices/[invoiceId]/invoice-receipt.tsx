"use client";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Loader2, Share2 } from "lucide-react";
import { toast } from "sonner";
import { formatVND, formatDateVN, customerDisplayName } from "@/lib/utils";
import { vietQrUrl } from "@/lib/vn-banks";

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
  bankBin: string | null;
  accountHolder: string | null;
  accountNumber: string | null;
  qrCodeUrl: string | null;
} | null;

export type ReceiptLine = {
  content: string;
  categoryName: string | null;
  amount: bigint;
};

export type VatFeeKey = "electricity" | "parking" | "overtime" | "repair" | "extraParking";

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
  isManual: boolean;
  lineItems: ReceiptLine[];
  rentAmount: bigint;
  vatAmount: bigint;
  electricityStart: number | null;
  electricityEnd: number | null;
  electricityFee: bigint;
  electricityPricePerKwh: bigint;
  electricityStartPhoto: string | null;
  electricityEndPhoto: string | null;
  electricityLines?: { roomLabel: string; start: number | null; end: number | null; startPhotoUrl: string | null; endPhotoUrl: string | null }[];
  parkingCount: number;
  parkingFee: bigint;
  overtimeFee: bigint;
  repairFee: bigint;
  extraParkingFee: bigint;
  serviceFee: bigint;
  waterOccupants: number;
  waterPricePerPerson: bigint;
  waterFee: bigint;
  totalAmount: bigint;
  paidAmount: bigint;
  notes: string | null;
  paymentMethod: ReceiptPM;
  vatRate: number;
  vatApplicableFees: VatFeeKey[];
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
  const [sharingPdf, setSharingPdf] = useState(false);
  const [sharingImg, setSharingImg] = useState(false);

  async function captureCanvas() {
    const node = cardRef.current!;
    await preloadImagesAsDataUrls(node);
    const CAPTURE_WIDTH = 720;
    const offscreen = document.createElement("div");
    offscreen.style.cssText = [
      "position: fixed",
      "left: -10000px",
      "top: 0",
      `width: ${CAPTURE_WIDTH}px`,
      "background: #ffffff",
      "pointer-events: none",
      "z-index: -1",
    ].join("; ");
    const clone = node.cloneNode(true) as HTMLElement;
    clone.style.width = `${CAPTURE_WIDTH}px`;
    offscreen.appendChild(clone);
    document.body.appendChild(offscreen);
    const { default: html2canvas } = await import("html2canvas-pro");
    try {
      return await html2canvas(clone, {
        backgroundColor: "#ffffff",
        scale: 2,
        width: CAPTURE_WIDTH,
        windowWidth: CAPTURE_WIDTH,
        useCORS: false,
        allowTaint: false,
        logging: false,
        imageTimeout: 15000,
      });
    } finally {
      document.body.removeChild(offscreen);
    }
  }

  const shareCaption = () => {
    const customerName = customerDisplayName(data.customer);
    return [
      `Phiếu thanh toán ${data.invoiceCode}`,
      `${data.roomNumber}${customerName && customerName !== "—" ? ` - ${customerName}` : ""}`,
      "Quý khách vui lòng kiểm tra và thanh toán đúng hạn. Xin cảm ơn!",
    ].join("\n");
  };

  async function sharePdf() {
    if (!cardRef.current) return;
    setSharingPdf(true);
    try {
      const canvas = await captureCanvas();
      const dataUrl = canvas.toDataURL("image/png");
      const pageW = 600;
      const pageH = (pageW * canvas.height) / canvas.width;
      const { default: jsPDF } = await import("jspdf");
      const pdf = new jsPDF({ unit: "pt", format: [pageW, pageH], orientation: pageH >= pageW ? "portrait" : "landscape" });
      pdf.addImage(dataUrl, "PNG", 0, 0, pageW, pageH);
      const filename = `${data.invoiceCode}.pdf`;
      const blob = pdf.output("blob");
      const file = new File([blob], filename, { type: "application/pdf" });
      const nav = navigator as Navigator & { canShare?: (data: { files?: File[] }) => boolean };
      if (nav.canShare?.({ files: [file] })) {
        try {
          await nav.share({ files: [file], title: `Phiếu thanh toán ${data.invoiceCode}`, text: shareCaption() });
          return;
        } catch (err) {
          if ((err as DOMException)?.name === "AbortError") return;
        }
      }
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
      setSharingPdf(false);
    }
  }

  async function shareImage() {
    if (!cardRef.current) return;
    setSharingImg(true);
    try {
      const canvas = await captureCanvas();
      const filename = `${data.invoiceCode}.png`;
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/png"),
      );
      const file = new File([blob], filename, { type: "image/png" });
      const nav = navigator as Navigator & { canShare?: (data: { files?: File[] }) => boolean };
      if (nav.canShare?.({ files: [file] })) {
        try {
          await nav.share({ files: [file], title: `Phiếu thanh toán ${data.invoiceCode}`, text: shareCaption() });
          return;
        } catch (err) {
          if ((err as DOMException)?.name === "AbortError") return;
        }
      }
      if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
        await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
        toast.success("Đã sao chép ảnh. Dán vào Zalo để gửi.");
        return;
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.download = filename;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
      toast.success("Đã tải ảnh");
    } catch (err) {
      console.error(err);
      toast.error("Không share được. Hãy thử lại.");
    } finally {
      setSharingImg(false);
    }
  }

  const busy = sharingPdf || sharingImg;

  return (
    <div className="space-y-3">
      <div className="flex justify-end gap-2 max-w-[720px] mx-auto w-full">
        <Button variant="outline" onClick={shareImage} disabled={busy} size="sm">
          {sharingImg ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
          Ảnh
        </Button>
        <Button variant="gradient" onClick={sharePdf} disabled={busy} size="sm">
          {sharingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
          PDF
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
  // invoiceCode + room number (room.number already includes any P prefix the
  // user wants) if no phone is on file.
  const phoneDigits = (data.customer?.phone ?? "").replace(/\D/g, "");
  const transferContent = data.buildingType === "VP"
    ? `${data.roomNumber} ${data.buildingName}`
    : (phoneDigits ? `DT${phoneDigits}` : `${data.invoiceCode} ${data.roomNumber}`);

  // VietQR auto-render: if the payment method has a bank BIN selected, build
  // a vietqr.io image URL with this invoice's outstanding amount + the
  // transfer memo so the customer scans and gets a pre-filled transfer.
  // Falls back to the user-uploaded static QR when no BIN is set.
  const remainingForQr = data.totalAmount - data.paidAmount;
  const amountForQr = remainingForQr > 0n ? remainingForQr : data.totalAmount;
  const dynamicQrUrl = vietQrUrl({
    bankBin: data.paymentMethod?.bankBin,
    accountNumber: data.paymentMethod?.accountNumber,
    accountHolder: data.paymentMethod?.accountHolder,
    amount: amountForQr.toString(),
    memo: transferContent,
    // qr_only: just the QR code with no VietQR/Napas/bank branding around it.
    // The bank info + amount + memo are already shown as text on the receipt.
    template: "qr_only",
  });
  const qrSrc = dynamicQrUrl ?? data.paymentMethod?.qrCodeUrl ?? null;

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
            <div className="text-[10px] font-semibold tracking-[0.2em] opacity-90 mb-1">{data.buildingType === "VP" ? "K300 OFFICE" : "THE RIGHT HOME"}</div>
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
            {data.isManual ? (
              data.lineItems.map((l, idx) => (
                <CostRow
                  key={idx}
                  label={l.categoryName ? `${l.categoryName} — ${l.content}` : l.content}
                  value={formatVND(l.amount)}
                />
              ))
            ) : data.buildingType === "VP" && data.vatRate > 0 ? (
              // Excel-style for VP with VAT: all lines NET, then subtotal + VAT
              (() => {
                const vatOf = (n: bigint, key: VatFeeKey) =>
                  data.vatApplicableFees.includes(key) ? BigInt(Math.round(Number(n) * data.vatRate)) : 0n;
                const elecVat = vatOf(data.electricityFee, "electricity");
                const parkVat = vatOf(data.parkingFee, "parking");
                const otVat = vatOf(data.overtimeFee, "overtime");
                const repVat = vatOf(data.repairFee, "repair");
                const exParkVat = vatOf(data.extraParkingFee, "extraParking");
                const feeVatTotal = elecVat + parkVat + otVat + repVat + exParkVat;
                const netRent = data.rentAmount - data.vatAmount;
                const totalVat = data.vatAmount + feeVatTotal;
                const subtotal = data.totalAmount - totalVat;
                const vatPct = Math.round(data.vatRate * 100);
                return (
                  <>
                    <CostRow label={`Tiền thuê (${data.rentPeriod})`} value={formatVND(netRent)} />
                    {data.electricityFee > 0n && (
                      <CostRow
                        label={`Tiền điện T${prevMonth}${kwh > 0 ? ` (${kwh} kWh × ${formatVND(data.electricityPricePerKwh)})` : ""}`}
                        value={formatVND(data.electricityFee)}
                      />
                    )}
                    {data.parkingFee > 0n && <CostRow label={`Phí xe (${data.parkingCount} xe)`} value={formatVND(data.parkingFee)} />}
                    {data.overtimeFee > 0n && <CostRow label="Phí ngoài giờ" value={formatVND(data.overtimeFee)} />}
                    {data.repairFee > 0n && <CostRow label="Phí sửa chữa" value={formatVND(data.repairFee)} />}
                    {data.extraParkingFee > 0n && <CostRow label="Phí xe lẻ" value={formatVND(data.extraParkingFee)} />}
                    <tr><td colSpan={2} style={{ paddingTop: 4, paddingBottom: 4 }}><div className="border-t border-slate-200" /></td></tr>
                    <CostRow label="Tổng chưa VAT" value={formatVND(subtotal)} />
                    <CostRow label={`VAT (${vatPct}%)`} value={formatVND(totalVat)} />
                  </>
                );
              })()
            ) : (
              <>
                <CostRow
                  label={
                    data.vatAmount > 0n
                      ? `Tiền thuê (${data.rentPeriod}) · đã VAT, gồm ${formatVND(data.vatAmount)}`
                      : `Tiền thuê (${data.rentPeriod})`
                  }
                  value={formatVND(data.rentAmount)}
                />
                {data.electricityFee > 0n && (
                  <FeeCostRow
                    label={`Tiền điện T${prevMonth}${kwh > 0 ? ` (${kwh} kWh × ${formatVND(data.electricityPricePerKwh)})` : ""}`}
                    base={data.electricityFee}
                    withVat={data.vatApplicableFees.includes("electricity")}
                    vatRate={data.vatRate}
                  />
                )}
                {data.buildingType === "CHDV" && data.waterFee > 0n && (
                  <CostRow
                    label={`Tiền nước (${data.waterOccupants} người × ${formatVND(data.waterPricePerPerson)})`}
                    value={formatVND(data.waterFee)}
                  />
                )}
                {data.parkingFee > 0n && (
                  <FeeCostRow
                    label={`Phí xe (${data.parkingCount} xe)`}
                    base={data.parkingFee}
                    withVat={data.vatApplicableFees.includes("parking")}
                    vatRate={data.vatRate}
                  />
                )}
                {data.buildingType === "VP" && data.overtimeFee > 0n && (
                  <FeeCostRow
                    label="Phí ngoài giờ"
                    base={data.overtimeFee}
                    withVat={data.vatApplicableFees.includes("overtime")}
                    vatRate={data.vatRate}
                  />
                )}
                {data.buildingType === "VP" && data.repairFee > 0n && (
                  <FeeCostRow
                    label="Phí sửa chữa"
                    base={data.repairFee}
                    withVat={data.vatApplicableFees.includes("repair")}
                    vatRate={data.vatRate}
                  />
                )}
                {data.buildingType === "VP" && data.extraParkingFee > 0n && (
                  <FeeCostRow
                    label="Phí xe lẻ"
                    base={data.extraParkingFee}
                    withVat={data.vatApplicableFees.includes("extraParking")}
                    vatRate={data.vatRate}
                  />
                )}
                {data.buildingType === "CHDV" && data.serviceFee > 0n && (
                  <CostRow label="Phí dịch vụ" value={formatVND(data.serviceFee)} />
                )}
              </>
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

      {/* Electricity meter photos — single-room */}
      {!data.electricityLines?.length && (data.electricityStartPhoto || data.electricityEndPhoto) && (
        <div className="px-6 pb-4">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Ảnh công tơ điện</h4>
          <div className="grid grid-cols-2 gap-3">
            {data.electricityStartPhoto && (
              <MeterPhoto label="Đầu kỳ" reading={data.electricityStart} src={data.electricityStartPhoto} />
            )}
            {data.electricityEndPhoto && (
              <MeterPhoto label="Cuối kỳ" reading={data.electricityEnd} src={data.electricityEndPhoto} />
            )}
          </div>
        </div>
      )}
      {/* Electricity meter photos — multi-room */}
      {data.electricityLines?.some((l) => l.startPhotoUrl || l.endPhotoUrl) && (
        <div className="px-6 pb-4 space-y-3">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Ảnh công tơ điện</h4>
          {data.electricityLines.filter((l) => l.startPhotoUrl || l.endPhotoUrl).map((line) => (
            <div key={line.roomLabel}>
              <div className="text-xs font-medium text-slate-600 mb-1.5">{line.roomLabel}</div>
              <div className="grid grid-cols-2 gap-3">
                {line.startPhotoUrl && <MeterPhoto label="Đầu kỳ" reading={line.start} src={line.startPhotoUrl} />}
                {line.endPhotoUrl && <MeterPhoto label="Cuối kỳ" reading={line.end} src={line.endPhotoUrl} />}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Payment account: stacked on mobile, side-by-side on desktop. */}
      {data.paymentMethod && (
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
            Thông tin chuyển khoản
          </h4>
          <div className="flex flex-col sm:flex-row sm:items-start gap-4">
            <div className="min-w-0 space-y-1.5 text-sm">
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
              <KV label="Số tiền chuyển khoản" value={formatVND(amountForQr)} mono />
            </div>
            {qrSrc && (
              <div className="flex flex-col items-center shrink-0 self-center sm:self-start sm:ml-auto sm:-mt-8">
                <img
                  src={qrSrc}
                  alt="QR chuyển khoản"
                  className="block"
                  style={{ width: 140, height: 140, objectFit: "contain" }}
                />
                <div className="text-[10px] text-slate-500 mt-1">Quét để chuyển khoản</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="px-6 py-3 text-center text-[11px] text-slate-400 border-t border-slate-200">
        Cảm ơn quý khách đã sử dụng dịch vụ của {data.buildingType === "VP" ? "K300 Office" : "The Right Home"}
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

function FeeCostRow({
  label, base, withVat, vatRate,
}: { label: string; base: bigint; withVat: boolean; vatRate: number }) {
  if (!withVat || vatRate <= 0) {
    return <CostRow label={label} value={formatVND(base)} />;
  }
  const vat = BigInt(Math.round(Number(base) * vatRate));
  const gross = base + vat;
  const vatPct = Math.round(vatRate * 100);
  return (
    <CostRow
      label={`${label} (+${vatPct}% VAT: ${formatVND(vat)})`}
      value={formatVND(gross)}
    />
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
          <span className="text-xs font-bold text-slate-800 tabular-nums">{reading}</span>
        )}
      </div>
      <div className="h-[280px] rounded-lg overflow-hidden border border-slate-200 bg-slate-50 flex items-center justify-center">
        {/* No crossOrigin: the file route doesn't set CORS headers, so adding
            crossOrigin="anonymous" makes same-origin auth-protected images
            fail to load — they'd show up as empty boxes in the PDF capture. */}
        <img src={src} alt={label} className="w-full h-full object-contain" />
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

// Replace every <img>'s src in a subtree with a data URL.
// - same-origin URLs (auth-protected /api/files/*): fetch with credentials
// - cross-origin URLs (e.g. img.vietqr.io): fetch without credentials and rely
//   on the remote's CORS policy. VietQR.io serves images CORS-open.
// Returns once all replacements have settled, so html2canvas sees a tree where
// images don't need any network access.
async function preloadImagesAsDataUrls(root: HTMLElement): Promise<void> {
  const imgs = Array.from(root.querySelectorAll("img"));
  await Promise.all(imgs.map(async (img) => {
    const src = img.getAttribute("src") ?? "";
    if (!src || src.startsWith("data:")) return;
    try {
      const isSameOrigin = (() => {
        try {
          return new URL(src, window.location.href).origin === window.location.origin;
        } catch { return false; }
      })();
      const res = await fetch(src, {
        credentials: isSameOrigin ? "same-origin" : "omit",
        cache: "no-cache",
      });
      if (!res.ok) return;
      const blob = await res.blob();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      });
      await new Promise<void>((resolve) => {
        const settle = () => {
          img.removeEventListener("load", settle);
          img.removeEventListener("error", settle);
          resolve();
        };
        img.addEventListener("load", settle);
        img.addEventListener("error", settle);
        img.src = dataUrl;
      });
    } catch {
      // Best-effort — if pre-loading fails, html2canvas still gets a chance.
    }
  }));
}
