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
