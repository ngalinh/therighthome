import { formatVND, formatDateVN } from "@/lib/utils";

export type InvoiceEmailData = {
  buildingName: string;
  buildingAddress: string;
  customerName: string;
  roomNumber: string;
  invoiceCode: string;
  month: number;
  year: number;
  dueDate: Date;
  rentAmount: bigint;
  vatAmount: bigint;
  electricityStart: number | null;
  electricityEnd: number | null;
  electricityFee: bigint;
  parkingCount: number;
  parkingFee: bigint;
  overtimeFee: bigint;
  serviceFee: bigint;
  totalAmount: bigint;
  paidAmount: bigint;
  notes?: string | null;
};

const row = (label: string, value: string, bold = false) =>
  `<tr><td style="padding:6px 0;color:#64748b">${label}</td><td style="padding:6px 0;text-align:right;${bold ? "font-weight:600;font-size:16px" : ""}">${value}</td></tr>`;

export function renderInvoiceEmail(d: InvoiceEmailData): string {
  const remaining = d.totalAmount - d.paidAmount;
  const elec = d.electricityStart !== null && d.electricityEnd !== null
    ? `${d.electricityEnd - d.electricityStart} kWh (${d.electricityStart} → ${d.electricityEnd})`
    : "—";

  return `<!doctype html>
<html><body style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;background:#f8fafc;margin:0;padding:24px">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06)">
    <div style="background:linear-gradient(135deg,#6366f1 0%,#a855f7 50%,#ec4899 100%);padding:24px 28px;color:#fff">
      <div style="font-size:12px;opacity:0.9;letter-spacing:1px">HOÁ ĐƠN ${String(d.month).padStart(2, "0")}/${d.year}</div>
      <div style="font-size:20px;font-weight:700;margin-top:4px">${d.buildingName}</div>
      <div style="font-size:12px;opacity:0.85;margin-top:2px">${d.buildingAddress}</div>
    </div>
    <div style="padding:24px 28px">
      <p style="margin:0 0 16px">Kính gửi <strong>${d.customerName}</strong>,</p>
      <p style="margin:0 0 16px;color:#475569">Vui lòng kiểm tra hoá đơn tháng ${d.month}/${d.year} cho phòng <strong>${d.roomNumber}</strong> bên dưới.</p>

      <div style="background:#f8fafc;border-radius:12px;padding:16px 18px;margin:16px 0">
        <table width="100%" style="border-collapse:collapse;font-size:14px">
          <tr><td style="padding:6px 0;color:#64748b">Mã hoá đơn</td><td style="padding:6px 0;text-align:right;font-family:monospace">${d.invoiceCode}</td></tr>
          <tr><td style="padding:6px 0;color:#64748b">Hạn thanh toán</td><td style="padding:6px 0;text-align:right">${formatDateVN(d.dueDate)}</td></tr>
        </table>
      </div>

      <table width="100%" style="border-collapse:collapse;font-size:14px;margin:8px 0">
        ${row("Tiền thuê", formatVND(d.rentAmount))}
        ${d.vatAmount > 0n ? row("VAT", formatVND(d.vatAmount)) : ""}
        ${row(`Tiền điện (${elec})`, formatVND(d.electricityFee))}
        ${d.parkingFee > 0n ? row(`Phí gửi xe (${d.parkingCount} xe)`, formatVND(d.parkingFee)) : ""}
        ${d.overtimeFee > 0n ? row("Phí làm ngoài giờ", formatVND(d.overtimeFee)) : ""}
        ${d.serviceFee > 0n ? row("Phí dịch vụ", formatVND(d.serviceFee)) : ""}
        <tr><td colspan="2"><hr style="border:none;border-top:1px solid #e2e8f0;margin:8px 0"></td></tr>
        ${row("Tổng phải thu", formatVND(d.totalAmount), true)}
        ${d.paidAmount > 0n ? row("Đã thu", formatVND(d.paidAmount)) : ""}
        ${remaining > 0n ? row("Còn lại", formatVND(remaining), true) : ""}
      </table>

      ${d.notes ? `<div style="margin-top:16px;padding:12px;background:#fef3c7;border-radius:8px;font-size:13px;color:#78350f"><strong>Ghi chú:</strong> ${d.notes}</div>` : ""}

      <p style="margin:24px 0 0;color:#94a3b8;font-size:12px">Cảm ơn quý khách. Vui lòng liên hệ nếu có thắc mắc.</p>
    </div>
  </div>
</body></html>`;
}
