import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { can, getBuildingPermission } from "@/lib/permissions";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader, PageBody } from "@/components/layout/page-header";
import { BuildingSettingsForm } from "./settings-form";
import { serializeBigInt } from "@/lib/utils";

export default async function BuildingSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) redirect("/login");
  const { id } = await params;
  const perm = await getBuildingPermission(session.user.id, session.user.role, id);
  if (!perm) notFound();
  const building = await prisma.building.findUnique({ where: { id }, include: { setting: true } });
  if (!building) notFound();
  const canWrite = await can(session.user.id, session.user.role, id, "settings.write");

  return (
    <AppShell
      user={{ name: session.user.name || "", email: session.user.email || "", role: session.user.role }}
      buildingNav={{ buildingId: id, buildingName: building.name, type: building.type }}
    >
      <PageHeader title="Cài đặt" description={building.name} gradient={building.type === "CHDV" ? "chdv" : "vp"} />
      <PageBody>
        <BuildingSettingsForm
          buildingId={id}
          buildingType={building.type}
          setting={serializeBigInt(building.setting)}
          canWrite={canWrite}
        />
      </PageBody>
    </AppShell>
  );
}
