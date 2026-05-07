import { prisma } from "@/lib/prisma";
import { customerDisplayName, serializeBigInt } from "@/lib/utils";
import { RevenueClient } from "./revenue-client";

/**
 * Sổ Thu — 1 dòng = 1 hoá đơn (theo từng tháng) hoặc 1 phiếu thu thủ công.
 *
 * Hoá đơn: rollover sang tháng sau khi totalAmount > sum(payments tới hết
 * tháng trước). Tháng đầu tiên (tháng phát sinh hoá đơn) → opening = 0,
 * due = totalAmount; tháng sau → opening = số chưa thu, due = 0.
 *
 * Phiếu thu thủ công (Transaction.invoiceId = null, type = INCOME) hiển thị
 * 1 dòng trong tháng hạch toán, opening = 0, due = paid = amount → closing = 0
 * (không rollover).
 */
export async function RevenueTab({
  buildingId, month, year, categories, paymentMethods, canWrite,
}: {
  buildingId: string;
  month: number;
  year: number;
  categories: { id: string; name: string; type: "INCOME" | "EXPENSE" }[];
  paymentMethods: { id: string; name: string; isCash: boolean }[];
  canWrite: boolean;
}) {
  const [allInvoices, manualIncomes, rooms] = await Promise.all([
    // All non-cancelled invoices issued up to & including the current month.
    prisma.invoice.findMany({
      where: {
        buildingId,
        status: { not: "CANCELLED" },
        OR: [
          { year: { lt: year } },
          { year, month: { lte: month } },
        ],
      },
      include: {
        contract: {
          include: {
            room: { select: { id: true, number: true } },
            customers: {
              where: { isPrimary: true },
              include: {
                customer: { select: { id: true, type: true, fullName: true, companyName: true } },
              },
            },
          },
        },
      },
    }),
    prisma.transaction.findMany({
      where: {
        buildingId,
        accountingMonth: month,
        accountingYear: year,
        type: "INCOME",
        invoiceId: null,
      },
      include: {
        category: { select: { name: true } },
        paymentMethod: { select: { name: true } },
        customer: { select: { type: true, fullName: true, companyName: true } },
        party: { select: { name: true } },
        room: { select: { id: true, number: true } },
      },
      orderBy: { date: "asc" },
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
            customers: { where: { isPrimary: true }, select: { customerId: true }, take: 1 },
          },
          orderBy: { startDate: "desc" },
          take: 1,
        },
      },
    }),
  ]);

  // Aggregate payments per invoice, split into "before this month" vs "this month".
  const invoiceIds = allInvoices.map((i) => i.id);
  const payments = invoiceIds.length
    ? await prisma.transaction.findMany({
        where: { invoiceId: { in: invoiceIds }, type: "INCOME" },
        select: {
          invoiceId: true,
          accountingMonth: true,
          accountingYear: true,
          amount: true,
          paymentMethod: { select: { name: true } },
        },
      })
    : [];

  const paidPrev = new Map<string, bigint>();
  const paidThis = new Map<string, bigint>();
  const pmThisByInvoice = new Map<string, Set<string>>();
  for (const p of payments) {
    if (!p.invoiceId || p.accountingYear == null || p.accountingMonth == null) continue;
    const before = p.accountingYear < year || (p.accountingYear === year && p.accountingMonth < month);
    const sameMonth = p.accountingYear === year && p.accountingMonth === month;
    if (before) {
      paidPrev.set(p.invoiceId, (paidPrev.get(p.invoiceId) ?? 0n) + p.amount);
    } else if (sameMonth) {
      paidThis.set(p.invoiceId, (paidThis.get(p.invoiceId) ?? 0n) + p.amount);
      if (p.paymentMethod?.name) {
        const set = pmThisByInvoice.get(p.invoiceId) ?? new Set<string>();
        set.add(p.paymentMethod.name);
        pmThisByInvoice.set(p.invoiceId, set);
      }
    }
  }

  type Row = {
    key: string;
    date: string;
    roomId: string | null;
    roomNumber: string | null;
    category: string;
    partyKind: string | null;
    partyLabel: string;
    content: string;
    paymentMethod: string;
    opening: bigint;
    due: bigint;
    paid: bigint;
    closing: bigint;
  };

  const rows: Row[] = [];

  for (const inv of allInvoices) {
    const isFirstMonth = inv.month === month && inv.year === year;
    const prev = paidPrev.get(inv.id) ?? 0n;
    const opening = isFirstMonth ? 0n : (inv.totalAmount - prev);
    const due = isFirstMonth ? inv.totalAmount : 0n;
    const paid = paidThis.get(inv.id) ?? 0n;
    const closing = opening + due - paid;

    if (!isFirstMonth && opening <= 0n && paid === 0n) continue;

    const customer = inv.contract.customers[0]?.customer ?? null;
    const pmNames = Array.from(pmThisByInvoice.get(inv.id) ?? []);
    rows.push({
      key: `inv-${inv.id}`,
      date: inv.dueDate.toISOString(),
      roomId: inv.contract.room.id,
      roomNumber: inv.contract.room.number,
      category: "Tiền thuê phòng",
      partyKind: "CUSTOMER",
      partyLabel: customerDisplayName(customer),
      content: `Hoá đơn ${inv.code}`,
      paymentMethod: pmNames.join(", "),
      opening,
      due,
      paid,
      closing,
    });
  }

  for (const t of manualIncomes) {
    const partyLabel = t.customer
      ? customerDisplayName(t.customer)
      : t.party?.name ?? "";
    rows.push({
      key: `tx-${t.id}`,
      date: t.date.toISOString(),
      roomId: t.roomId ?? null,
      roomNumber: t.room?.number ?? null,
      category: t.category?.name ?? "",
      partyKind: t.partyKind ?? null,
      partyLabel,
      content: t.content,
      paymentMethod: t.paymentMethod?.name ?? "",
      opening: 0n,
      due: t.amount,
      paid: t.amount,
      closing: 0n,
    });
  }

  rows.sort((a, b) => a.date.localeCompare(b.date));

  const flatRooms = rooms.map((r) => ({
    id: r.id,
    number: r.number,
    primaryCustomerId: r.contracts[0]?.customers[0]?.customerId ?? null,
  }));

  return (
    <RevenueClient
      buildingId={buildingId}
      month={month}
      year={year}
      rows={serializeBigInt(rows)}
      rooms={flatRooms}
      categories={categories}
      paymentMethods={paymentMethods}
      canWrite={canWrite}
    />
  );
}
