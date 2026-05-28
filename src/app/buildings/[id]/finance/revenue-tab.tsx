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
  buildingId, month, year, categories, paymentMethods, partyKindConfigs, canWrite,
}: {
  buildingId: string;
  month: number;
  year: number;
  categories: { id: string; name: string; type: "INCOME" | "EXPENSE"; isTransfer: boolean }[];
  paymentMethods: { id: string; name: string; isCash: boolean }[];
  partyKindConfigs: { code: string; label: string; forRevenue: boolean; forExpense: boolean }[];
  canWrite: boolean;
}) {
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);

  const [allInvoices, manualIncomes, rooms, contracts] = await Promise.all([
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
        OR: [
          { date: { gte: monthStart, lte: monthEnd } },
          { date: { lt: monthStart }, paymentDate: { gte: monthStart } },
        ],
        type: "INCOME",
        invoiceId: null,
      },
      include: {
        category: { select: { id: true, name: true } },
        paymentMethod: { select: { id: true, name: true } },
        customer: { select: { id: true, type: true, fullName: true, companyName: true } },
        party: { select: { id: true, name: true } },
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
    prisma.contract.findMany({
      where: { buildingId },
      select: { id: true, code: true },
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
          date: true,
          paymentDate: true,
          paymentMethod: { select: { name: true } },
        },
      })
    : [];

  const paidPrev = new Map<string, bigint>();
  const paidThis = new Map<string, bigint>();
  const pmThisByInvoice = new Map<string, Set<string>>();
  const payDateThisByInvoice = new Map<string, string>();
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
      const txDate = (p.paymentDate ?? p.date).toISOString();
      const existing = payDateThisByInvoice.get(p.invoiceId);
      if (!existing || txDate > existing) payDateThisByInvoice.set(p.invoiceId, txDate);
    }
  }

  type EditableTx = {
    id: string;
    type: "INCOME" | "EXPENSE";
    date: string;
    amount: string;
    content: string;
    notes: string | null;
    categoryId: string | null;
    paymentMethodId: string | null;
    paymentDate: string | null;
    partyKind: string | null;
    customerId: string | null;
    partyId: string | null;
    roomId: string | null;
    accountingMonth: number | null;
    accountingYear: number | null;
    transferPairId: string | null;
  };
  type Row = {
    key: string;
    date: string;
    sortKey: string;
    roomId: string | null;
    roomNumber: string | null;
    category: string;
    partyKind: string | null;
    partyLabel: string;
    content: string;
    paymentMethod: string;
    paymentDate: string | null;
    opening: bigint;
    due: bigint;
    paid: bigint;
    closing: bigint;
    tx: EditableTx | null;
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
      // Manual invoices are issued on demand, so the createdAt timestamp is
      // the meaningful "ngày phát sinh" — dueDate is just a payment deadline.
      // Auto rent invoices keep the dueDate so monthly receivables sort by
      // payment day, not by when the cron happened to run.
      date: (inv.isManual ? inv.createdAt : inv.dueDate).toISOString(),
      sortKey: inv.createdAt.toISOString(),
      roomId: inv.contract.room.id,
      roomNumber: inv.contract.room.number,
      category: "Tiền thuê phòng",
      partyKind: "CUSTOMER",
      partyLabel: customerDisplayName(customer),
      content: `Hoá đơn ${inv.code}`,
      paymentMethod: pmNames.join(", "),
      paymentDate: paid > 0n ? (payDateThisByInvoice.get(inv.id) ?? null) : null,
      opening,
      due,
      paid,
      closing,
      tx: null,
    });
  }

  for (const t of manualIncomes) {
    const partyLabel = t.customer
      ? customerDisplayName(t.customer)
      : t.party?.name ?? "";

    const creationMonth = t.date.getMonth() + 1;
    const creationYear = t.date.getFullYear();
    const isCreationMonth = creationMonth === month && creationYear === year;
    const payMonth = t.paymentDate ? t.paymentDate.getMonth() + 1 : null;
    const payYear = t.paymentDate ? t.paymentDate.getFullYear() : null;
    const isPayMonth = payMonth !== null && payYear !== null && payMonth === month && payYear === year;

    let opening: bigint, due: bigint, paid: bigint, rowPaymentDate: string | null;
    if (!t.paymentDate || (isCreationMonth && isPayMonth)) {
      opening = 0n; due = t.amount; paid = t.amount; rowPaymentDate = t.paymentDate?.toISOString() ?? null;
    } else if (isCreationMonth) {
      opening = 0n; due = t.amount; paid = 0n; rowPaymentDate = null;
    } else if (isPayMonth) {
      opening = t.amount; due = 0n; paid = t.amount; rowPaymentDate = t.paymentDate.toISOString();
    } else {
      opening = t.amount; due = 0n; paid = 0n; rowPaymentDate = null;
    }
    const closing = opening + due - paid;

    rows.push({
      key: `tx-${t.id}`,
      date: t.date.toISOString(),
      sortKey: t.createdAt.toISOString(),
      roomId: t.roomId ?? null,
      roomNumber: t.room?.number ?? null,
      category: t.category?.name ?? "",
      partyKind: t.partyKind ?? null,
      partyLabel,
      content: t.content,
      paymentMethod: isPayMonth || (!t.paymentDate) ? (t.paymentMethod?.name ?? "") : "",
      paymentDate: rowPaymentDate,
      opening,
      due,
      paid,
      closing,
      tx: {
        id: t.id,
        type: "INCOME",
        date: t.date.toISOString(),
        amount: t.amount.toString(),
        content: t.content,
        notes: t.notes,
        categoryId: t.category?.id ?? null,
        paymentMethodId: t.paymentMethod?.id ?? null,
        paymentDate: t.paymentDate?.toISOString() ?? null,
        partyKind: t.partyKind ?? null,
        customerId: t.customer ? t.customerId : null,
        partyId: t.party ? t.partyId : null,
        roomId: t.roomId ?? null,
        accountingMonth: t.accountingMonth,
        accountingYear: t.accountingYear,
        transferPairId: t.transferPairId,
      },
    });
  }

  rows.sort((a, b) => {
    const byDate = b.date.localeCompare(a.date);
    if (byDate !== 0) return byDate;
    return b.sortKey.localeCompare(a.sortKey);
  });

  const flatRooms = rooms.map((r) => ({
    id: r.id,
    number: r.number,
    primaryCustomerId: r.contracts[0]?.customers[0]?.customerId ?? null,
  }));

  const contractCodes = contracts.map((c) => ({ id: c.id, code: c.code }));
  const invoiceCodes = allInvoices.map((i) => ({ id: i.id, code: i.code }));

  return (
    <RevenueClient
      buildingId={buildingId}
      month={month}
      year={year}
      rows={serializeBigInt(rows)}
      rooms={flatRooms}
      categories={categories}
      paymentMethods={paymentMethods}
      partyKindConfigs={partyKindConfigs}
      canWrite={canWrite}
      contractCodes={contractCodes}
      invoiceCodes={invoiceCodes}
    />
  );
}
