/**
 * Backfill roomId on transactions that were created from invoice payments
 * but are missing roomId (created before the fix in PR #210).
 *
 * Run: npx tsx scripts/backfill-transaction-roomid.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Find all transactions linked to an invoice but missing roomId
  const transactions = await prisma.transaction.findMany({
    where: {
      invoiceId: { not: null },
      roomId: null,
    },
    select: {
      id: true,
      code: true,
      invoiceId: true,
    },
  });

  console.log(`Found ${transactions.length} transactions to backfill`);
  if (transactions.length === 0) return;

  // Load the roomId for each invoice via its contract
  const invoiceIds = [...new Set(transactions.map((t) => t.invoiceId!))] ;
  const invoices = await prisma.invoice.findMany({
    where: { id: { in: invoiceIds } },
    select: { id: true, contract: { select: { roomId: true } } },
  });
  const roomByInvoice = new Map(invoices.map((i) => [i.id, i.contract.roomId]));

  let updated = 0;
  let skipped = 0;
  for (const txn of transactions) {
    const roomId = roomByInvoice.get(txn.invoiceId!);
    if (!roomId) { skipped++; continue; }
    await prisma.transaction.update({ where: { id: txn.id }, data: { roomId } });
    updated++;
  }

  console.log(`Done — updated: ${updated}, skipped (no roomId on contract): ${skipped}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
