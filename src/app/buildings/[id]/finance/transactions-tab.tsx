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
  const [transactions, rooms, contracts] = await Promise.all([
    prisma.transaction.findMany({
      where: { buildingId, accountingYear: year, accountingMonth: month },
      include: {
        category: true,
        paymentMethod: true,
        customer: true,
        party: true,
        room: { select: { number: true } },
      },
      orderBy: { date: "desc" },
    }),
    prisma.room.findMany({
      where: { buildingId },
      orderBy: { number: "asc" },
      select: {
        id: true,
        number: true,
        contracts: {
          where: { status: "ACTIVE" },
          select: {
            customers: {
              where: { isPrimary: true },
              select: { customerId: true },
              take: 1,
            },
          },
          orderBy: { startDate: "desc" },
          take: 1,
        },
      },
    }),
    prisma.contract.findMany({
      where: { buildingId },
      select: { id: true, code: true },
    }),
  ]);

  const flatRooms = rooms.map((r) => ({
    id: r.id,
    number: r.number,
    primaryCustomerId: r.contracts[0]?.customers[0]?.customerId ?? null,
  }));

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
      rooms={flatRooms}
      contracts={contracts}
      canWrite={canWrite}
    />
  );
}
