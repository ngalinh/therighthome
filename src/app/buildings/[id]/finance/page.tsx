import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getBuildingPermission } from "@/lib/permissions";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader, PageBody } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";

export default async function FinancePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) redirect("/login");
  const { id } = await params;
  const perm = await getBuildingPermission(session.user.id, session.user.role, id);
  if (!perm) notFound();
  const building = await prisma.building.findUnique({ where: { id } });
  if (!building) notFound();

  return (
    <AppShell
      user={{ name: session.user.name || "", email: session.user.email || "", role: session.user.role }}
      buildingNav={{ buildingId: id, buildingName: building.name, type: building.type }}
    >
      <PageHeader title="Tài chính" description={building.name} gradient={building.type === "CHDV" ? "chdv" : "vp"} />
      <PageBody>
        <Card>
          <CardContent className="py-16 text-center">
            <div className="rounded-2xl bg-gradient-brand/10 inline-flex p-4 mb-4">
              <TrendingUp className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold">Tài chính — Sắp ra mắt</h3>
            <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
              Phase 4: phiếu thu/chi, doanh thu theo phòng, công nợ với đối tượng, sổ quỹ theo PTTT, báo cáo KQKD (tổng thu - tổng chi), số dư đầu kỳ.
            </p>
          </CardContent>
        </Card>
      </PageBody>
    </AppShell>
  );
}
