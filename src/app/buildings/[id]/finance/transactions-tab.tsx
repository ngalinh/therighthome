import { prisma } from "@/lib/prisma";
import { TransactionsClient } from "./transactions-client";
import { serializeBigInt } from "@/lib/utils";

export async function TransactionsTab({
  buildingId, month, year, categories, paymentMethods, parties, customers, canWrite,
}: {
  buildingId: string;
  month: number;
  year: number;
  categories: { id: string; name: string; type: "INCOME" | "EXPENSE" }[];
  paymentMethods: { id: string; name: string; isCash: boolean }[];
  parties: { id: string; name: string; kind: string }[];
  customers: { id: string; fullName: string | null; companyName: string | null }[];
  canWrite: boolean;
}) {
  const [transactions, rooms] = await Promise.all([
    prisma.transaction.findMany({
      where: { buildingId, accountingYear: year, accountingMonth: month },
      include: {
        category: true,
        paymentMethod: true,
        customer: true,
        party: true,
      },
      orderBy: { date: "desc" },
    }),
    prisma.room.findMany({
      where: { buildingId },
      orderBy: { number: "asc" },
      select: { id: true, number: true },
    }),
  ]);

  return (
    <TransactionsClient
      buildingId={buildingId}
      month={month}
      year={year}
      transactions={serializeBigInt(transactions)}
      categories={categories}
      paymentMethods={paymentMethods}
      parties={parties}
      customers={customers}
      rooms={rooms}
      canWrite={canWrite}
    />
  );
}
