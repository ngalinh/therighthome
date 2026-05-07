import { prisma } from "@/lib/prisma";
import { customerDisplayName, serializeBigInt } from "@/lib/utils";
import { DebtClient } from "./debt-client";

/**
 * Sổ Chi — 1 dòng = 1 cọc HĐ (rollover) hoặc 1 phiếu chi thủ công.
 *
 * Cọc HĐ: ACTIVE → mỗi tháng 1 dòng. Tháng startDate → opening = 0,
 * payable = depositAmount, paid = 0. Các tháng sau → opening = depositAmount,
 * payable = 0, paid = 0 (carry-forward).
 *
 * Tháng terminate (TERMINATED / EXPIRED) → opening = depositAmount,
 * paid = depositRefund (thực tế hoàn). Sau đó dừng hiển thị.
 *
 * TERMINATED_LOST_DEPOSIT → tháng forfeit: opening = depositAmount,
 * paid = depositAmount (xoá nợ vì khách mất cọc). Sau đó dừng hiển thị.
 *
 * Phiếu chi thủ công (Transaction.type = EXPENSE) → 1 dòng trong tháng hạch
 * toán; opening = 0, payable = paid = amount → closing = 0.
 */
export async function DebtTab({
  buildingId, month, year, categories, paymentMethods, canWrite,
}: {
  buildingId: string;
  month: number;
  year: number;
  categories: { id: string; name: string; type: "INCOME" | "EXPENSE" }[];
  paymentMethods: { id: string; name: string; isCash: boolean }[];
  canWrite: boolean;
}) {
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);

  const [depositContracts, manualExpenses, rooms] = await Promise.all([
    prisma.contract.findMany({
      where: {
        buildingId,
        depositAmount: { gt: 0 },
        startDate: { lte: monthEnd },
      },
      include: {
        room: { select: { id: true, number: true } },
        customers: {
          where: { isPrimary: true },
          include: {
            customer: { select: { type: true, fullName: true, companyName: true } },
          },
        },
      },
      orderBy: { startDate: "asc" },
    }),
    prisma.transaction.findMany({
      where: {
        buildingId,
        accountingMonth: month,
        accountingYear: year,
        type: "EXPENSE",
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
    payable: bigint;
    paid: bigint;
    closing: bigint;
  };

  const rows: Row[] = [];

  for (const c of depositContracts) {
    const startMonth = c.startDate.getMonth() + 1;
    const startYear = c.startDate.getFullYear();
    const isStartMonth = startMonth === month && startYear === year;

    const t = c.terminatedAt;
    const tMonth = t ? t.getMonth() + 1 : null;
    const tYear = t ? t.getFullYear() : null;
    const isTerminationMonth = tMonth === month && tYear === year;
    const afterTermination = !!t && (tYear! < year || (tYear === year && tMonth! < month));

    let include = false;
    let paid = 0n;
    if (c.status === "ACTIVE") {
      include = true;
    } else if (c.status === "TERMINATED" || c.status === "EXPIRED") {
      include = !afterTermination;
      if (isTerminationMonth) paid = c.depositRefund ?? 0n;
    } else if (c.status === "TERMINATED_LOST_DEPOSIT") {
      include = !afterTermination;
      if (isTerminationMonth) paid = c.depositAmount;
    }
    if (!include) continue;

    const opening = isStartMonth ? 0n : c.depositAmount;
    const payable = isStartMonth ? c.depositAmount : 0n;
    const closing = opening + payable - paid;

    const customer = c.customers[0]?.customer ?? null;
    rows.push({
      key: `dep-${c.id}`,
      // Anchor the row to the relevant date for that month: start in start
      // month, termination in termination month, otherwise the 1st of the
      // current month.
      date: (isStartMonth ? c.startDate : (isTerminationMonth && t ? t : monthStart)).toISOString(),
      roomId: c.room.id,
      roomNumber: c.room.number,
      category: "Hoàn tiền cọc",
      partyKind: "CUSTOMER",
      partyLabel: customerDisplayName(customer),
      content: `Tiền cọc HĐ ${c.code} — Phòng ${c.room.number}`,
      paymentMethod: "",
      opening,
      payable,
      paid,
      closing,
    });
  }

  for (const e of manualExpenses) {
    const partyLabel = e.customer
      ? customerDisplayName(e.customer)
      : e.party?.name ?? "";
    rows.push({
      key: `tx-${e.id}`,
      date: e.date.toISOString(),
      roomId: e.roomId ?? null,
      roomNumber: e.room?.number ?? null,
      category: e.category?.name ?? "",
      partyKind: e.partyKind ?? null,
      partyLabel,
      content: e.content,
      paymentMethod: e.paymentMethod?.name ?? "",
      opening: 0n,
      payable: e.amount,
      paid: e.amount,
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
    <DebtClient
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
