import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { listAccessibleBuildings } from "@/lib/permissions";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader, PageBody } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, Plus, MapPin, DoorOpen } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";
import { NewBuildingButton } from "./new-building-button";

export default async function BuildingsPage() {
  const session = await auth();
  if (!session) redirect("/login");
  const role = session.user.role;
  const buildings = await listAccessibleBuildings(session.user.id, role);

  const counts = await prisma.room.groupBy({
    by: ["buildingId", "status"],
    where: { buildingId: { in: buildings.map((b) => b.id) } },
    _count: true,
  });
  const countMap = new Map<string, { total: number; occupied: number }>();
  for (const c of counts) {
    const cur = countMap.get(c.buildingId) ?? { total: 0, occupied: 0 };
    cur.total += c._count;
    if (c.status === "OCCUPIED") cur.occupied += c._count;
    countMap.set(c.buildingId, cur);
  }

  return (
    <AppShell user={{ name: session.user.name || "", email: session.user.email || "", role }}>
      <PageHeader
        title="Toà nhà"
        description="Quản lý tất cả toà nhà của bạn"
        gradient="brand"
        actions={role === "ADMIN" ? <NewBuildingButton /> : undefined}
      />
      <PageBody>
        {buildings.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <div className="rounded-2xl bg-gradient-brand/10 inline-flex p-4 mb-4">
                <Building2 className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold">Chưa có toà nhà</h3>
              <p className="text-sm text-slate-500 mt-1">Thêm toà nhà đầu tiên để bắt đầu quản lý.</p>
              {role === "ADMIN" && <div className="mt-5"><NewBuildingButton /></div>}
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4">
            {buildings.map((b) => {
              const c = countMap.get(b.id) ?? { total: 0, occupied: 0 };
              return (
                <Link key={b.id} href={`/buildings/${b.id}`}>
                  <Card className="hover:shadow-lg transition-shadow h-full overflow-hidden">
                    <div className={`h-2 ${b.type === "CHDV" ? "bg-gradient-chdv" : "bg-gradient-vp"}`} />
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div
                          className={`h-11 w-11 rounded-xl flex items-center justify-center text-white ${
                            b.type === "CHDV" ? "bg-gradient-chdv" : "bg-gradient-vp"
                          }`}
                        >
                          <Building2 className="h-5 w-5" />
                        </div>
                        <Badge variant={b.type === "CHDV" ? "chdv" : "vp"}>
                          {b.type === "CHDV" ? "Căn hộ DV" : "Văn phòng"}
                        </Badge>
                      </div>
                      <h3 className="font-semibold leading-tight">{b.name}</h3>
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2 flex items-start gap-1">
                        <MapPin className="h-3 w-3 shrink-0 mt-0.5" />
                        {b.address}
                      </p>
                      <div className="mt-4 flex items-center gap-3 text-xs text-slate-600">
                        <span className="flex items-center gap-1"><DoorOpen className="h-3.5 w-3.5" /> {c.total} phòng</span>
                        <span className="text-emerald-600">{c.occupied} đang thuê</span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </PageBody>
    </AppShell>
  );
}
