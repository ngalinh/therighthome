import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { can, getBuildingPermission } from "@/lib/permissions";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader, PageBody } from "@/components/layout/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ContractsTab } from "./contracts-tab";
import { CustomersTab } from "./customers-tab";
import { Plus } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { serializeBigInt } from "@/lib/utils";

export default async function ContractsPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) redirect("/login");
  const { id } = await params;
  const perm = await getBuildingPermission(session.user.id, session.user.role, id);
  if (!perm) notFound();

  const building = await prisma.building.findUnique({ where: { id } });
  if (!building) notFound();

  const canWrite = await can(session.user.id, session.user.role, id, "contract.write");

  const [contracts, customers] = await Promise.all([
    prisma.contract.findMany({
      where: { buildingId: id },
      include: {
        room: true,
        customers: { include: { customer: true }, orderBy: { orderIdx: "asc" } },
      },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    }),
    prisma.customer.findMany({
      where: { buildingId: id },
      include: {
        contractCustomers: {
          include: { contract: { include: { room: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <AppShell
      user={{ name: session.user.name || "", email: session.user.email || "", role: session.user.role }}
      buildingNav={{ buildingId: id, buildingName: building.name, type: building.type }}
    >
      <PageHeader
        title="Hợp đồng"
        description={building.name}
        gradient={building.type === "CHDV" ? "chdv" : "vp"}
        actions={
          canWrite && (
            <Button asChild variant="gradient">
              <Link href={`/buildings/${id}/contracts/new`}>
                <Plus className="h-4 w-4" /> Tạo hợp đồng
              </Link>
            </Button>
          )
        }
      />
      <PageBody>
        <Tabs defaultValue="contracts" className="w-full">
          <TabsList>
            <TabsTrigger value="contracts">Hợp đồng ({contracts.length})</TabsTrigger>
            <TabsTrigger value="customers">Khách hàng ({customers.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="contracts">
            <ContractsTab contracts={serializeBigInt(contracts)} buildingId={id} buildingType={building.type} canWrite={canWrite} />
          </TabsContent>
          <TabsContent value="customers">
            <CustomersTab customers={serializeBigInt(customers)} buildingId={id} canWrite={canWrite} />
          </TabsContent>
        </Tabs>
      </PageBody>
    </AppShell>
  );
}
