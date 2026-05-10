// Idempotent schema-shape migration that runs BEFORE `prisma db push`.
// Currently: convert PartyKind enum columns to text so db push doesn't drop+recreate
// (which would lose existing partyKind values on Transaction / Party / MaintenanceTask).
const { PrismaClient } = require("@prisma/client");

async function main() {
  const prisma = new PrismaClient();
  try {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT 1 FROM pg_type WHERE typname = 'PartyKind' LIMIT 1`
    );
    if (!rows || rows.length === 0) {
      return; // already migrated or fresh DB
    }

    console.log("[pre-migrate] Converting PartyKind enum columns to text...");
    // Order matters: drop FK uses (none here) then alter.
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "Transaction" ALTER COLUMN "partyKind" TYPE text USING "partyKind"::text`
    );
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "Party" ALTER COLUMN "kind" TYPE text USING "kind"::text`
    );
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "MaintenanceTask" ALTER COLUMN "partyKind" TYPE text USING "partyKind"::text`
    );
    // The enum type may still be referenced; drop it now that no column uses it.
    await prisma.$executeRawUnsafe(`DROP TYPE IF EXISTS "PartyKind"`);
    console.log("[pre-migrate] Done.");
  } catch (err) {
    console.error("[pre-migrate] Failed (continuing):", err.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
