import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { listAccessibleBuildings } from "@/lib/permissions";
import { AppShell } from "@/components/layout/app-shell";
import { PageBody } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Building2, FileText, Receipt, AlertCircle, Plus, ArrowRight,
  TrendingUp, Wallet, Bell, ChevronRight, Clock, Sparkles, DollarSign,
} from "lucide-react";
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
      prisma.invoice.count({ where: { buildingId: { in: buildingIds }, status: "OVERDUE" } }),
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
      {/* ── Mobile hero ── */}
      <div className="lg:hidden bg-gradient-brand text-white px-5 pt-5 pb-16 relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-white/10 pointer-events-none" />
        <div className="absolute bottom-0 left-8 w-32 h-32 rounded-full bg-white/6 pointer-events-none" />
        <div className="flex items-center justify-between mb-5 relative">
          <div>
            <p className="text-sm text-white/75 mb-0.5">Xin chào,</p>
            <h1 className="text-2xl font-bold tracking-tight">{firstName} ✨</h1>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="relative w-10 h-10 rounded-[14px] bg-white/20 flex items-center justify-center">
              <Bell className="h-5 w-5" />
              {overdueInvoices > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-pink-400 border-2 border-white/80" />
              )}
            </div>
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-300 to-rose-400 flex items-center justify-center text-white font-bold text-sm shadow-sm">
              {(session.user.name || "?").charAt(0).toUpperCase()}
            </div>
          </div>
        </div>
        <div className="relative flex items-center gap-2.5 px-3.5 py-2.5 rounded-[14px] text-sm"
          style={{ background: "rgba(255,255,255,0.18)", border: "1px solid rgba(255,255,255,0.25)", backdropFilter: "blur(10px)" }}>
          <svg className="h-4 w-4 opacity-75" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          <span className="text-white/75">Tìm phòng, hợp đồng, khách thuê…</span>
        </div>
      </div>

      {/* ── Desktop header ── */}
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
          <div className="space-y-5">
            {/* Mobile: warm-mint stat cards floating over hero */}
            <div className="lg:hidden grid grid-cols-2 gap-3 -mt-10">
              <MobileStatCard
                gradient="linear-gradient(135deg, #fbbf24 0%, #fb7185 50%, #ec4899 100%)"
                shadow="rgba(251,113,133,0.45)"
                label="Doanh thu tháng"
                value={formatVND(totalPaid)}
                delta={`/${formatVND(totalDue)}`}
              />
              <MobileStatCard
                gradient="linear-gradient(135deg, #5eead4 0%, #93c5fd 50%, #818cf8 100%)"
                shadow="rgba(129,140,248,0.40)"
                label="Phòng đang thuê"
                value={`${occupiedRooms}/${totalRooms}`}
                delta={`${totalRooms > 0 ? Math.round(occupiedRooms / totalRooms * 100) : 0}%`}
              />
            </div>

            {/* Desktop: 4 stat tiles */}
            <div className="hidden lg:grid lg:grid-cols-4 gap-4">
              <StatTile gradient="from-indigo-500 to-purple-500" icon={Building2} label="Toà nhà" value={String(buildings.length)} hint={`${occupiedRooms}/${totalRooms} phòng đang thuê`} />
              <StatTile gradient="from-sky-400 to-indigo-500" icon={FileText} label="Hợp đồng" value={String(activeContracts)} hint="Đang hoạt động" />
              <StatTile gradient="from-lime-400 to-teal-500" icon={Wallet} label={`Đã thu T${month}`} value={formatVND(totalPaid)} hint={`${formatVND(totalDue - totalPaid)} còn lại`} />
              <StatTile gradient="from-rose-500 to-pink-500" icon={AlertCircle} label="Quá hạn" value={String(overdueInvoices)} hint="Hoá đơn cần xử lý" />
            </div>

            {/* Quick actions */}
            <div>
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Thao tác nhanh</h2>
              <div className="grid grid-cols-4 gap-2.5">
                {buildings[0] && (
                  <>
                    <QuickAction href={`/buildings/${buildings[0].id}/contracts/new`} icon={FileText} label="Tạo HĐ" color="#6366f1" />
                    <QuickAction href={`/buildings/${buildings[0].id}/invoices`} icon={Receipt} label="Hoá đơn" color="#a855f7" />
                    <QuickAction href={`/buildings/${buildings[0].id}/finance`} icon={DollarSign} label="Phiếu thu" color="#10b981" />
                    <QuickAction href={`/buildings/${buildings[0].id}/finance?tab=pnl`} icon={TrendingUp} label="Báo cáo" color="#0ea5e9" />
                  </>
                )}
              </div>
            </div>

            {/* Sparkline revenue chart */}
            <div className="bg-white rounded-2xl border border-slate-200/70 p-5 shadow-sm">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Doanh thu 6 tháng</p>
                  <p className="text-2xl font-bold text-slate-900 mt-0.5">{formatVND(totalPaid)}</p>
                </div>
                <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700">
                  <TrendingUp className="h-3 w-3" /> Tháng {month}/{year}
                </span>
              </div>
              <Sparkline />
              <div className="flex justify-between mt-2 text-[10px] font-semibold text-slate-400">
                {Array.from({ length: 6 }, (_, i) => {
                  const m = ((month - 5 + i + 12) % 12) + 1;
                  return <span key={i}>T{m}</span>;
                })}
              </div>
            </div>

            {/* Buildings horizontal scroll */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-semibold">Toà nhà của bạn</h2>
                <Link href="/buildings" className="text-sm text-primary flex items-center gap-1 font-medium">
                  Tất cả <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
              <div className="flex gap-3 overflow-x-auto pb-1 no-scrollbar -mx-4 px-4 lg:mx-0 lg:px-0 lg:grid lg:grid-cols-3 lg:overflow-visible">
                {buildings.slice(0, 6).map((b) => (
                  <Link key={b.id} href={`/buildings/${b.id}`} className="shrink-0 lg:shrink w-[200px] lg:w-auto">
                    <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
                      <div className={`h-1.5 ${b.type === "CHDV" ? "bg-gradient-chdv" : "bg-gradient-vp"}`} />
                      <div className="p-4">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className={`h-9 w-9 rounded-xl flex items-center justify-center text-white text-xs font-bold ${b.type === "CHDV" ? "bg-gradient-chdv" : "bg-gradient-vp"}`}>
                            {b.name.slice(0, 2).toUpperCase()}
                          </div>
                          <Badge variant={b.type === "CHDV" ? "chdv" : "vp"} className="text-[10px]">{b.type}</Badge>
                        </div>
                        <h3 className="font-semibold text-sm leading-tight line-clamp-1">{b.name}</h3>
                        <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">{b.address}</p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            {/* Alerts */}
            {(overdueInvoices > 0 || expiring.length > 0) && (
              <div>
                <h2 className="text-base font-semibold mb-3">Cần xử lý</h2>
                <div className="space-y-2">
                  {overdueInvoices > 0 && (
                    <AlertRow
                      icon={AlertCircle}
                      color="#ef4444"
                      title={`${overdueInvoices} hoá đơn quá hạn`}
                      desc="Cần xử lý ngay"
                      badge={String(overdueInvoices)}
                      href={buildings[0] ? `/buildings/${buildings[0].id}/invoices?status=OVERDUE` : "/buildings"}
                    />
                  )}
                  {expiring.length > 0 && (
                    <AlertRow
                      icon={Clock}
                      color="#f59e0b"
                      title={`${expiring.length} hợp đồng sắp hết hạn`}
                      desc="Trong 30 ngày tới"
                      badge={String(expiring.length)}
                      href={buildings[0] ? `/buildings/${buildings[0].id}/contracts` : "/buildings"}
                    />
                  )}
                  <AlertRow
                    icon={Sparkles}
                    color="#8b5cf6"
                    title={`${activeContracts} hợp đồng đang hoạt động`}
                    desc={`${occupiedRooms}/${totalRooms} phòng · T${month}/${year}`}
                    href="/buildings"
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </PageBody>
    </AppShell>
  );
}

function MobileStatCard({ gradient, shadow, label, value, delta }: {
  gradient: string; shadow: string; label: string; value: string; delta: string;
}) {
  return (
    <div className="rounded-[20px] p-4 text-white relative overflow-hidden"
      style={{ background: gradient, boxShadow: `0 14px 28px -10px ${shadow}` }}>
      <div className="absolute -top-5 -right-5 w-20 h-20 rounded-full bg-white/15" />
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

function StatTile({ gradient, icon: Icon, label, value, hint }: {
  gradient: string; icon: typeof Building2; label: string; value: string; hint?: string;
}) {
  return (
    <div className={`stat-tile bg-gradient-to-br ${gradient}`}>
      <div className="absolute -right-4 -top-4 opacity-15"><Icon className="h-24 w-24" /></div>
      <div className="relative">
        <div className="text-xs uppercase tracking-wider text-white/80 font-medium">{label}</div>
        <div className="text-2xl lg:text-3xl font-bold mt-1 leading-tight">{value}</div>
        {hint && <div className="text-xs text-white/80 mt-1">{hint}</div>}
      </div>
    </div>
  );
}

function QuickAction({ href, icon: Icon, label, color }: {
  href: string; icon: typeof FileText; label: string; color: string;
}) {
  return (
    <Link href={href}>
      <div className="bg-white rounded-2xl p-3 flex flex-col items-center gap-2 border border-slate-100 hover:shadow-md transition-shadow">
        <div className="w-9 h-9 rounded-[12px] flex items-center justify-center" style={{ background: color + "18", color }}>
          <Icon className="h-5 w-5" />
        </div>
        <span className="text-[11px] font-semibold text-slate-700 text-center">{label}</span>
      </div>
    </Link>
  );
}

function AlertRow({ icon: Icon, color, title, desc, badge, href }: {
  icon: typeof AlertCircle; color: string; title: string; desc: string; badge?: string; href: string;
}) {
  return (
    <Link href={href}>
      <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-white border border-slate-100 hover:shadow-sm transition-all">
        <div className="w-10 h-10 rounded-[14px] flex items-center justify-center shrink-0" style={{ background: color + "15", color }}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-900 truncate">{title}</p>
          <p className="text-xs text-slate-500">{desc}</p>
        </div>
        {badge && (
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full text-white" style={{ background: color }}>{badge}</span>
        )}
        <ChevronRight className="h-4 w-4 text-slate-300 shrink-0" />
      </div>
    </Link>
  );
}

/* Simple static sparkline - decorative */
function Sparkline() {
  const pts = [40, 65, 45, 80, 60, 90, 75, 95, 70, 100, 85, 110];
  const max = Math.max(...pts), min = Math.min(...pts);
  const w = 400, h = 64;
  const xs = pts.map((_, i) => (i / (pts.length - 1)) * w);
  const ys = pts.map((v) => h - ((v - min) / (max - min)) * (h - 8) - 4);
  const line = xs.map((x, i) => `${i === 0 ? "M" : "L"}${x},${ys[i]}`).join(" ");
  const fill = `${line} L${w},${h} L0,${h} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} preserveAspectRatio="none">
      <defs>
        <linearGradient id="sg1" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor="#6366f1" /><stop offset="100%" stopColor="#ec4899" />
        </linearGradient>
        <linearGradient id="sg2" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#ec4899" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={fill} fill="url(#sg2)" />
      <path d={line} fill="none" stroke="url(#sg1)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={xs[xs.length - 1]} cy={ys[ys.length - 1]} r="4" fill="white" stroke="#ec4899" strokeWidth="2" />
    </svg>
  );
}
