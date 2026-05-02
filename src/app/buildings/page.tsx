import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { listAccessibleBuildings } from "@/lib/permissions";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader, PageBody } from "@/components/layout/page-header";
import { Building2, MapPin, DoorOpen } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
          <div className="text-center py-16">
            <div className="rounded-2xl bg-gradient-brand/10 inline-flex p-4 mb-4">
              <Building2 className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold">Chưa có toà nhà</h3>
            <p className="text-sm text-slate-500 mt-1">Thêm toà nhà đầu tiên để bắt đầu quản lý.</p>
            {role === "ADMIN" && <div className="mt-5"><NewBuildingButton /></div>}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4">
            {buildings.map((b) => {
              const c = countMap.get(b.id) ?? { total: 0, occupied: 0 };
              const isChdv = b.type === "CHDV";
              const occupancyPct = c.total > 0 ? Math.round((c.occupied / c.total) * 100) : 0;
              return (
                <Link key={b.id} href={`/buildings/${b.id}`}>
                  <div className="group bg-white rounded-2xl border border-slate-200/70 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_-12px_rgba(99,102,241,0.10)] hover:shadow-xl hover:-translate-y-0.5 transition-all overflow-hidden">
                    {/* Gradient header */}
                    <div className={`h-24 relative overflow-hidden ${isChdv ? "bg-gradient-chdv" : "bg-gradient-vp"}`}>
                      {/* Decorative circles */}
                      <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-white/10" />
                      <div className="absolute -bottom-8 -left-4 w-20 h-20 rounded-full bg-white/8" />
                      <div className="absolute inset-0 flex items-end p-4 pb-3">
                        <div className="flex items-center justify-between w-full">
                          <div className="h-10 w-10 rounded-xl bg-white/20 backdrop-blur-sm border border-white/30 flex items-center justify-center text-white">
                            <Building2 className="h-5 w-5" />
                          </div>
                          <Badge
                            className="text-white border-white/30 bg-white/20 backdrop-blur-sm text-[11px] font-semibold"
                          >
                            {isChdv ? "Căn hộ DV" : "Văn phòng"}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    <div className="p-4">
                      <h3 className="font-semibold text-slate-900 leading-tight">{b.name}</h3>
                      <p className="text-xs text-slate-500 mt-1 line-clamp-1 flex items-center gap-1">
                        <MapPin className="h-3 w-3 shrink-0" /> {b.address}
                      </p>

                      {/* Occupancy bar */}
                      <div className="mt-3">
                        <div className="flex items-center justify-between text-xs mb-1.5">
                          <span className="flex items-center gap-1 text-slate-600">
                            <DoorOpen className="h-3.5 w-3.5" /> {c.occupied}/{c.total} phòng
                          </span>
                          <span className={`font-semibold ${occupancyPct >= 80 ? "text-emerald-600" : occupancyPct >= 50 ? "text-amber-600" : "text-slate-500"}`}>
                            {occupancyPct}%
                          </span>
                        </div>
                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${isChdv ? "bg-gradient-chdv" : "bg-gradient-vp"}`}
                            style={{ width: `${occupancyPct}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </PageBody>
    </AppShell>
  );
}
