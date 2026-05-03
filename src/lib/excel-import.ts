import * as XLSX from "xlsx";

export type ExcelImportResult<T> = {
  rows: T[];
  errors: { row: number; message: string }[];
};

export const SHEETS = {
  CHDV: "Căn hộ dịch vụ",
  VP: "Văn phòng",
} as const;

// Only buildingName + roomNumber are required on each row. Everything else is
// optional — rows with partial data still upsert the building/room (and the
// customer if a name is given), and only create a contract when enough fields
// are present (startDate + termMonths + monthlyRent + paymentDay).
export type ChdvRow = {
  buildingName: string;
  roomNumber: string;
  fullName?: string;
  idNumber?: string;
  phone?: string;
  licensePlate?: string;
  depositAmount?: number;
  termMonths?: number;
  startDate?: string;       // YYYY-MM-DD
  endDate?: string;
  monthlyRent?: number;
  serviceFeeAmount?: number;
  paymentDay?: number;      // 1..28
  notes?: string;
};

export type VpRow = {
  buildingName: string;
  roomNumber: string;
  companyName?: string;
  phone?: string;
  email?: string;
  monthlyRent?: number;     // already after VAT
  depositAmount?: number;
  termMonths?: number;
  startDate?: string;
  endDate?: string;
  paymentDay?: number;
  notes?: string;
};

export function readWorkbook(buf: Buffer): XLSX.WorkBook {
  return XLSX.read(buf, { type: "buffer", cellDates: true });
}

// Expand merged cells in-place: copy the anchor (top-left) cell's value into
// every cell of the merge range. This way users can vertically-merge the
// "Toà nhà" / "Phòng" columns when several rows share the same value.
function expandMerges(ws: XLSX.WorkSheet): void {
  const merges = ws["!merges"] as XLSX.Range[] | undefined;
  if (!merges || merges.length === 0) return;
  for (const m of merges) {
    const anchorAddr = XLSX.utils.encode_cell(m.s);
    const anchor = ws[anchorAddr];
    if (!anchor) continue;
    for (let r = m.s.r; r <= m.e.r; r++) {
      for (let c = m.s.c; c <= m.e.c; c++) {
        const addr = XLSX.utils.encode_cell({ r, c });
        if (addr !== anchorAddr) ws[addr] = { ...anchor };
      }
    }
  }
}

export function parseSheet<T>(
  wb: XLSX.WorkBook,
  sheetName: string,
  validate: (row: Record<string, unknown>) => T | string,
): ExcelImportResult<T> {
  const ws = wb.Sheets[sheetName];
  if (!ws) return { rows: [], errors: [] };
  expandMerges(ws);
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: null, raw: false });
  const rows: T[] = [];
  const errors: { row: number; message: string }[] = [];
  json.forEach((r, i) => {
    // Skip rows that look entirely blank.
    const allEmpty = Object.values(r).every((v) => v === null || v === undefined || String(v).trim() === "");
    if (allEmpty) return;
    const out = validate(r);
    if (typeof out === "string") errors.push({ row: i + 2, message: out });
    else rows.push(out);
  });
  return { rows, errors };
}

export function buildTemplateWorkbook(): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      [
        "Toà nhà", "Phòng", "Họ và tên khách", "CCCD", "SĐT", "Biển số xe",
        "Số tiền cọc", "Thời gian HĐ", "Ngày bắt đầu", "Ngày kết thúc",
        "Giá thuê", "Phí dịch vụ", "Hạn thanh toán", "Ghi chú",
      ],
      [
        "CHDV 1 - Trần Thái Tông", "101", "Nguyễn Văn A", "079000000000", "0901234567", "59A-12345",
        16000000, 12, "2026-01-01", "2027-01-01",
        8000000, 0, 5, "",
      ],
    ]),
    SHEETS.CHDV,
  );

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      [
        "Toà nhà", "Phòng", "Tên công ty", "SĐT", "Email",
        "Giá thuê (sau VAT)", "Số tiền cọc", "Thời gian HĐ", "Ngày bắt đầu", "Ngày kết thúc",
        "Hạn thanh toán", "Ghi chú",
      ],
      [
        "30 Lê Trung Nghĩa", "201", "Công ty ABC", "0907654321", "ceo@cty.com",
        33000000, 60000000, 24, "2026-01-01", "2028-01-01",
        5, "",
      ],
    ]),
    SHEETS.VP,
  );

  return wb;
}

