import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { listAccessibleBuildings } from "@/lib/permissions";
import { AppShell } from "@/components/layout/app-shell";
import {
  Building2, FileText, AlertCircle, Plus, Wallet, ArrowUp, ArrowRight,
  Receipt, Briefcase, Clock, Check, Download,
} from "lucide-react";
import Link from "next/link";
import { formatVND } from "@/lib/utils";

const VI_MONTHS = ["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8", "T9", "T10", "T11", "T12"];

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
  const remaining = Math.max(totalDue - totalPaid, 0);
  const paidPct = totalDue > 0 ? Math.round((totalPaid / totalDue) * 1000) / 10 : 0;
  const occupancyPct = totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0;

  const firstName = session.user.name?.split(" ").pop() || "Admin";
  const monthLabel = `Tháng ${month} · ${year}`;

  // Building counts for stats
  const buildingsWithCounts = await prisma.building.findMany({
    where: { id: { in: buildingIds } },
    select: {
      id: true, name: true, type: true, address: true,
      _count: { select: { rooms: true } },
      rooms: { where: { status: "OCCUPIED" }, select: { id: true } },
    },
    orderBy: { name: "asc" },
    take: 4,
  });

  return (
    <AppShell user={{ name: session.user.name || "", email: session.user.email || "", role }}>
      <div className="px-4 lg:px-9 pt-6 lg:pt-9 pb-12 lg:pb-20 max-w-[1360px] mx-auto">
        {buildings.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            <header className="rise flex flex-col lg:flex-row lg:justify-between lg:items-end gap-4 lg:gap-6 mb-8">
              <div className="min-w-0">
                <div className="page-eyebrow">
                  <span className="dot" />
                  {monthLabel}
                </div>
                <h1 className="page-title">
                  Xin chào, <span className="accent">{firstName}</span>.
                </h1>
                <p className="page-sub">
                  {overdueInvoices > 0 && (
                    <>Hôm nay có <strong>{overdueInvoices} hoá đơn quá hạn</strong> cần xử lý</>
                  )}
                  {overdueInvoices > 0 && expiring.length > 0 && " và "}
                  {expiring.length > 0 && (
                    <><strong>{expiring.length} hợp đồng</strong> sắp hết hạn.</>
                  )}
                  {overdueInvoices === 0 && expiring.length === 0 && (
                    <>Mọi thứ đang ổn. Tiếp tục theo dõi <strong>{activeContracts} hợp đồng</strong> đang hoạt động.</>
                  )}
                </p>
              </div>
              <div className="flex flex-wrap gap-2.5">
                <Link href="/manage/chdv" className="btn btn-ghost">
                  <Download className="h-3.5 w-3.5" /> Báo cáo
                </Link>
                <Link href="/manage/chdv?tab=invoices" className="btn btn-primary">
                  <Plus className="h-3.5 w-3.5" /> Hoá đơn mới
                </Link>
              </div>
            </header>

            {/* Stat grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 lg:gap-5">
              <StatCard
                icon={Building2}
                label="Toà nhà"
                value={buildings.length}
                foot={
                  <>
                    {occupiedRooms}/{totalRooms} phòng
                    {totalRooms > 0 && (
                      <span className="stat-trend up ml-1.5">
                        <ArrowUp className="h-2.5 w-2.5" strokeWidth={2.4} />
                        {occupancyPct}%
                      </span>
                    )}
                  </>
                }
                spark={[3, 3, 4, 4, 5, 5, 6, 6]}
                cornerMark="B"
                className="rise-1"
              />
              <StatCard
                icon={FileText}
                label="Hợp đồng"
                value={activeContracts}
                foot="Đang hoạt động"
                spark={[32, 35, 38, 40, 42, 44, 46, activeContracts]}
                sparkColor="var(--sage)"
                cornerMark="H"
                iconClass="bg-sage-soft text-sage-ink"
                className="rise-2"
              />
              <StatCard
                icon={Wallet}
                label={`Đã thu T${month}`}
                value={formatVND(totalPaid).replace(" ₫", "")}
                valueSuffix="₫"
                foot={`còn ${formatVND(remaining)}`}
                spark={[0, 0, 0, 0, 1, 2, 3, 4]}
                sparkColor="var(--accent-ink)"
                cornerMark="₫"
                variant="accent"
                className="rise-3"
              />
              <StatCard
                icon={AlertCircle}
                label="Quá hạn"
                value={overdueInvoices}
                foot="cần xử lý ngay"
                spark={[12, 15, 18, 22, 26, 28, 30, overdueInvoices]}
                sparkColor="#ffb78f"
                cornerMark="!"
                variant="dark"
                className="rise-4"
              />
            </div>

            {/* Quick actions */}
            <div className="section-head rise-2">
              <div>
                <h2 className="section-title">Thao tác nhanh</h2>
                <div className="section-sub">Truy cập các tác vụ thường dùng</div>
              </div>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
              <QuickAction
                href="/manage/chdv?tab=invoices"
                icon={Receipt}
                title="Hoá đơn CHDV"
                sub="Tạo hàng loạt"
                className="rise-3"
              />
              <QuickAction
                href="/manage/vp?tab=invoices"
                icon={Briefcase}
                title="Hoá đơn VP"
                sub="Theo hợp đồng"
                iconClass="sage"
                className="rise-3"
              />
              <QuickAction
                href="/manage/vp?tab=contracts"
                icon={Clock}
                title="HĐ sắp hết hạn VP"
                sub="Trong 60 ngày"
                iconClass="sun"
                className="rise-4"
              />
              <QuickAction
                href="/manage/chdv?tab=contracts"
                icon={Clock}
                title="HĐ sắp hết hạn CHDV"
                sub="Trong 30 ngày"
                iconClass="plum"
                className="rise-4"
              />
            </div>

            {/* Two column: buildings + alerts */}
            <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-6 lg:gap-8 mt-11">
              <section>
                <div className="section-head rise-3">
                  <div>
                    <h2 className="section-title">Toà nhà</h2>
                    <div className="section-sub">
                      {buildings.length} toà · {totalRooms} phòng
                    </div>
                  </div>
                  <Link
                    href="/buildings"
                    className="text-[12.5px] font-semibold flex items-center gap-1"
                    style={{ color: "var(--accent-coral)" }}
                  >
                    Xem tất cả <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 lg:gap-4">
                  {buildingsWithCounts.map((b, i) => {
                    const filled = b.rooms.length;
                    const total = b._count.rooms;
                    const pct = total > 0 ? Math.round((filled / total) * 100) : 0;
                    return (
                      <Link
                        key={b.id}
                        href={`/buildings/${b.id}`}
                        className={`building-card rise-${Math.min(6, 4 + Math.floor(i / 2))}`}
                      >
                        <div className="b-row">
                          <div className="b-num">{extractNum(b.name)}</div>
                          <span className={`b-tag ${b.type === "CHDV" ? "chdv" : "vp"}`}>
                            {b.type === "CHDV" ? "CHDV" : "VP"}
                          </span>
                        </div>
                        <div>
                          <div className="b-name line-clamp-2">{b.name}</div>
                        </div>
                        <div className="b-meter">
                          <div className="b-meter-row">
                            <span>
                              {filled}/{total} phòng
                            </span>
                            <strong>{pct}%</strong>
                          </div>
                          <div className="b-bar">
                            <span style={{ width: pct + "%", animationDelay: 0.3 + i * 0.05 + "s" }} />
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </section>

              <section>
                <div className="section-head rise-3">
                  <div>
                    <h2 className="section-title">Cần xử lý</h2>
                    <div className="section-sub">Theo độ ưu tiên</div>
                  </div>
                </div>
                <div className="flex flex-col gap-2.5">
                  {overdueInvoices > 0 && (
                    <Link
                      href={
                        buildings[0]
                          ? `/buildings/${buildings[0].id}/invoices?status=OVERDUE`
                          : "/buildings"
                      }
                      className="alert rise-4"
                    >
                      <div className="pulse">
                        <AlertCircle className="h-4 w-4" />
                      </div>
                      <div className="alert-body">
                        <div className="alert-title">Hoá đơn quá hạn</div>
                        <div className="alert-sub">cần xử lý ngay</div>
                      </div>
                      <div className="alert-count">{overdueInvoices}</div>
                    </Link>
                  )}
                  {expiring.length > 0 && (
                    <Link
                      href={
                        buildings[0]
                          ? `/buildings/${buildings[0].id}/contracts`
                          : "/buildings"
                      }
                      className="alert warn rise-4"
                    >
                      <div className="pulse">
                        <Clock className="h-4 w-4" />
                      </div>
                      <div className="alert-body">
                        <div className="alert-title">Hợp đồng sắp hết hạn</div>
                        <div className="alert-sub">trong 30 ngày tới</div>
                      </div>
                      <div className="alert-count">{expiring.length}</div>
                    </Link>
                  )}
                  <div className="alert good rise-5">
                    <div className="pulse">
                      <Check className="h-4 w-4" />
                    </div>
                    <div className="alert-body">
                      <div className="alert-title">Hợp đồng đang hoạt động</div>
                      <div className="alert-sub">
                        {occupiedRooms}/{totalRooms} phòng — {occupancyPct}% lấp đầy
                      </div>
                    </div>
                    <div className="alert-count">{activeContracts}</div>
                  </div>
                  <RevenueRingCard
                    paid={totalPaid}
                    target={totalDue}
                    pct={paidPct}
                    monthLabel={`Doanh thu T${month}`}
                  />
                </div>
              </section>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}

/* ── Helpers ──────────────────────────────────────────────── */

function extractNum(name: string): string {
  // Take leading digits (e.g. "46/57 Đường số 18" → "46")
  const match = name.match(/^\d+/);
  return match ? match[0] : name.slice(0, 2).toUpperCase();
}

function StatCard({
  icon: Icon, label, value, valueSuffix, foot, spark, sparkColor = "var(--accent-coral)",
  cornerMark, variant, className, iconClass,
}: {
  icon: typeof Building2;
  label: string;
  value: number | string;
  valueSuffix?: string;
  foot: React.ReactNode;
  spark: number[];
  sparkColor?: string;
  cornerMark?: string;
  variant?: "accent" | "dark" | "sage";
  className?: string;
  iconClass?: string;
}) {
  return (
    <div className={`stat ${variant ?? ""} ${className ?? ""}`}>
      <div className="stat-label">
        <span className={`lbl-ico ${iconClass ?? ""}`}>
          <Icon className="h-3 w-3" />
        </span>
        {label}
      </div>
      <div className="stat-value">
        {value}
        {valueSuffix && <sup>{valueSuffix}</sup>}
      </div>
      <div className="stat-foot">{foot}</div>
      <Sparkline data={spark} color={sparkColor} />
      {cornerMark && <div className="corner-mark">{cornerMark}</div>}
    </div>
  );
}

function QuickAction({
  href, icon: Icon, title, sub, iconClass, className,
}: {
  href: string; icon: typeof Receipt; title: string; sub: string;
  iconClass?: "sage" | "sun" | "plum";
  className?: string;
}) {
  return (
    <Link href={href} className={`quick ${className ?? ""}`}>
      <div className={`ico-wrap ${iconClass ?? ""}`}>
        <Icon className="h-[18px] w-[18px]" />
      </div>
      <div>
        <div className="q-title">{title}</div>
        <div className="q-sub">{sub}</div>
      </div>
      <ArrowRight className="q-arrow h-3.5 w-3.5" />
    </Link>
  );
}

function Sparkline({ data, color = "var(--accent-coral)" }: { data: number[]; color?: string }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const w = 60, h = 22;
  const pts = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - ((v - min) / range) * h;
      return `${x},${y}`;
    })
    .join(" ");
  const lastX = w;
  const lastY = h - ((data[data.length - 1] - min) / range) * h;
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={lastX} cy={lastY} r="2" fill={color} />
    </svg>
  );
}

function RevenueRingCard({
  paid, target, pct, monthLabel,
}: {
  paid: number; target: number; pct: number; monthLabel: string;
}) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - Math.min(pct, 100) / 100);
  return (
    <div className="rev-card rise-5">
      <div className="rev-ring">
        <svg width="64" height="64" style={{ transform: "rotate(-90deg)" }}>
          <circle cx="32" cy="32" r={r} stroke="rgba(255,255,255,.12)" strokeWidth="6" fill="none" />
          <circle
            cx="32" cy="32" r={r}
            stroke="#ffb78f" strokeWidth="6" fill="none"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={offset}
          />
        </svg>
        <div className="rev-pct">{pct.toFixed(1)}%</div>
      </div>
      <div className="min-w-0">
        <div className="rev-eyebrow">{monthLabel}</div>
        <div className="rev-num">{formatVND(paid)}</div>
        <div className="rev-sub">Mục tiêu: {formatVND(target)}</div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="card-soft p-12 text-center max-w-lg mx-auto mt-12 rise">
      <div className="ico-wrap mx-auto mb-4 h-12 w-12">
        <Building2 className="h-6 w-6" />
      </div>
      <h3 className="font-serif text-2xl font-medium" style={{ color: "var(--text)" }}>
        Chưa có toà nhà nào
      </h3>
      <p className="page-sub mx-auto mt-2">
        Bắt đầu bằng cách thêm toà nhà đầu tiên (CHDV hoặc Văn phòng).
      </p>
      <Link href="/buildings" className="btn btn-primary mt-5 inline-flex">
        <Plus className="h-3.5 w-3.5" /> Thêm toà nhà
      </Link>
    </div>
  );
}
