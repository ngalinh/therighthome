import { formatVND, formatDateVN } from "@/lib/utils";
import { vietQrUrl } from "@/lib/vn-banks";

export type VatFeeKey = "electricity" | "parking" | "overtime" | "repair" | "extraParking";

export type InvoiceEmailData = {
  buildingName: string;
  buildingAddress: string;
  buildingType: "CHDV" | "VP";
  customerName: string;
  customerPhone: string | null;
  roomNumber: string;
  invoiceCode: string;
  month: number;
  year: number;
  rentPeriod: string;
  dueDate: Date;
  rentAmount: bigint;
  vatAmount: bigint;
  electricityStart: number | null;
  electricityEnd: number | null;
  electricityFee: bigint;
  electricityPricePerKwh: bigint;
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
  vatRate: number;
  vatApplicableFees: VatFeeKey[];
  notes?: string | null;
  isManual?: boolean;
  lineItems?: { content: string; categoryName: string | null; amount: bigint }[];
  paymentMethod: {
    bankName: string | null;
    bankBin: string | null;
    accountHolder: string | null;
    accountNumber: string | null;
    qrCodeUrl: string | null;
  } | null;
};

const KEY_ICON_SVG = `<table style="border-collapse:collapse;display:inline-table"><tr><td style="width:48px;height:48px;border-radius:12px;background:rgba(255,255,255,0.2);border:1px solid rgba(255,255,255,0.3);text-align:center;vertical-align:middle;padding:10px">
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff7e8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block">
    <path d="M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 0 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 0 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z" />
    <circle cx="16.5" cy="7.5" r=".5" fill="#fff7e8" />
  </svg>
</td></tr></table>`;

function costRow(label: string, value: string, bold = false, positive = false, danger = false) {
  const valueStyle = [
    bold ? "font-weight:700;font-size:15px;" : "font-size:13px;",
    danger ? "color:#dc2626;" : positive ? "color:#16a34a;" : "color:#1e293b;",
  ].join("");
  return `<tr>
    <td style="padding:5px 0;color:#475569;font-size:13px">${label}</td>
    <td style="padding:5px 0;text-align:right;${valueStyle}">${value}</td>
  </tr>`;
}

function feeCostRow(label: string, base: bigint, withVat: boolean, vatRate: number): string {
  if (!withVat || vatRate <= 0) return costRow(label, formatVND(base));
  const vat = BigInt(Math.round(Number(base) * vatRate));
  const gross = base + vat;
  const vatPct = Math.round(vatRate * 100);
  return costRow(`${label} (+${vatPct}% VAT: ${formatVND(vat)})`, formatVND(gross));
}

