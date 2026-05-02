import { prisma } from "@/lib/prisma";

function pad(n: number, w = 3) { return String(n).padStart(w, "0"); }

function ymPart(date = new Date()) {
  const y = String(date.getFullYear()).slice(-2);
  const m = pad(date.getMonth() + 1, 2);
  return `${y}${m}`;
}

/**
 * Contract code format: <TYPE>-DDMMYY-NN
 * - TYPE = building.type (CHDV | VP)
 * - DDMMYY = day/month/year of contract startDate
 * - NN = sequential number among all contracts of the same TYPE that started
 *   on the same day (across all buildings of that type), 2 digits
 *
 * Example: CHDV-051225-01, VP-191224-02
 */
export async function nextContractCode(buildingId: string, startDate: Date): Promise<string> {
  const building = await prisma.building.findUnique({
    where: { id: buildingId },
    select: { type: true },
  });
  if (!building) throw new Error("Building not found");
  const dd = pad(startDate.getDate(), 2);
  const mm = pad(startDate.getMonth() + 1, 2);
  const yy = String(startDate.getFullYear()).slice(-2);
  const prefix = `${building.type}-${dd}${mm}${yy}-`;
  const last = await prisma.contract.findFirst({
    where: { code: { startsWith: prefix } },
    orderBy: { code: "desc" },
  });
  const lastN = last ? parseInt(last.code.slice(prefix.length), 10) : 0;
  return `${prefix}${pad(lastN + 1, 2)}`;
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
