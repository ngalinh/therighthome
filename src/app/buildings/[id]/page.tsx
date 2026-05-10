import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { can, getBuildingPermission } from "@/lib/permissions";
import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  MapPin, FileText, Receipt, AlertCircle, DoorOpen, TrendingUp, Wallet, Clock, Settings as SettingsIcon,
} from "lucide-react";
import Link from "next/link";
import { formatVND, formatVNDCompact, compareRooms } from "@/lib/utils";
import { RoomsManager } from "./rooms-manager";
import { DeleteBuildingButton } from "./delete-building-button";
import { RevenueExpenseChart } from "./revenue-expense-chart";

export default async function BuildingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) redirect("/login");
  const { id } = await params;
  const perm = await getBuildingPermission(session.user.id, session.user.role, id);
  if (!perm) notFound();

  const building = await prisma.building.findUnique({
    where: { id },
    include: {
      rooms: {
        orderBy: { number: "asc" },
        include: {
          contracts: {
            where: { status: "ACTIVE" },
            include: { customers: { include: { customer: true } } },
            take: 1,
            orderBy: { startDate: "desc" },
          },
        },
      },
    },
  });
  if (!building) notFound();
  building.rooms.sort((a, b) => compareRooms(a.number, b.number));

  const canWrite = await can(session.user.id, session.user.role, id, "building.write");
  const isChdv = building.type === "CHDV";

  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const expiryWindowDays = building.type === "VP" ? 60 : 30;
  const expiryCutoff = new Date(Date.now() + expiryWindowDays * 24 * 3600 * 1000);
  const [expiringContracts, monthInvoices, overdue, totalContracts, totalInvoices, totalTransactions] = await Promise.all([
    prisma.contract.count({
      where: {
        buildingId: id,
        status: "ACTIVE",
        isOpenEnded: false,
        endDate: { lte: expiryCutoff },
      },
    }),
    prisma.invoice.findMany({
      where: { buildingId: id, month, year },
      select: { totalAmount: true, paidAmount: true, status: true },
    }),
    prisma.invoice.count({ where: { buildingId: id, status: "OVERDUE" } }),
    prisma.contract.count({ where: { buildingId: id } }),
    prisma.invoice.count({ where: { buildingId: id } }),
    prisma.transaction.count({ where: { buildingId: id } }),
  ]);
  const totalDue = monthInvoices.reduce((s, i) => s + Number(i.totalAmount), 0);
  const totalPaid = monthInvoices.reduce((s, i) => s + Number(i.paidAmount), 0);
  const occupied = building.rooms.filter((r) => r.status === "OCCUPIED").length;
  const totalRooms = building.rooms.length;

  return (
    <AppShell
      user={{ name: session.user.name || "", email: session.user.email || "", role: session.user.role }}
      buildingNav={{ buildingId: building.id, buildingName: building.name, type: building.type }}
    >
      <div className="px-4 lg:px-9 pt-6 lg:pt-9 pb-12 lg:pb-20 max-w-[1360px] mx-auto">
        <header className="rise flex flex-col lg:flex-row lg:justify-between lg:items-end gap-4 lg:gap-6 mb-7">
          <div className="min-w-0">
            <div className="page-eyebrow">
              <span className="dot" />
              {isChdv ? "Căn hộ DV" : "Văn phòng"}
            </div>
            <h1 className="page-title">{building.name}</h1>
            <p className="page-sub flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 shrink-0" /> {building.address}
            </p>
          </div>
          {session.user.role === "ADMIN" && (
            <div className="flex flex-wrap gap-2.5">
              <DeleteBuildingButton
                buildingId={building.id}
                buildingName={building.name}
                counts={{
                  rooms: building.rooms.length,
                  contracts: totalContracts,
                  invoices: totalInvoices,
                  transactions: totalTransactions,
                }}
              />
            </div>
          )}
        </header>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 lg:gap-5">
          <MiniStat icon={DoorOpen} label="Phòng" value={`${occupied}/${totalRooms}`} hint="Đang thuê" className="rise-1" />
          <MiniStat
            icon={Clock}
            label="HĐ sắp hết hạn"
            value={String(expiringContracts)}
            hint={`Trong ${expiryWindowDays} ngày`}
            variant="tan"
            className="rise-2"
          />
          <MiniStat
            icon={TrendingUp}
            label={`Đã thu T${month}`}
            value={formatVNDCompact(totalPaid).replace(" ₫", "")}
            valueSuffix="₫"
            hint={`/${formatVND(totalDue)}`}
            variant="accent"
            className="rise-3"
          />
          <MiniStat
            icon={AlertCircle}
            label="Quá hạn"
            value={String(overdue)}
            hint="Hoá đơn"
            variant="dark"
            className="rise-4"
          />
        </div>

        {/* Quick links to sub-sections */}
        <div className="section-head rise-2">
          <div>
            <h2 className="section-title">Quản lý toà nhà</h2>
            <div className="section-sub">Truy cập nhanh các mục</div>
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
          <QuickLink href={`/buildings/${building.id}/contracts`} icon={FileText} title="Hợp đồng" sub="Quản lý" className="rise-3" />
          <QuickLink href={`/buildings/${building.id}/invoices`} icon={Receipt} title="Hoá đơn" sub="Tạo & theo dõi" iconClass="sage" className="rise-3" />
          <QuickLink href={`/buildings/${building.id}/finance`} icon={Wallet} title="Tài chính" sub="Thu / Chi" iconClass="sun" className="rise-4" />
          <QuickLink href={`/buildings/${building.id}/settings`} icon={SettingsIcon} title="Cài đặt" sub="Toà nhà" iconClass="plum" className="rise-4" />
        </div>

        {/* Rooms map (left) + revenue chart (right) */}
        <div className="grid lg:grid-cols-2 gap-5 mt-11">
          <Card className="card-soft">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="font-serif text-2xl font-medium">Sơ đồ phòng</CardTitle>
              <div className="flex items-center gap-3 text-xs" style={{ color: "var(--text-2)" }}>
                <LegendDot color="var(--good)" label="Trống" />
                <LegendDot color="var(--text-2)" label="Đang thuê" />
                <LegendDot color="var(--warn)" label="Sắp HH" />
              </div>
            </CardHeader>
            <CardContent>
              <RoomsManager
                buildingId={building.id}
                canWrite={canWrite}
                rooms={building.rooms.map((r) => {
                  const c = r.contracts[0];
                  const primary = c?.customers.find((cc) => cc.isPrimary)?.customer;
                  const daysLeft = c && !c.isOpenEnded
                    ? Math.ceil((c.endDate.getTime() - Date.now()) / (24 * 3600 * 1000))
                    : null;
                  return {
                    id: r.id,
                    number: r.number,
                    status: r.status,
                    customerName: primary?.fullName || primary?.companyName || null,
                    daysLeft,
                    contractId: c?.id ?? null,
                  };
                })}
              />
            </CardContent>
          </Card>

          <Card className="card-soft">
            <CardHeader className="pb-3">
              <CardTitle className="font-serif text-2xl font-medium">Thu / Chi 6 tháng gần nhất</CardTitle>
            </CardHeader>
            <CardContent>
              <RevenueExpenseChart series={await loadSixMonthSeries(id)} />
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}

