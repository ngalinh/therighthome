import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { can, getBuildingPermission } from "@/lib/permissions";
import { AppShell } from "@/components/layout/app-shell";
import { PageBody } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, FileText, Receipt, AlertCircle, DoorOpen, TrendingUp } from "lucide-react";
import Link from "next/link";
import { formatVND } from "@/lib/utils";
import { RoomsManager } from "./rooms-manager";
import { DeleteBuildingButton } from "./delete-building-button";

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

  const canWrite = await can(session.user.id, session.user.role, id, "building.write");
  const isChdv = building.type === "CHDV";

  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const [activeContracts, monthInvoices, overdue, totalContracts, totalInvoices, totalTransactions] = await Promise.all([
    prisma.contract.count({ where: { buildingId: id, status: "ACTIVE" } }),
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

  return (
    <AppShell
      user={{ name: session.user.name || "", email: session.user.email || "", role: session.user.role }}
      buildingNav={{ buildingId: building.id, buildingName: building.name, type: building.type }}
    >
      {/* Gradient page header */}
      <div className={`relative overflow-hidden ${isChdv ? "bg-gradient-chdv" : "bg-gradient-vp"} text-white px-4 lg:px-8 py-5 lg:py-6`}>
        <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-white/10 pointer-events-none" />
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Badge className="bg-white/20 text-white border-white/30 text-[11px]">
                  {isChdv ? "Căn hộ DV" : "Văn phòng"}
                </Badge>
              </div>
              <h1 className="text-xl lg:text-2xl font-bold tracking-tight">{building.name}</h1>
              <p className="text-sm text-white/80 mt-0.5 flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5 shrink-0" /> {building.address}
              </p>
            </div>
            {session.user.role === "ADMIN" && (
              <DeleteBuildingButton
                buildingId={building.id}
                buildingName={building.name}
                counts={{ rooms: building.rooms.length, contracts: totalContracts, invoices: totalInvoices, transactions: totalTransactions }}
              />
            )}
          </div>
        </div>
      </div>

      <PageBody>
        <div className="space-y-5">
          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <MiniStat icon={DoorOpen} label="Phòng" value={`${occupied}/${building.rooms.length}`} hint="Đang thuê" accent={isChdv ? "indigo" : "teal"} />
            <MiniStat icon={FileText} label="HĐ hoạt động" value={String(activeContracts)} accent={isChdv ? "violet" : "blue"} />
            <MiniStat icon={TrendingUp} label={`Đã thu T${month}`} value={formatVND(totalPaid)} hint={`/${formatVND(totalDue)}`} accent="emerald" />
            <MiniStat icon={AlertCircle} label="Quá hạn" value={String(overdue)} hint="Hoá đơn" accent="rose" />
          </div>

          {/* Quick links */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <QuickLink href={`/buildings/${building.id}/contracts`} icon={FileText} label="Hợp đồng" gradient={isChdv ? "from-indigo-500 to-violet-500" : "from-sky-500 to-blue-600"} />
            <QuickLink href={`/buildings/${building.id}/invoices`} icon={Receipt} label="Hoá đơn" gradient={isChdv ? "from-violet-500 to-purple-600" : "from-cyan-500 to-teal-600"} />
            <QuickLink href={`/buildings/${building.id}/finance`} icon={TrendingUp} label="Tài chính" gradient="from-emerald-500 to-teal-500" />
            <QuickLink href={`/buildings/${building.id}/settings`} icon={AlertCircle} label="Cài đặt" gradient="from-slate-500 to-slate-700" />
          </div>

          {/* Rooms map */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-base">Sơ đồ phòng</CardTitle>
              <div className="flex items-center gap-3 text-xs text-slate-600">
                <LegendDot colorClass="bg-emerald-500" label="Trống" />
                <LegendDot colorClass="bg-rose-400" label="Đang thuê" />
                <LegendDot colorClass="bg-amber-400" label="Sắp HH" />
                <LegendDot colorClass="bg-slate-300" label="Bảo trì" />
              </div>
            </CardHeader>
            <CardContent>
              <RoomsManager
                buildingId={building.id}
                canWrite={canWrite}
                rooms={building.rooms.map((r) => {
                  const c = r.contracts[0];
                  const primary = c?.customers.find((cc) => cc.isPrimary)?.customer;
                  const daysLeft = c ? Math.ceil((c.endDate.getTime() - Date.now()) / (24 * 3600 * 1000)) : null;
                  return {
                    id: r.id,
                    number: r.number,
                    status: r.status,
                    customerName: primary?.fullName || primary?.companyName || null,
                    daysLeft,
                  };
                })}
              />
            </CardContent>
          </Card>
        </div>
      </PageBody>
    </AppShell>
  );
}

const ACCENTS = {
  indigo: { bg: "bg-indigo-50", text: "text-indigo-700", icon: "text-indigo-500" },
  violet: { bg: "bg-violet-50", text: "text-violet-700", icon: "text-violet-500" },
  teal: { bg: "bg-teal-50", text: "text-teal-700", icon: "text-teal-500" },
  blue: { bg: "bg-blue-50", text: "text-blue-700", icon: "text-blue-500" },
  emerald: { bg: "bg-emerald-50", text: "text-emerald-700", icon: "text-emerald-600" },
  rose: { bg: "bg-rose-50", text: "text-rose-700", icon: "text-rose-500" },
};

function MiniStat({ icon: Icon, label, value, hint, accent = "indigo" }: {
  icon: typeof DoorOpen; label: string; value: string; hint?: string; accent?: keyof typeof ACCENTS;
}) {
  const a = ACCENTS[accent];
  return (
    <div className="bg-white rounded-2xl border border-slate-200/70 p-4 shadow-sm">
      <div className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-md mb-2 ${a.bg} ${a.text}`}>
        <Icon className={`h-3 w-3 ${a.icon}`} />
        {label}
      </div>
      <div className="text-2xl font-bold text-slate-900 leading-tight">{value}</div>
      {hint && <div className="text-xs text-slate-500 mt-0.5">{hint}</div>}
    </div>
  );
}

function QuickLink({ href, icon: Icon, label, gradient }: {
  href: string; icon: typeof FileText; label: string; gradient: string;
}) {
  return (
    <Link href={href}>
      <div className={`rounded-2xl p-4 lg:p-5 text-white bg-gradient-to-br ${gradient} hover:opacity-92 transition-all hover:shadow-lg flex items-center gap-3`}>
        <div className="h-9 w-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
          <Icon className="h-5 w-5" />
        </div>
        <span className="font-medium text-sm">{label}</span>
      </div>
    </Link>
  );
}

function LegendDot({ colorClass, label }: { colorClass: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`h-2 w-2 rounded-full ${colorClass}`} />
      {label}
    </span>
  );
}
