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
  isManual?: boolean;
  lineItems?: { content: string; categoryName: string | null; amount: bigint }[];
};

const row = (label: string, value: string, bold = false, positive = false, danger = false) => {
  const valueStyle = bold
    ? "font-weight:700;font-size:15px;" + (danger ? "color:#dc2626" : positive ? "color:#16a34a" : "")
    : positive ? "color:#16a34a" : danger ? "color:#dc2626" : "";
  return `<tr>
    <td style="padding:5px 0;color:#64748b;font-size:13px">${label}</td>
    <td style="padding:5px 0;text-align:right;font-size:13px;${valueStyle}">${value}</td>
  </tr>`;
};

const infoCell = (label: string, value: string) =>
  `<td style="padding:0 12px 0 0;vertical-align:top">
    <div style="font-size:10px;letter-spacing:0.1em;text-transform:uppercase;color:rgba(255,255,255,0.7);margin-bottom:2px">${label}</div>
    <div style="font-size:13px;font-weight:600;color:#fff">${value}</div>
  </td>`;

export function renderInvoiceEmail(d: InvoiceEmailData): string {
  const remaining = d.totalAmount - d.paidAmount;
  const kwh = d.electricityStart !== null && d.electricityEnd !== null && d.electricityEnd > d.electricityStart
    ? d.electricityEnd - d.electricityStart
    : 0;
  const prevMonth = d.month === 1 ? 12 : d.month - 1;

  const costRows = d.isManual && d.lineItems && d.lineItems.length > 0
    ? d.lineItems.map((l) =>
        row(l.categoryName ? `${l.categoryName} — ${l.content}` : l.content, formatVND(l.amount))
      ).join("")
    : [
        row(
          d.vatAmount > 0n
            ? `Tiền thuê (đã VAT, gồm ${formatVND(d.vatAmount)} VAT)`
            : "Tiền thuê",
          formatVND(d.rentAmount),
        ),
        d.electricityFee > 0n
          ? row(`Tiền điện T${prevMonth}${kwh > 0 ? ` (${kwh} kWh)` : ""}`, formatVND(d.electricityFee))
          : "",
        d.parkingFee > 0n ? row(`Phí gửi xe (${d.parkingCount} xe)`, formatVND(d.parkingFee)) : "",
        d.overtimeFee > 0n ? row("Phí ngoài giờ", formatVND(d.overtimeFee)) : "",
        d.serviceFee > 0n ? row("Phí dịch vụ", formatVND(d.serviceFee)) : "",
      ].join("");

  return `<!doctype html>
<html><body style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;background:#f1f5f9;margin:0;padding:24px">
  <div style="max-width:540px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#c96442 0%,#d5866c 100%);padding:24px 28px">
      <div style="font-size:10px;font-weight:600;letter-spacing:0.2em;opacity:0.85;text-transform:uppercase;color:#fff;margin-bottom:16px">THE RIGHT HOME</div>
      <div style="font-size:20px;font-weight:700;color:#fff;margin-bottom:2px">${d.buildingName}</div>
      <div style="font-size:12px;opacity:0.85;color:#fff;margin-bottom:16px">${d.buildingAddress}</div>
      <div style="height:1px;background:rgba(255,255,255,0.2);margin-bottom:16px"></div>
      <table width="100%" style="border-collapse:collapse">
        <tr>
          <td style="font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.75);padding-bottom:2px">Phiếu thanh toán</td>
          <td style="text-align:right;font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.75);padding-bottom:2px">Mã hoá đơn</td>
        </tr>
        <tr>
          <td style="font-size:15px;font-weight:600;color:#fff">Tháng ${String(d.month).padStart(2, "0")}/${d.year}</td>
          <td style="text-align:right;font-family:monospace;font-size:13px;font-weight:600;color:#fff">${d.invoiceCode}</td>
        </tr>
      </table>
    </div>

    <!-- Customer info -->
    <div style="background:#fdf8f5;padding:16px 28px;border-bottom:1px solid #e2e8f0">
      <table width="100%" style="border-collapse:collapse">
        <tr>
          <td style="padding:0 16px 0 0;vertical-align:top;width:50%">
            <div style="font-size:10px;letter-spacing:0.1em;text-transform:uppercase;color:#94a3b8;margin-bottom:3px">Khách hàng</div>
            <div style="font-size:13px;font-weight:600;color:#1e293b">${d.customerName}</div>
          </td>
          <td style="vertical-align:top;width:50%">
            <div style="font-size:10px;letter-spacing:0.1em;text-transform:uppercase;color:#94a3b8;margin-bottom:3px">Phòng</div>
            <div style="font-size:13px;font-weight:600;color:#1e293b">${d.roomNumber}</div>
          </td>
        </tr>
        <tr>
          <td style="padding-top:12px;vertical-align:top" colspan="2">
            <div style="font-size:10px;letter-spacing:0.1em;text-transform:uppercase;color:#94a3b8;margin-bottom:3px">Hạn thanh toán</div>
            <div style="font-size:13px;font-weight:600;color:#1e293b">${formatDateVN(d.dueDate)}</div>
          </td>
        </tr>
      </table>
    </div>

    <!-- Cost breakdown -->
    <div style="padding:20px 28px">
      <div style="font-size:10px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:#94a3b8;margin-bottom:12px">Chi tiết chi phí</div>
      <table width="100%" style="border-collapse:collapse">
        <tbody>
          ${costRows}
        </tbody>
        <tfoot>
          <tr><td colspan="2" style="padding:8px 0"><div style="height:1px;background:#e2e8f0"></div></td></tr>
          ${row("Tổng phải thu", formatVND(d.totalAmount), true)}
          ${d.paidAmount > 0n ? row("Đã thu", formatVND(d.paidAmount), false, true) : ""}
          ${remaining > 0n ? row("Còn lại", formatVND(remaining), true, false, true) : ""}
        </tfoot>
      </table>

      ${d.notes ? `<div style="margin-top:16px;padding:12px 14px;background:#fef9ec;border-radius:8px;font-size:12px;color:#78350f;border-left:3px solid #f59e0b"><strong>Ghi chú:</strong> ${d.notes}</div>` : ""}
    </div>

    <!-- Footer -->
    <div style="padding:16px 28px;background:#f8fafc;border-top:1px solid #e2e8f0">
      <p style="margin:0;color:#94a3b8;font-size:12px;text-align:center">Vui lòng liên hệ nếu có thắc mắc. Cảm ơn quý khách.</p>
    </div>
  </div>
</body></html>`;
}
