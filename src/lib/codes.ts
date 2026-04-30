import { prisma } from "@/lib/prisma";

function pad(n: number, w = 3) { return String(n).padStart(w, "0"); }

function ymPart(date = new Date()) {
  const y = String(date.getFullYear()).slice(-2);
  const m = pad(date.getMonth() + 1, 2);
  return `${y}${m}`;
}

export async function nextContractCode(buildingId: string): Promise<string> {
  const ym = ymPart();
  const prefix = `HD-${ym}-`;
  const last = await prisma.contract.findFirst({
    where: { buildingId, code: { startsWith: prefix } },
    orderBy: { code: "desc" },
  });
  const lastN = last ? parseInt(last.code.slice(prefix.length), 10) : 0;
  return `${prefix}${pad(lastN + 1)}`;
}

export async function nextInvoiceCode(buildingId: string, month: number, year: number): Promise<string> {
  const ym = `${String(year).slice(-2)}${pad(month, 2)}`;
  const prefix = `HD-${ym}-`;
  const last = await prisma.invoice.findFirst({
    where: { buildingId, code: { startsWith: prefix } },
    orderBy: { code: "desc" },
  });
  const lastN = last ? parseInt(last.code.slice(prefix.length), 10) : 0;
  return `${prefix}${pad(lastN + 1)}`;
}

export async function nextTransactionCode(buildingId: string, type: "INCOME" | "EXPENSE"): Promise<string> {
  const ym = ymPart();
  const prefix = `${type === "INCOME" ? "PT" : "PC"}-${ym}-`;
  const last = await prisma.transaction.findFirst({
    where: { buildingId, code: { startsWith: prefix } },
    orderBy: { code: "desc" },
  });
  const lastN = last ? parseInt(last.code.slice(prefix.length), 10) : 0;
  return `${prefix}${pad(lastN + 1)}`;
}
