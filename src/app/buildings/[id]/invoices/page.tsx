import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getBuildingPermission } from "@/lib/permissions";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader, PageBody } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Receipt } from "lucide-react";

export default async function InvoicesPage({ params }: { params: Promise<{ id: string }> }) {
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
      <PageHeader title="Hoá đơn" description={building.name} gradient={building.type === "CHDV" ? "chdv" : "vp"} />
      <PageBody>
        <Card>
          <CardContent className="py-16 text-center">
            <div className="rounded-2xl bg-gradient-brand/10 inline-flex p-4 mb-4">
              <Receipt className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold">Hoá đơn — Sắp ra mắt</h3>
            <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
              Phase 3: tạo hoá đơn tự động đầu tháng, upload ảnh đồng hồ điện, gửi hoá đơn qua email Gmail SMTP, tự động chuyển trạng thái Quá hạn.
            </p>
          </CardContent>
        </Card>
      </PageBody>
    </AppShell>
  );
}
