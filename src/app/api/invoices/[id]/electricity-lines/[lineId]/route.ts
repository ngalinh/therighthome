import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { recomputeInvoice } from "@/lib/invoice-service";

const patchSchema = z.object({
  start: z.number().int().nullable().optional(),
  end: z.number().int().nullable().optional(),
  startPhotoUrl: z.string().nullable().optional(),
  endPhotoUrl: z.string().nullable().optional(),
});

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string; lineId: string }> },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: invoiceId, lineId } = await ctx.params;
  const inv = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    select: { buildingId: true, status: true },
  });
  if (!inv) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await can(session.user.id, session.user.role, inv.buildingId, "invoice.write"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (inv.status === "PAID") return NextResponse.json({ error: "Invoice already paid" }, { status: 400 });

  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const d = parsed.data;

  await prisma.invoiceElectricityLine.update({
    where: { id: lineId },
    data: {
      ...(d.start !== undefined && { start: d.start }),
      ...(d.end !== undefined && { end: d.end }),
      ...(d.startPhotoUrl !== undefined && { startPhotoUrl: d.startPhotoUrl }),
      ...(d.endPhotoUrl !== undefined && { endPhotoUrl: d.endPhotoUrl }),
    },
  });

  await recomputeInvoice(invoiceId, {});

  return NextResponse.json({ ok: true });
}
