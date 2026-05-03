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

export function formatDateVN(d: Date | string | null | undefined): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
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
