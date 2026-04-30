import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { listAccessibleBuildings } from "@/lib/permissions";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader, PageBody } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, FileText, Receipt, AlertCircle, Plus, ArrowRight, TrendingUp, Wallet } from "lucide-react";
import Link from "next/link";
import { formatVND } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export default async function DashboardPage() {
  const session = await auth();
  if (!session) redirect("/login");
  const userId = session.user.id;
  const role = session.user.role;

  const buildings = await listAccessibleBuildings(userId, role);
  const buildingIds = buildings.map((b) => b.id);

  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const [activeContracts, totalRooms, occupiedRooms, monthlyInvoices, overdueInvoices, expiring] =
    await Promise.all([
      prisma.contract.count({ where: { buildingId: { in: buildingIds }, status: "ACTIVE" } }),
      prisma.room.count({ where: { buildingId: { in: buildingIds } } }),
      prisma.room.count({ where: { buildingId: { in: buildingIds }, status: "OCCUPIED" } }),
      prisma.invoice.findMany({
        where: { buildingId: { in: buildingIds }, month, year },
        select: { totalAmount: true, paidAmount: true, status: true },
      }),
      prisma.invoice.count({
        where: { buildingId: { in: buildingIds }, status: "OVERDUE" },
      }),
      prisma.contract.findMany({
        where: {
          buildingId: { in: buildingIds },
          status: "ACTIVE",
          endDate: { lte: new Date(Date.now() + 30 * 24 * 3600 * 1000) },
        },
        include: { building: true, room: true, customers: { include: { customer: true } } },
        orderBy: { endDate: "asc" },
        take: 5,
      }),
    ]);

  const totalDue = monthlyInvoices.reduce((s, i) => s + Number(i.totalAmount), 0);
  const totalPaid = monthlyInvoices.reduce((s, i) => s + Number(i.paidAmount), 0);
  const remaining = totalDue - totalPaid;

  return (
    <AppShell user={{ name: session.user.name || "", email: session.user.email || "", role }}>
      <PageHeader
        title="Tổng quan"
        description={`Xin chào ${session.user.name?.split(" ").pop() || ""} 👋`}
        gradient="brand"
        actions={
          <Button asChild variant="gradient">
            <Link href="/buildings"><Plus className="h-4 w-4" />Toà nhà</Link>
          </Button>
        }
      />
      <PageBody>
        {buildings.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <div className="rounded-2xl bg-gradient-brand/10 inline-flex p-4 mb-4">
                <Building2 className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold">Chưa có toà nhà nào</h3>
              <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
                Bắt đầu bằng cách thêm toà nhà đầu tiên (CHDV hoặc Văn phòng).
              </p>
              <Button asChild variant="gradient" className="mt-5">
                <Link href="/buildings"><Plus className="h-4 w-4" />Thêm toà nhà</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Stat tiles */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
              <StatTile
                gradient="from-indigo-500 to-purple-500"
                icon={Building2}
                label="Toà nhà"
                value={String(buildings.length)}
                hint={`${occupiedRooms}/${totalRooms} phòng đang thuê`}
              />
              <StatTile
                gradient="from-blue-500 to-cyan-500"
                icon={FileText}
                label="Hợp đồng"
                value={String(activeContracts)}
                hint="Đang hoạt động"
              />
              <StatTile
                gradient="from-emerald-500 to-teal-500"
                icon={Wallet}
                label={`Đã thu T${month}`}
                value={formatVND(totalPaid)}
                hint={`${formatVND(remaining)} còn lại`}
              />
              <StatTile
                gradient="from-rose-500 to-pink-500"
                icon={AlertCircle}
                label="Quá hạn"
                value={String(overdueInvoices)}
                hint="Hoá đơn cần xử lý"
              />
            </div>

            {/* Buildings grid */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold">Toà nhà của bạn</h2>
                <Link href="/buildings" className="text-sm text-primary flex items-center gap-1">
                  Tất cả <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4">
                {buildings.slice(0, 6).map((b) => (
                  <Link key={b.id} href={`/buildings/${b.id}`}>
                    <Card className="hover:shadow-lg transition-shadow h-full">
                      <CardContent className="p-5">
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div
                            className={`h-11 w-11 rounded-xl flex items-center justify-center text-white ${
                              b.type === "CHDV" ? "bg-gradient-chdv" : "bg-gradient-vp"
                            }`}
                          >
                            <Building2 className="h-5 w-5" />
                          </div>
                          <Badge variant={b.type === "CHDV" ? "chdv" : "vp"}>{b.type}</Badge>
                        </div>
                        <h3 className="font-semibold leading-tight">{b.name}</h3>
                        <p className="text-xs text-slate-500 mt-1 line-clamp-1">{b.address}</p>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>

            {/* Expiring contracts */}
            {expiring.length > 0 && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-amber-500" /> Hợp đồng sắp hết hạn (30 ngày)
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-2">
                    {expiring.map((c) => {
                      const primary = c.customers.find((cc) => cc.isPrimary)?.customer;
                      const name = primary?.fullName || primary?.companyName || "—";
                      const days = Math.ceil((c.endDate.getTime() - Date.now()) / (24 * 3600 * 1000));
                      return (
                        <Link
                          key={c.id}
                          href={`/buildings/${c.buildingId}/contracts`}
                          className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50"
                        >
                          <div className="min-w-0">
                            <div className="text-sm font-medium truncate">{name}</div>
                            <div className="text-xs text-slate-500 truncate">
                              {c.building.name} · Phòng {c.room.number}
                            </div>
                          </div>
                          <Badge variant={days <= 7 ? "destructive" : "warning"}>
                            {days <= 0 ? "Hết hạn" : `Còn ${days} ngày`}
                          </Badge>
                        </Link>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </PageBody>
    </AppShell>
  );
}

function StatTile({
  gradient, icon: Icon, label, value, hint,
}: {
  gradient: string;
  icon: typeof Building2;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className={`stat-tile bg-gradient-to-br ${gradient}`}>
      <div className="absolute -right-4 -top-4 opacity-15">
        <Icon className="h-24 w-24" />
      </div>
      <div className="relative">
        <div className="text-xs uppercase tracking-wider text-white/80 font-medium">{label}</div>
        <div className="text-2xl lg:text-3xl font-bold mt-1 leading-tight">{value}</div>
        {hint && <div className="text-xs text-white/80 mt-1">{hint}</div>}
      </div>
    </div>
  );
}