export function renderInvoiceEmail(d: InvoiceEmailData): string {
  const remaining = d.totalAmount - d.paidAmount;
  const kwh = d.electricityStart !== null && d.electricityEnd !== null && d.electricityEnd > d.electricityStart
    ? d.electricityEnd - d.electricityStart : 0;
  const prevMonth = d.month === 1 ? 12 : d.month - 1;

  // Transfer info
  const phoneDigits = (d.customerPhone ?? "").replace(/\D/g, "");
  const transferContent = phoneDigits ? `DT${phoneDigits}` : `${d.invoiceCode} ${d.roomNumber}`;
  const amountForQr = remaining > 0n ? remaining : d.totalAmount;
  const qrSrc = vietQrUrl({
    bankBin: d.paymentMethod?.bankBin,
    accountNumber: d.paymentMethod?.accountNumber,
    accountHolder: d.paymentMethod?.accountHolder,
    amount: amountForQr.toString(),
    memo: transferContent,
    template: "qr_only",
  }) ?? d.paymentMethod?.qrCodeUrl ?? null;

  // Cost rows — same logic as ReceiptCard
  let costRows = "";
  if (d.isManual && d.lineItems && d.lineItems.length > 0) {
    costRows = d.lineItems.map((l) =>
      costRow(l.categoryName ? `${l.categoryName} — ${l.content}` : l.content, formatVND(l.amount))
    ).join("");
  } else if (d.buildingType === "VP" && d.vatRate > 0) {
    // VP with VAT: all NET lines, then subtotal + VAT
    const vatOf = (n: bigint, key: VatFeeKey) =>
      d.vatApplicableFees.includes(key) ? BigInt(Math.round(Number(n) * d.vatRate)) : 0n;
    const elecVat = vatOf(d.electricityFee, "electricity");
    const parkVat = vatOf(d.parkingFee, "parking");
    const otVat = vatOf(d.overtimeFee, "overtime");
    const repVat = vatOf(d.repairFee, "repair");
    const exParkVat = vatOf(d.extraParkingFee, "extraParking");
    const feeVatTotal = elecVat + parkVat + otVat + repVat + exParkVat;
    const netRent = d.rentAmount - d.vatAmount;
    const totalVat = d.vatAmount + feeVatTotal;
    const subtotal = d.totalAmount - totalVat;
    const vatPct = Math.round(d.vatRate * 100);
    costRows = [
      costRow(`Tiền thuê (${d.rentPeriod})`, formatVND(netRent)),
      d.electricityFee > 0n ? costRow(`Tiền điện T${prevMonth}${kwh > 0 ? ` (${kwh} kWh × ${formatVND(d.electricityPricePerKwh)})` : ""}`, formatVND(d.electricityFee)) : "",
      d.parkingFee > 0n ? costRow(`Phí xe (${d.parkingCount} xe)`, formatVND(d.parkingFee)) : "",
      d.overtimeFee > 0n ? costRow("Phí ngoài giờ", formatVND(d.overtimeFee)) : "",
      d.repairFee > 0n ? costRow("Phí sửa chữa", formatVND(d.repairFee)) : "",
      d.extraParkingFee > 0n ? costRow("Phí xe lẻ", formatVND(d.extraParkingFee)) : "",
      `<tr><td colspan="2" style="padding:4px 0"><div style="height:1px;background:#e2e8f0"></div></td></tr>`,
      costRow("Cộng chưa VAT", formatVND(subtotal)),
      costRow(`VAT (${vatPct}%)`, formatVND(totalVat)),
    ].join("");
  } else {
    const rentLabel = d.vatAmount > 0n
      ? `Tiền thuê (${d.rentPeriod}) · đã VAT, gồm ${formatVND(d.vatAmount)}`
      : `Tiền thuê (${d.rentPeriod})`;
    costRows = [
      costRow(rentLabel, formatVND(d.rentAmount)),
      d.electricityFee > 0n ? feeCostRow(`Tiền điện T${prevMonth}${kwh > 0 ? ` (${kwh} kWh × ${formatVND(d.electricityPricePerKwh)})` : ""}`, d.electricityFee, d.vatApplicableFees.includes("electricity"), d.vatRate) : "",
      d.buildingType === "CHDV" && d.waterFee > 0n ? costRow(`Tiền nước (${d.waterOccupants} người × ${formatVND(d.waterPricePerPerson)})`, formatVND(d.waterFee)) : "",
      d.parkingFee > 0n ? feeCostRow(`Phí xe (${d.parkingCount} xe)`, d.parkingFee, d.vatApplicableFees.includes("parking"), d.vatRate) : "",
      d.buildingType === "VP" && d.overtimeFee > 0n ? feeCostRow("Phí ngoài giờ", d.overtimeFee, d.vatApplicableFees.includes("overtime"), d.vatRate) : "",
      d.buildingType === "VP" && d.repairFee > 0n ? feeCostRow("Phí sửa chữa", d.repairFee, d.vatApplicableFees.includes("repair"), d.vatRate) : "",
      d.buildingType === "VP" && d.extraParkingFee > 0n ? feeCostRow("Phí xe lẻ", d.extraParkingFee, d.vatApplicableFees.includes("extraParking"), d.vatRate) : "",
      d.buildingType === "CHDV" && d.serviceFee > 0n ? costRow("Phí dịch vụ", formatVND(d.serviceFee)) : "",
    ].join("");
  }

  return `<!doctype html>
<html><body style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;background:#f1f5f9;margin:0;padding:24px">
<div style="max-width:540px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">

  <!-- Header -->
  <div style="background:linear-gradient(135deg,#c96442 0%,#d5866c 100%);padding:24px 28px">
    <table style="border-collapse:collapse;width:100%"><tr>
      <td style="vertical-align:middle;width:60px">${KEY_ICON_SVG}</td>
      <td style="vertical-align:middle;padding-left:12px">
        <div style="font-size:10px;font-weight:600;letter-spacing:0.2em;opacity:0.9;color:#fff;margin-bottom:2px">${d.buildingType === "VP" ? "K300 OFFICE" : "THE RIGHT HOME"}</div>
        <div style="font-size:18px;font-weight:700;color:#fff;line-height:1.2">${d.buildingName}</div>
        <div style="font-size:11px;opacity:0.9;color:#fff;margin-top:2px">${d.buildingAddress}</div>
      </td>
    </tr></table>
    <div style="margin-top:16px;display:table;width:100%">
      <div style="display:table-cell;vertical-align:bottom">
        <div style="font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.8)">Phiếu thanh toán</div>
        <div style="font-size:15px;font-weight:600;color:#fff">Tháng ${String(d.month).padStart(2, "0")}/${d.year}</div>
      </div>
      <div style="display:table-cell;text-align:right;vertical-align:bottom">
        <div style="font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.8)">Mã hoá đơn</div>
        <div style="font-family:monospace;font-size:13px;font-weight:600;color:#fff">${d.invoiceCode}</div>
      </div>
    </div>
  </div>

  <!-- Customer info -->
  <div style="padding:16px 28px;border-bottom:1px solid #e2e8f0;background:#fafafa">
    <table width="100%" style="border-collapse:collapse">
      <tr>
        <td style="padding:0 12px 10px 0;vertical-align:top;width:50%">
          <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.1em;color:#94a3b8;margin-bottom:3px">Khách hàng</div>
          <div style="font-size:13px;font-weight:600;color:#1e293b">${d.customerName}</div>
        </td>
        <td style="padding:0 0 10px 0;vertical-align:top;width:50%">
          <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.1em;color:#94a3b8;margin-bottom:3px">Phòng</div>
          <div style="font-size:13px;font-weight:600;color:#1e293b">${d.roomNumber}</div>
        </td>
      </tr>
      <tr>
        <td style="padding:0 12px 0 0;vertical-align:top">
          <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.1em;color:#94a3b8;margin-bottom:3px">Hạn thanh toán</div>
          <div style="font-size:13px;font-weight:600;color:#1e293b">${formatDateVN(d.dueDate)}</div>
        </td>
        <td style="vertical-align:top">
          <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.1em;color:#94a3b8;margin-bottom:3px">Loại</div>
          <div style="font-size:13px;font-weight:600;color:#1e293b">${d.buildingType === "CHDV" ? "Căn hộ dịch vụ" : "Văn phòng"}</div>
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
        <tr><td colspan="2" style="padding:6px 0"><div style="height:1px;background:#e2e8f0"></div></td></tr>
        ${costRow("Tổng phải thu", formatVND(d.totalAmount), true)}
        ${d.paidAmount > 0n ? costRow("Đã thu", formatVND(d.paidAmount), false, true) : ""}
        ${remaining > 0n ? costRow("Còn lại", formatVND(remaining), true, false, true) : ""}
      </tfoot>
    </table>
    ${d.notes ? `<div style="margin-top:12px;padding:10px 12px;background:#fef9ec;border-radius:8px;font-size:12px;color:#78350f;border-left:3px solid #f59e0b"><strong>Ghi chú:</strong> ${d.notes}</div>` : ""}
  </div>

  ${d.paymentMethod ? `
  <!-- Bank transfer -->
  <div style="padding:16px 28px 20px;border-top:1px solid #e2e8f0;background:#f8fafc">
    <div style="font-size:10px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:#94a3b8;margin-bottom:12px">Thông tin chuyển khoản</div>
    <table width="100%" style="border-collapse:collapse">
      <tr>
        <td style="vertical-align:top">
          <table style="border-collapse:collapse;font-size:13px">
            ${d.paymentMethod.bankName ? `<tr><td style="color:#64748b;padding:3px 16px 3px 0;min-width:130px">Ngân hàng:</td><td style="font-weight:600;color:#1e293b">${d.paymentMethod.bankName}</td></tr>` : ""}
            ${d.paymentMethod.accountHolder ? `<tr><td style="color:#64748b;padding:3px 16px 3px 0">Chủ tài khoản:</td><td style="font-weight:600;color:#1e293b">${d.paymentMethod.accountHolder}</td></tr>` : ""}
            ${d.paymentMethod.accountNumber ? `<tr><td style="color:#64748b;padding:3px 16px 3px 0">Số tài khoản:</td><td style="font-family:monospace;font-weight:600;color:#1e293b">${d.paymentMethod.accountNumber}</td></tr>` : ""}
            <tr><td style="color:#64748b;padding:3px 16px 3px 0">Nội dung CK:</td><td style="font-family:monospace;font-weight:600;color:#1e293b">${transferContent}</td></tr>
            <tr><td style="color:#64748b;padding:3px 16px 3px 0">Số tiền CK:</td><td style="font-family:monospace;font-weight:600;color:#1e293b">${formatVND(amountForQr)}</td></tr>
          </table>
        </td>
        ${qrSrc ? `<td style="text-align:center;vertical-align:top;padding-left:16px;width:160px">
          <img src="${qrSrc}" alt="QR chuyển khoản" width="140" height="140" style="display:block;border-radius:8px" />
          <div style="font-size:10px;color:#94a3b8;margin-top:4px">Quét để chuyển khoản</div>
        </td>` : ""}
      </tr>
    </table>
  </div>` : ""}

  <!-- Footer -->
  <div style="padding:14px 28px;text-align:center;border-top:1px solid #e2e8f0">
    <p style="margin:0;font-size:11px;color:#94a3b8">Cảm ơn quý khách đã sử dụng dịch vụ của ${d.buildingType === "VP" ? "K300 Office" : "The Right Home"}</p>
  </div>

</div>
</body></html>`;
}
