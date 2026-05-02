import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { listAccessibleBuildings } from "@/lib/permissions";
import { AppShell } from "@/components/layout/app-shell";
import { PageBody } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, FileText, Receipt, AlertCircle, Plus, ArrowRight, TrendingUp, Wallet, Bell } from "lucide-react";
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

  const firstName = session.user.name?.split(" ").pop() || "";

  return (
    <AppShell user={{ name: session.user.name || "", email: session.user.email || "", role }}>
      {/* Mobile hero header */}
      <div className="lg:hidden bg-gradient-brand text-white px-5 pt-4 pb-16 relative overflow-hidden">
        <div
          className="absolute pointer-events-none"
          style={{ top: -60, right: -40, width: 200, height: 200, borderRadius: "50%", background: "rgba(255,255,255,0.12)", filter: "blur(30px)" }}
        />
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="text-sm text-white/80 mb-0.5">Xin chào,</p>
            <h1 className="text-2xl font-bold tracking-tight">{firstName} ✨</h1>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="relative w-10 h-10 rounded-[14px] bg-white/20 flex items-center justify-center">
              <Bell className="h-5 w-5" />
              <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-pink-400 border-2 border-white" />
            </div>
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-300 to-rose-400 flex items-center justify-center text-white font-bold text-sm">
              {(session.user.name || "?").charAt(0).toUpperCase()}
            </div>
          </div>
        </div>
        <div
          className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-[14px] text-sm"
          style={{ background: "rgba(255,255,255,0.18)", border: "1px solid rgba(255,255,255,0.25)", backdropFilter: "blur(10px)" }}
        >
          <svg className="h-4 w-4 opacity-80" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
          <span className="text-white/80">Tìm phòng, hợp đồng, khách thuê…</span>
        </div>
      </div>

      {/* Desktop page header */}
      <div className="hidden lg:block bg-gradient-to-br from-indigo-50 to-pink-50 px-8 py-6 border-b border-slate-200/60">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Tổng quan</h1>
            <p className="text-sm text-slate-600 mt-0.5">Xin chào {firstName} 👋</p>
          </div>
          <Button asChild variant="gradient">
            <Link href="/buildings"><Plus className="h-4 w-4" />Toà nhà</Link>
          </Button>
        </div>
      </div>

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
            {/* Mobile: 2 warm-mint stat cards overlapping hero */}
            <div className="lg:hidden grid grid-cols-2 gap-3 -mt-10">
              <MobileStatCard
                gradient="linear-gradient(135deg, #fbbf24 0%, #fb7185 50%, #ec4899 100%)"
                shadow="rgba(251,113,133,0.45)"
                label="Doanh thu tháng"
                value={formatVND(totalPaid)}
                delta={`/${formatVND(totalDue)}`}
                icon={Wallet}
              />
              <MobileStatCard
                gradient="linear-gradient(135deg, #5eead4 0%, #93c5fd 50%, #818cf8 100%)"
                shadow="rgba(129,140,248,0.40)"
                label="Phòng đang thuê"
                value={`${occupiedRooms}/${totalRooms}`}
                delta={`${totalRooms > 0 ? Math.round(occupiedRooms / totalRooms * 100) : 0}%`}
                icon={Building2}
              />
            </div>

            {/* Desktop: 4 stat tiles */}
            <div className="hidden lg:grid lg:grid-cols-4 gap-4">
              <StatTile gradient="from-indigo-500 to-purple-500" icon={Building2} label="Toà nhà" value={String(buildings.length)} hint={`${occupiedRooms}/${totalRooms} phòng đang thuê`} />
              <StatTile gradient="from-sky-400 to-indigo-500" icon={FileText} label="Hợp đồng" value={String(activeContracts)} hint="Đang hoạt động" />
              <StatTile gradient="from-lime-400 to-teal-500" icon={Wallet} label={`Đã thu T${month}`} value={formatVND(totalPaid)} hint={`${formatVND(totalDue - totalPaid)} còn lại`} />
              <StatTile gradient="from-rose-500 to-pink-500" icon={AlertCircle} label="Quá hạn" value={String(overdueInvoices)} hint="Hoá đơn cần xử lý" />
            </div>

            {/* Mobile: 2 more mini stats */}
            <div className="lg:hidden grid grid-cols-2 gap-3">
              <MiniStatCard icon={FileText} label="Hợp đồng HĐ" value={String(activeContracts)} sub="Đang hoạt động" color="text-indigo-600" bg="bg-indigo-50" />
              <MiniStatCard icon={AlertCircle} label="Quá hạn" value={String(overdueInvoices)} sub="Hoá đơn" color="text-rose-600" bg="bg-rose-50" />
            </div>

            {/* Buildings grid */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base lg:text-lg font-semibold">Toà nhà của bạn</h2>
                <Link href="/buildings" className="text-sm text-primary flex items-center gap-1 font-medium">
                  Tất cả <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4">
                {buildings.slice(0, 6).map((b) => (
                  <Link key={b.id} href={`/buildings/${b.id}`}>
                    <div className="bg-white rounded-2xl border border-slate-200/70 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_-12px_rgba(99,102,241,0.12)] hover:shadow-lg transition-shadow overflow-hidden">
                      <div className={`h-1.5 ${b.type === "CHDV" ? "bg-gradient-chdv" : "bg-gradient-vp"}`} />
                      <div className="p-4">
                        <div className="flex items-start justify-between gap-3 mb-2.5">
                          <div className={`h-10 w-10 rounded-xl flex items-center justify-center text-white ${b.type === "CHDV" ? "bg-gradient-chdv" : "bg-gradient-vp"}`}>
                            <Building2 className="h-5 w-5" />
                          </div>
                          <Badge variant={b.type === "CHDV" ? "chdv" : "vp"}>{b.type === "CHDV" ? "Căn hộ DV" : "Văn phòng"}</Badge>
                        </div>
                        <h3 className="font-semibold text-sm leading-tight">{b.name}</h3>
                        <p className="text-xs text-slate-500 mt-1 line-clamp-1">{b.address}</p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            {/* Expiring contracts */}
            {expiring.length > 0 && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <AlertCircle className="h-4 w-4 text-amber-500" /> Hợp đồng sắp hết hạn (30 ngày)
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-1.5">
                    {expiring.map((c) => {
                      const primary = c.customers.find((cc) => cc.isPrimary)?.customer;
                      const name = primary?.fullName || primary?.companyName || "—";
                      const days = Math.ceil((c.endDate.getTime() - Date.now()) / (24 * 3600 * 1000));
                      return (
                        <Link
                          key={c.id}
                          href={`/buildings/${c.buildingId}/contracts`}
                          className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 transition-colors"
                        >
                          <div className="min-w-0">
                            <div className="text-sm font-medium truncate">{name}</div>
                            <div className="text-xs text-slate-500 truncate">{c.building.name} · Phòng {c.room.number}</div>
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

function MobileStatCard({
  gradient, shadow, label, value, delta, icon: Icon,
}: {
  gradient: string; shadow: string; label: string; value: string; delta: string; icon: typeof Building2;
}) {
  return (
    <div
      className="rounded-[20px] p-4 text-white relative overflow-hidden"
      style={{ background: gradient, boxShadow: `0 14px 28px -10px ${shadow}` }}
    >
      <div className="absolute -top-5 -right-5 w-20 h-20 rounded-full bg-white/18" />
      <div className="relative">
        <p className="text-[11px] font-semibold opacity-90 mb-1">{label}</p>
        <p className="text-xl font-bold tracking-tight leading-tight">{value}</p>
        <div className="inline-flex items-center gap-1 mt-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-white/22">
          <TrendingUp className="h-3 w-3" /> {delta}
        </div>
      </div>
    </div>
  );
}

function MiniStatCard({
  icon: Icon, label, value, sub, color, bg,
}: {
  icon: typeof FileText; label: string; value: string; sub: string; color: string; bg: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/70 p-4 shadow-sm">
      <div className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg mb-2 ${bg} ${color}`}>
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className="text-2xl font-bold text-slate-900">{value}</div>
      <div className="text-xs text-slate-500 mt-0.5">{sub}</div>
    </div>
  );
}

function StatTile({
  gradient, icon: Icon, label, value, hint,
}: {
  gradient: string; icon: typeof Building2; label: string; value: string; hint?: string;
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
