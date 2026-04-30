import * as XLSX from "xlsx";

export type ExcelImportResult<T> = {
  rows: T[];
  errors: { row: number; message: string }[];
};

const SHEETS = {
  BUILDINGS: "Toa_nha",
  ROOMS: "Phong",
  CUSTOMERS: "Khach_hang",
  CONTRACTS: "Hop_dong",
  TRANSACTIONS: "Giao_dich",
} as const;

export type SheetKey = keyof typeof SHEETS;

export type BuildingRow = {
  name: string;
  address: string;
  type: "CHDV" | "VP";
};

export type RoomRow = {
  buildingName: string;
  number: string;
};

export type CustomerRow = {
  buildingName: string;
  type: "INDIVIDUAL" | "COMPANY";
  fullName?: string;
  idNumber?: string;
  phone?: string;
  email?: string;
  licensePlate?: string;
  companyName?: string;
  taxNumber?: string;
};

export type ContractRow = {
  buildingName: string;
  roomNumber: string;
  customerName: string;     // matches Customer fullName or companyName
  startDate: string;        // YYYY-MM-DD
  termMonths: number;
  monthlyRent: number;
  vatRate?: number;         // 0..1
  depositAmount?: number;
  paymentDay: number;
  parkingCount?: number;
  parkingFeePerVehicle?: number;
  serviceFeeAmount?: number;
  electricityPricePerKwh?: number;
};

export type TransactionRow = {
  buildingName: string;
  date: string;             // YYYY-MM-DD
  type: "INCOME" | "EXPENSE";
  amount: number;
  content: string;
  categoryName?: string;
  paymentMethodName?: string;
  partyName?: string;       // either customer fullName/companyName or party name
  countInBR?: boolean;
};

export function readWorkbook(buf: Buffer): XLSX.WorkBook {
  return XLSX.read(buf, { type: "buffer", cellDates: true });
}

export function parseSheet<T>(wb: XLSX.WorkBook, sheetName: string, validate: (row: Record<string, unknown>, idx: number) => T | string): ExcelImportResult<T> {
  const ws = wb.Sheets[sheetName];
  if (!ws) return { rows: [], errors: [] };
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: null, raw: false });
  const rows: T[] = [];
  const errors: { row: number; message: string }[] = [];
  json.forEach((r, i) => {
    const out = validate(r, i + 2); // +2 since header row is 1
    if (typeof out === "string") errors.push({ row: i + 2, message: out });
    else rows.push(out);
  });
  return { rows, errors };
}

export function buildTemplateWorkbook(): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ["name", "address", "type"],
    ["CHDV 1 - Trần Thái Tông", "45/10 Trần Thái Tông", "CHDV"],
    ["VP 1 - Lê Trung Nghĩa", "30 Lê Trung Nghĩa", "VP"],
  ]), SHEETS.BUILDINGS);

  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ["buildingName", "number"],
    ["CHDV 1 - Trần Thái Tông", "101"],
    ["CHDV 1 - Trần Thái Tông", "102"],
  ]), SHEETS.ROOMS);

  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ["buildingName", "type", "fullName", "idNumber", "phone", "email", "licensePlate", "companyName", "taxNumber"],
    ["CHDV 1 - Trần Thái Tông", "INDIVIDUAL", "Nguyễn Văn A", "079000000000", "0901234567", "a@example.com", "59A-12345", "", ""],
    ["VP 1 - Lê Trung Nghĩa", "COMPANY", "", "", "0907654321", "ceo@cty.com", "", "Công ty ABC", "0123456789"],
  ]), SHEETS.CUSTOMERS);

  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ["buildingName", "roomNumber", "customerName", "startDate", "termMonths", "monthlyRent", "vatRate", "depositAmount", "paymentDay", "parkingCount", "parkingFeePerVehicle", "serviceFeeAmount", "electricityPricePerKwh"],
    ["CHDV 1 - Trần Thái Tông", "101", "Nguyễn Văn A", "2026-01-01", 12, 8000000, 0, 16000000, 5, 1, 100000, 0, 3500],
    ["VP 1 - Lê Trung Nghĩa", "201", "Công ty ABC", "2026-01-01", 24, 30000000, 0.1, 60000000, 5, 2, 200000, 500000, 3500],
  ]), SHEETS.CONTRACTS);

  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ["buildingName", "date", "type", "amount", "content", "categoryName", "paymentMethodName", "partyName", "countInBR"],
    ["CHDV 1 - Trần Thái Tông", "2026-01-15", "INCOME", 8000000, "Tiền thuê phòng 101 T1", "Tiền thuê phòng", "Chuyển khoản BIDV", "Nguyễn Văn A", true],
    ["CHDV 1 - Trần Thái Tông", "2026-01-20", "EXPENSE", 500000, "Sửa máy lạnh", "Sửa chữa", "Tiền mặt", "Thợ sửa chữa", true],
  ]), SHEETS.TRANSACTIONS);

  return wb;
}

