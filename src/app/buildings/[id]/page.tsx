import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { can, getBuildingPermission } from "@/lib/permissions";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader, PageBody } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, FileText, Receipt, AlertCircle, DoorOpen, TrendingUp } from "lucide-react";
import Link from "next/link";
import { formatVND } from "@/lib/utils";
import { RoomsManager } from "./rooms-manager";

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

  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const [activeContracts, monthInvoices, overdue] = await Promise.all([
    prisma.contract.count({ where: { buildingId: id, status: "ACTIVE" } }),
    prisma.invoice.findMany({
      where: { buildingId: id, month, year },
      select: { totalAmount: true, paidAmount: true, status: true },
    }),
    prisma.invoice.count({ where: { buildingId: id, status: "OVERDUE" } }),
  ]);
  const totalDue = monthInvoices.reduce((s, i) => s + Number(i.totalAmount), 0);
  const totalPaid = monthInvoices.reduce((s, i) => s + Number(i.paidAmount), 0);

  const occupied = building.rooms.filter((r) => r.status === "OCCUPIED").length;

  return (
    <AppShell
      user={{ name: session.user.name || "", email: session.user.email || "", role: session.user.role }}
      buildingNav={{ buildingId: building.id, buildingName: building.name, type: building.type }}
    >
      <PageHeader
        title={building.name}
        gradient={building.type === "CHDV" ? "chdv" : "vp"}
        description=""
        actions={
          <Badge variant={building.type === "CHDV" ? "chdv" : "vp"}>
            {building.type === "CHDV" ? "Căn hộ DV" : "Văn phòng"}
          </Badge>
        }
      />
      <PageBody>
        <div className="space-y-6">
          <div className="flex items-start gap-2 text-sm text-slate-600">
            <MapPin className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{building.address}</span>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <MiniStat icon={DoorOpen} label="Phòng" value={`${occupied}/${building.rooms.length}`} hint="Đang thuê" />
            <MiniStat icon={FileText} label="HĐ hoạt động" value={String(activeContracts)} />
            <MiniStat icon={TrendingUp} label={`Đã thu T${month}`} value={formatVND(totalPaid)} hint={`${formatVND(totalDue - totalPaid)} còn lại`} />
            <MiniStat icon={AlertCircle} label="Quá hạn" value={String(overdue)} hint="Hoá đơn" />
          </div>

          {/* Quick links */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <QuickLink href={`/buildings/${building.id}/contracts`} icon={FileText} label="Hợp đồng" gradient="from-indigo-500 to-violet-500" />
            <QuickLink href={`/buildings/${building.id}/invoices`} icon={Receipt} label="Hoá đơn" gradient="from-cyan-500 to-blue-500" />
            <QuickLink href={`/buildings/${building.id}/finance`} icon={TrendingUp} label="Tài chính" gradient="from-emerald-500 to-teal-500" />
            <QuickLink href={`/buildings/${building.id}/settings`} icon={AlertCircle} label="Cài đặt" gradient="from-amber-500 to-orange-500" />
          </div>

          {/* Rooms map */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle>Sơ đồ phòng</CardTitle>
              <div className="flex items-center gap-3 text-xs">
                <LegendDot color="bg-emerald-500" label="Trống" />
                <LegendDot color="bg-rose-500" label="Đang thuê" />
                <LegendDot color="bg-amber-500" label="Sắp hết hạn" />
                <LegendDot color="bg-slate-400" label="Bảo trì" />
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

function MiniStat({ icon: Icon, label, value, hint }: { icon: typeof DoorOpen; label: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
          <Icon className="h-3.5 w-3.5" />
          {label}
        </div>
        <div className="text-xl font-bold leading-tight">{value}</div>
        {hint && <div className="text-xs text-slate-500 mt-0.5">{hint}</div>}
      </CardContent>
    </Card>
  );
}

function QuickLink({
  href, icon: Icon, label, gradient,
}: {
  href: string; icon: typeof FileText; label: string; gradient: string;
}) {
  return (
    <Link href={href}>
      <div className={`rounded-2xl p-5 text-white bg-gradient-to-br ${gradient} hover:opacity-95 transition-opacity flex items-center gap-3`}>
        <Icon className="h-6 w-6" />
        <span className="font-medium">{label}</span>
      </div>
    </Link>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-slate-600">
      <span className={`h-2 w-2 rounded-full ${color}`} />
      {label}
    </span>
  );
}
