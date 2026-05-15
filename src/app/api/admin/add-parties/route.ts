import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const toAdd = [
    { kind: "CO", name: "Cò" },
    { kind: "A_HAN", name: "A Hận" },
  ];

  const results = [];
  for (const p of toAdd) {
    const existing = await prisma.party.findFirst({ where: { kind: p.kind, name: p.name } });
    if (existing) {
      results.push({ name: p.name, status: "already exists" });
      continue;
    }
    await prisma.party.create({ data: { kind: p.kind, name: p.name } });
    results.push({ name: p.name, status: "created" });
  }

  return NextResponse.json({ results });
}