// ---------------- validators ----------------

const req = (v: unknown): string | null => {
  if (v === null || v === undefined || v === "") return null;
  return String(v).trim();
};

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(String(v).replace(/[, ]/g, ""));
  return Number.isFinite(n) ? n : null;
};

const bool = (v: unknown): boolean => {
  const s = String(v ?? "").toLowerCase().trim();
  return s === "true" || s === "1" || s === "yes" || s === "x";
};

export function validateBuilding(r: Record<string, unknown>): BuildingRow | string {
  const name = req(r.name);
  const address = req(r.address);
  const type = req(r.type);
  if (!name) return "Thiếu name";
  if (!address) return "Thiếu address";
  if (type !== "CHDV" && type !== "VP") return "type phải là CHDV hoặc VP";
  return { name, address, type };
}

export function validateRoom(r: Record<string, unknown>): RoomRow | string {
  const buildingName = req(r.buildingName);
  const number = req(r.number);
  if (!buildingName) return "Thiếu buildingName";
  if (!number) return "Thiếu number";
  return { buildingName, number };
}

export function validateCustomer(r: Record<string, unknown>): CustomerRow | string {
  const buildingName = req(r.buildingName);
  const type = req(r.type);
  if (!buildingName) return "Thiếu buildingName";
  if (type !== "INDIVIDUAL" && type !== "COMPANY") return "type phải là INDIVIDUAL hoặc COMPANY";
  if (type === "INDIVIDUAL" && !req(r.fullName)) return "Cá nhân cần fullName";
  if (type === "COMPANY" && !req(r.companyName)) return "Công ty cần companyName";
  return {
    buildingName,
    type,
    fullName: req(r.fullName) ?? undefined,
    idNumber: req(r.idNumber) ?? undefined,
    phone: req(r.phone) ?? undefined,
    email: req(r.email) ?? undefined,
    licensePlate: req(r.licensePlate) ?? undefined,
    companyName: req(r.companyName) ?? undefined,
    taxNumber: req(r.taxNumber) ?? undefined,
  };
}

export function validateContract(r: Record<string, unknown>): ContractRow | string {
  const buildingName = req(r.buildingName);
  const roomNumber = req(r.roomNumber);
  const customerName = req(r.customerName);
  const startDate = req(r.startDate);
  const termMonths = num(r.termMonths);
  const monthlyRent = num(r.monthlyRent);
  const paymentDay = num(r.paymentDay);
  if (!buildingName || !roomNumber || !customerName) return "Thiếu buildingName/roomNumber/customerName";
  if (!startDate) return "Thiếu startDate";
  if (!termMonths || termMonths < 1) return "termMonths không hợp lệ";
  if (!monthlyRent || monthlyRent < 0) return "monthlyRent không hợp lệ";
  if (!paymentDay || paymentDay < 1 || paymentDay > 28) return "paymentDay phải 1-28";
  return {
    buildingName,
    roomNumber,
    customerName,
    startDate: new Date(startDate).toISOString().slice(0, 10),
    termMonths,
    monthlyRent,
    paymentDay,
    vatRate: num(r.vatRate) ?? 0,
    depositAmount: num(r.depositAmount) ?? 0,
    parkingCount: num(r.parkingCount) ?? 0,
    parkingFeePerVehicle: num(r.parkingFeePerVehicle) ?? 0,
    serviceFeeAmount: num(r.serviceFeeAmount) ?? 0,
    electricityPricePerKwh: num(r.electricityPricePerKwh) ?? 3500,
  };
}

export function validateTransaction(r: Record<string, unknown>): TransactionRow | string {
  const buildingName = req(r.buildingName);
  const date = req(r.date);
  const type = req(r.type);
  const amount = num(r.amount);
  const content = req(r.content);
  if (!buildingName) return "Thiếu buildingName";
  if (!date) return "Thiếu date";
  if (type !== "INCOME" && type !== "EXPENSE") return "type phải INCOME hoặc EXPENSE";
  if (!amount || amount < 0) return "amount không hợp lệ";
  if (!content) return "Thiếu content";
  return {
    buildingName,
    date: new Date(date).toISOString().slice(0, 10),
    type,
    amount,
    content,
    categoryName: req(r.categoryName) ?? undefined,
    paymentMethodName: req(r.paymentMethodName) ?? undefined,
    partyName: req(r.partyName) ?? undefined,
    countInBR: bool(r.countInBR),
  };
}

export const SHEET_NAMES = SHEETS;