async function loadSixMonthSeries(buildingId: string) {
  const now = new Date();
  const months: { month: number; year: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ month: d.getMonth() + 1, year: d.getFullYear() });
  }
  const txs = await prisma.transaction.findMany({
    where: {
      buildingId,
      countInBR: true,
      OR: months.map((m) => ({ accountingMonth: m.month, accountingYear: m.year })),
    },
    select: { type: true, amount: true, accountingMonth: true, accountingYear: true },
  });
  return months.map((m) => {
    const matches = txs.filter((t) => t.accountingMonth === m.month && t.accountingYear === m.year);
    const income = matches.filter((t) => t.type === "INCOME").reduce((s, t) => s + Number(t.amount), 0);
    const expense = matches.filter((t) => t.type === "EXPENSE").reduce((s, t) => s + Number(t.amount), 0);
    return { ...m, income, expense };
  });
}

function MiniStat({
  icon: Icon, label, value, valueSuffix, hint, variant, iconClass, className,
}: {
  icon: typeof DoorOpen;
  label: string;
  value: string;
  valueSuffix?: string;
  hint?: string;
  variant?: "accent" | "dark" | "sage" | "tan";
  iconClass?: string;
  className?: string;
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
      {hint && <div className="stat-foot">{hint}</div>}
    </div>
  );
}

function QuickLink({
  href, icon: Icon, title, sub, iconClass, className,
}: {
  href: string;
  icon: typeof FileText;
  title: string;
  sub: string;
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
    </Link>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-2 w-2 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}
