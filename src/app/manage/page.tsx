import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { listAccessibleBuildings } from "@/lib/permissions";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader, PageBody } from "@/components/layout/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { serializeBigInt } from "@/lib/utils";
import { ManageTasksTab } from "./tasks-tab";
import { ManageOvertimeTab } from "./overtime-tab";

export default async function ManagePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");
  const sp = await searchParams;
  const tab = sp.tab ?? "chdv";

  const buildings = await listAccessibleBuildings(session.user.id, session.user.role);
  const buildingIds = buildings.map((b) => b.id);

  const [rooms, parties, tasks, overtimes] = await Promise.all([
    prisma.room.findMany({
      where: { buildingId: { in: buildingIds } },
      orderBy: [{ buildingId: "asc" }, { number: "asc" }],
      select: { id: true, buildingId: true, number: true },
    }),
    prisma.party.findMany({
      orderBy: [{ kind: "asc" }, { name: "asc" }],
      select: { id: true, name: true, kind: true },
    }),
    prisma.maintenanceTask.findMany({
      where: { buildingId: { in: buildingIds } },
      orderBy: { date: "desc" },
      include: {
        building: { select: { id: true, name: true, type: true } },
        room: { select: { id: true, number: true } },
        party: { select: { id: true, name: true, kind: true } },
        customer: { select: { id: true, fullName: true, companyName: true } },
      },
      take: 500,
    }),
    prisma.overtimeRequest.findMany({
      where: { buildingId: { in: buildingIds } },
      orderBy: { date: "desc" },
      include: {
        building: { select: { id: true, name: true, type: true } },
        room: { select: { id: true, number: true } },
        invoice: { select: { id: true, code: true } },
      },
      take: 500,
    }),
  ]);

  const buildingsLite = buildings.map((b) => ({ id: b.id, name: b.name, type: b.type }));
  const tasksS = serializeBigInt(tasks);
  const overtimesS = serializeBigInt(overtimes);
  const partiesS = serializeBigInt(parties);

  const tasksChdv = tasksS.filter((t) => t.building.type === "CHDV");
  const tasksVp = tasksS.filter((t) => t.building.type === "VP");

  return (
    <AppShell user={{ name: session.user.name || "", email: session.user.email || "", role: session.user.role }}>
      <PageHeader title="Quản lý" gradient="brand" description="Công việc & làm ngoài giờ" />
      <PageBody>
        <Tabs defaultValue={tab} className="w-full">
          <div className="overflow-x-auto no-scrollbar -mx-4 px-4 lg:mx-0 lg:px-0">
            <TabsList className="inline-flex">
              <TabsTrigger value="chdv">Công việc CHDV</TabsTrigger>
              <TabsTrigger value="vp">Công việc VP</TabsTrigger>
              <TabsTrigger value="ot">Làm ngoài giờ</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="chdv">
            <ManageTasksTab
              kind="CHDV"
              buildings={buildingsLite.filter((b) => b.type === "CHDV")}
              rooms={rooms}
              parties={partiesS}
              tasks={tasksChdv}
            />
          </TabsContent>
          <TabsContent value="vp">
            <ManageTasksTab
              kind="VP"
              buildings={buildingsLite.filter((b) => b.type === "VP")}
              rooms={rooms}
              parties={partiesS}
              tasks={tasksVp}
            />
          </TabsContent>
          <TabsContent value="ot">
            <ManageOvertimeTab
              buildings={buildingsLite}
              rooms={rooms}
              overtimes={overtimesS}
            />
          </TabsContent>
        </Tabs>
      </PageBody>
    </AppShell>
  );
}