// ---------------- helpers ----------------

const txt = (v: unknown): string | null => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
};

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(String(v).replace(/[, ]/g, ""));
  return Number.isFinite(n) ? n : null;
};

// Accepts JS Date, ISO string, DD/MM/YYYY or DD/MM/YY (Vietnamese style).
const date = (v: unknown): string | null => {
  if (v === null || v === undefined || v === "") return null;
  if (v instanceof Date) {
    if (isNaN(v.getTime())) return null;
    return v.toISOString().slice(0, 10);
  }
  const s = String(v).trim();
  // DD/MM/YYYY or DD/MM/YY
  const m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/);
  if (m) {
    const dd = Number(m[1]);
    const mm = Number(m[2]);
    let yy = Number(m[3]);
    if (m[3].length === 2) yy = 2000 + yy; // 25 → 2025
    const d = new Date(yy, mm - 1, dd);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
};

// ---------------- validators ----------------

export function validateChdv(r: Record<string, unknown>): ChdvRow | string {
  const buildingName = txt(r["Toà nhà"]);
  const roomNumber = txt(r["Phòng"]);
  if (!buildingName) return "Thiếu Toà nhà";
  if (!roomNumber) return "Thiếu Phòng";

  // Bound checks that only apply when the field IS provided.
  const paymentDay = num(r["Hạn thanh toán"]);
  if (paymentDay !== null && (paymentDay < 1 || paymentDay > 28)) return "Hạn thanh toán phải 1-28";

  return {
    buildingName,
    roomNumber,
    fullName: txt(r["Họ và tên khách"]) ?? undefined,
    idNumber: txt(r["CCCD"]) ?? undefined,
    phone: txt(r["SĐT"]) ?? undefined,
    licensePlate: txt(r["Biển số xe"]) ?? undefined,
    depositAmount: num(r["Số tiền cọc"]) ?? undefined,
    termMonths: num(r["Thời gian HĐ"]) ?? undefined,
    startDate: date(r["Ngày bắt đầu"]) ?? undefined,
    endDate: date(r["Ngày kết thúc"]) ?? undefined,
    monthlyRent: num(r["Giá thuê"]) ?? undefined,
    serviceFeeAmount: num(r["Phí dịch vụ"]) ?? undefined,
    paymentDay: paymentDay ?? undefined,
    notes: txt(r["Ghi chú"]) ?? undefined,
  };
}

export function validateVp(r: Record<string, unknown>): VpRow | string {
  const buildingName = txt(r["Toà nhà"]);
  const roomNumber = txt(r["Phòng"]);
  if (!buildingName) return "Thiếu Toà nhà";
  if (!roomNumber) return "Thiếu Phòng";

  const paymentDay = num(r["Hạn thanh toán"]);
  if (paymentDay !== null && (paymentDay < 1 || paymentDay > 28)) return "Hạn thanh toán phải 1-28";

  return {
    buildingName,
    roomNumber,
    companyName: txt(r["Tên công ty"]) ?? undefined,
    phone: txt(r["SĐT"]) ?? undefined,
    email: txt(r["Email"]) ?? undefined,
    monthlyRent: num(r["Giá thuê (sau VAT)"]) ?? undefined,
    depositAmount: num(r["Số tiền cọc"]) ?? undefined,
    termMonths: num(r["Thời gian HĐ"]) ?? undefined,
    startDate: date(r["Ngày bắt đầu"]) ?? undefined,
    endDate: date(r["Ngày kết thúc"]) ?? undefined,
    paymentDay: paymentDay ?? undefined,
    notes: txt(r["Ghi chú"]) ?? undefined,
  };
}
