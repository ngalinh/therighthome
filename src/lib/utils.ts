import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatVND(amount: bigint | number | null | undefined): string {
  if (amount === null || amount === undefined) return "0 ₫";
  const n = typeof amount === "bigint" ? Number(amount) : amount;
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(n);
}

// Compact VND for tight stat cards: 4.000.000 → "4.000k ₫", 1.234 → "1.234 ₫".
export function formatVNDCompact(amount: bigint | number | null | undefined): string {
  if (amount === null || amount === undefined) return "0 ₫";
  const n = typeof amount === "bigint" ? Number(amount) : amount;
  if (Math.abs(n) < 1000) return formatVND(n);
  const k = Math.round(n / 1000);
  return `${new Intl.NumberFormat("vi-VN").format(k)}k ₫`;
}

export function formatNumber(n: bigint | number | null | undefined): string {
  if (n === null || n === undefined) return "0";
  const v = typeof n === "bigint" ? Number(n) : n;
  return new Intl.NumberFormat("vi-VN").format(v);
}

export function parseVNDInput(s: string): bigint {
  const digits = s.replace(/[^\d]/g, "");
  if (!digits) return 0n;
  return BigInt(digits);
}

// Convert a non-negative integer (VND) to Vietnamese words. Used to render
// "Bằng chữ: …" after monetary placeholders in contract templates.
export function numberToVietnameseWords(input: bigint | number | string | null | undefined): string {
  if (input === null || input === undefined || input === "") return "";
  let n: bigint;
  try {
    n = typeof input === "bigint" ? input : BigInt(typeof input === "number" ? Math.trunc(input) : input);
  } catch {
    return "";
  }
  if (n < 0n) return "âm " + numberToVietnameseWords(-n);
  if (n === 0n) return "không đồng";

  const digits = ["không", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"];

  // Read a 3-digit group. `leading` controls whether to emit the hundreds/tens
  // prefix when the higher digits are zero (true for non-leading groups).
  function readGroup(num: number, leading: boolean): string {
    const tr = Math.floor(num / 100);
    const ch = Math.floor((num % 100) / 10);
    const dv = num % 10;
    const out: string[] = [];
    if (tr > 0 || leading) {
      out.push(`${digits[tr]} trăm`);
      if (ch === 0 && dv > 0) out.push("lẻ");
    }
    if (ch > 1) {
      out.push(`${digits[ch]} mươi`);
      if (dv === 1) out.push("mốt");
      else if (dv === 5) out.push("lăm");
      else if (dv > 0) out.push(digits[dv]);
    } else if (ch === 1) {
      out.push("mười");
      if (dv === 5) out.push("lăm");
      else if (dv > 0) out.push(digits[dv]);
    } else if (ch === 0) {
      if (dv > 0) out.push(digits[dv]);
    }
    return out.join(" ").trim();
  }

  const groups: number[] = [];
  let rest = n;
  while (rest > 0n) {
    groups.push(Number(rest % 1000n));
    rest = rest / 1000n;
  }
  // groups[0] = units, groups[1] = thousands, groups[2] = millions, …
  const scales = ["", "nghìn", "triệu", "tỷ", "nghìn tỷ", "triệu tỷ"];
  const parts: string[] = [];
  for (let i = groups.length - 1; i >= 0; i--) {
    const g = groups[i];
    if (g === 0) continue;
    const isLeading = i === groups.length - 1;
    const text = readGroup(g, !isLeading);
    parts.push(text + (scales[i] ? " " + scales[i] : ""));
  }
  const joined = parts.join(" ").replace(/\s+/g, " ").trim();
  return `${joined} đồng`;
}

export function formatDateVN(d: Date | string | null | undefined): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// Rent period for an invoice, anchored to the contract paymentDay. For a
// contract with paymentDay D, the May invoice covers D/05 → (D-1)/06, etc.
// Returned format: "DD/MM/YY-DD/MM/YY".
export function rentPeriodLabel(
  paymentDay: number,
  invoiceMonth: number,
  invoiceYear: number,
): string {
  const day = Math.max(1, Math.min(28, paymentDay || 1));
  // Period start: paymentDay in invoice month/year
  const fromY = invoiceYear;
  const fromM = invoiceMonth;
  // Period end: (day - 1) of the following month. If day === 1, end is the
  // last day of the same invoice month.
  let toY = invoiceYear;
  let toM = invoiceMonth + 1;
  if (toM > 12) { toM = 1; toY += 1; }
  const fmt = (d: number, m: number, y: number) =>
    `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${String(y).slice(-2)}`;
  if (day === 1) {
    const lastDay = new Date(Date.UTC(fromY, fromM, 0)).getUTCDate();
    return `${fmt(1, fromM, fromY)}-${fmt(lastDay, fromM, fromY)}`;
  }
  return `${fmt(day, fromM, fromY)}-${fmt(day - 1, toM, toY)}`;
}

// Display a room number as-is. The user enters room numbers including any
// "P" prefix they want (e.g. "P201"), so we never auto-prepend one — that
// led to double-prefixed values like "PP201".
export function formatRoomNumber(n: string | null | undefined): string {
  return n ?? "";
}

export function monthsBetween(start: Date, end: Date): number {
  return (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
}

export function addMonths(d: Date, m: number): Date {
  const result = new Date(d);
  result.setMonth(result.getMonth() + m);
  return result;
}

// Sort key for room numbers. "G01"/"G02" come before any non-G room, and
// within each group we order by the trailing digits numerically. So the
// resulting order is e.g. G01, G02, P101, P102, P201, ...
export function roomSortKey(n: string): [number, number, string] {
  const trimmed = n.trim();
  const isGround = /^g/i.test(trimmed);
  const m = trimmed.match(/(\d+)/);
  const num = m ? Number(m[1]) : 0;
  return [isGround ? 0 : 1, num, trimmed];
}

export function compareRooms(a: string, b: string): number {
  const [ag, an, at] = roomSortKey(a);
  const [bg, bn, bt] = roomSortKey(b);
  if (ag !== bg) return ag - bg;
  if (an !== bn) return an - bn;
  return at.localeCompare(bt, "vi");
}

// Extract a floor identifier from a room number for grouping.
// "G01" → "G", "P101" → "1", "P603" → "6", "201" → "2".
export function roomFloor(n: string): string {
  const trimmed = n.trim();
  if (/^g/i.test(trimmed)) return "G";
  const m = trimmed.match(/(\d+)/);
  if (!m) return trimmed;
  return m[1].length === 1 ? m[1] : m[1][0];
}

// Pick the right display name for a customer:
// - Company → companyName (the registered name) preferred over the contact
//   person's fullName.
// - Individual → fullName preferred.
export function customerDisplayName(
  c: { type?: string | null; fullName?: string | null; companyName?: string | null } | null | undefined,
): string {
  if (!c) return "—";
  if (c.type === "COMPANY") return c.companyName?.trim() || c.fullName?.trim() || "—";
  return c.fullName?.trim() || c.companyName?.trim() || "—";
}

// Recursively reflect what JSON.stringify+parse does to bigints and Dates.
export type Serialized<T> =
  T extends bigint ? string :
  T extends Date ? string :
  T extends (infer U)[] ? Serialized<U>[] :
  T extends object ? { [K in keyof T]: Serialized<T[K]> } :
  T;

// Convert any BigInt/Date fields to strings recursively (for JSON serialization).
export function serializeBigInt<T>(obj: T): Serialized<T> {
  return JSON.parse(
    JSON.stringify(obj, (_k, v) => (typeof v === "bigint" ? v.toString() : v)),
  ) as Serialized<T>;
}
