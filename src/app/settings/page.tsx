import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/layout/app-shell";
import { PageBody } from "@/components/layout/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Lock, KeyRound, Bell, Users, Tag, CreditCard, Building2, ClipboardList } from "lucide-react";
import { UsersTab } from "./users-tab";
import { BuildingsTab } from "./buildings-tab";
import { CategoriesTab } from "./categories-tab";
import { PaymentMethodsTab } from "./payment-methods-tab";
import { PartiesTab } from "./parties-tab";
import { AuditLogTab } from "./audit-log-tab";
import { NotificationsTab } from "./notifications-tab";

export default async function GlobalSettingsPage({
  searchParams,
}: { searchParams: Promise<{ tab?: string }> }) {
  const session = await auth();
  if (!session) redirect("/login");
  const sp = await searchParams;
  const tab = sp.tab ?? "notifications";
  const isAdmin = session.user.role === "ADMIN";

  const [users, buildings, categories, paymentMethods, parties, auditLogs] = await Promise.all([
    isAdmin ? prisma.user.findMany({
      include: { permissions: { include: { building: true } } },
      orderBy: [{ active: "desc" }, { createdAt: "desc" }],
    }) : [],
    isAdmin ? prisma.building.findMany({ orderBy: { name: "asc" } }) : [],
    isAdmin ? prisma.transactionCategory.findMany({ orderBy: [{ buildingType: "asc" }, { type: "asc" }, { name: "asc" }] }) : [],
    isAdmin ? prisma.paymentMethod.findMany({ orderBy: [{ buildingType: "asc" }, { name: "asc" }] }) : [],
    isAdmin ? prisma.party.findMany({ orderBy: [{ kind: "asc" }, { name: "asc" }] }) : [],
    isAdmin ? prisma.auditLog.findMany({
      include: { user: { select: { email: true, name: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    }) : [],
  ]);

  const userName = session.user.name || "";
  const userEmail = session.user.email || "";
  const userRole = session.user.role;

  return (
    <AppShell user={{ name: userName, email: userEmail, role: userRole }}>
      {/* Profile banner */}
      <div className="relative bg-gradient-brand overflow-hidden px-4 lg:px-8 py-8">
        <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-white/10 pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 w-48 h-48 rounded-full bg-white/5 pointer-events-none" />
        <div className="max-w-7xl mx-auto relative flex items-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center text-white text-xl font-bold shrink-0">
            {userName.charAt(0).toUpperCase()}
          </div>
          <div className="text-white">
            <h1 className="text-xl font-bold leading-tight">{userName}</h1>
            <p className="text-sm text-white/75">{userEmail}</p>
            <span className="inline-flex items-center gap-1 mt-1 text-[11px] font-semibold bg-white/20 text-white/90 px-2 py-0.5 rounded-full">
              <KeyRound className="h-3 w-3" />
              {userRole === "ADMIN" ? "Quản trị viên" : "Nhân viên"}
            </span>
          </div>
        </div>
      </div>

      <PageBody>
        <Tabs defaultValue={tab} className="w-full">
          <div className="overflow-x-auto no-scrollbar -mx-4 px-4 lg:mx-0 lg:px-0 mb-6">
            <TabsList className="inline-flex bg-slate-100 rounded-xl p-1 gap-0.5">
              <TabsTrigger value="notifications" className="flex items-center gap-1.5 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg px-3 py-2 text-xs font-medium">
                <Bell className="h-3.5 w-3.5" /> Thông báo
              </TabsTrigger>
              {isAdmin && (
                <TabsTrigger value="users" className="flex items-center gap-1.5 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg px-3 py-2 text-xs font-medium">
                  <Users className="h-3.5 w-3.5" /> Người dùng
                </TabsTrigger>
              )}
              {isAdmin && (
                <TabsTrigger value="buildings" className="flex items-center gap-1.5 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg px-3 py-2 text-xs font-medium">
                  <Building2 className="h-3.5 w-3.5" /> Toà nhà
                </TabsTrigger>
              )}
              {isAdmin && (
                <TabsTrigger value="categories" className="flex items-center gap-1.5 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg px-3 py-2 text-xs font-medium">
                  <Tag className="h-3.5 w-3.5" /> Loại thu/chi
                </TabsTrigger>
              )}
              {isAdmin && (
                <TabsTrigger value="pttt" className="flex items-center gap-1.5 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg px-3 py-2 text-xs font-medium">
                  <CreditCard className="h-3.5 w-3.5" /> PTTT
                </TabsTrigger>
              )}
              {isAdmin && (
                <TabsTrigger value="parties" className="flex items-center gap-1.5 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg px-3 py-2 text-xs font-medium">
                  <Building2 className="h-3.5 w-3.5" /> Đối tượng
                </TabsTrigger>
              )}
              {isAdmin && (
                <TabsTrigger value="audit" className="flex items-center gap-1.5 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg px-3 py-2 text-xs font-medium">
                  <ClipboardList className="h-3.5 w-3.5" /> Audit log
                </TabsTrigger>
              )}
            </TabsList>
          </div>

          <TabsContent value="notifications">
            <NotificationsTab />
          </TabsContent>

          {!isAdmin ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Lock className="h-8 w-8 text-slate-400 mx-auto mb-3" />
                <p className="text-sm text-slate-500">Các tab khác chỉ Admin mới truy cập được.</p>
              </CardContent>
            </Card>
          ) : (
            <>
              <TabsContent value="users">
                <UsersTab users={users} buildings={buildings} currentUserId={session.user.id} />
              </TabsContent>
              <TabsContent value="buildings">
                <BuildingsTab buildings={buildings.map((b) => ({ id: b.id, name: b.name, address: b.address, type: b.type }))} />
              </TabsContent>
              <TabsContent value="categories">
                <CategoriesTab categories={categories} />
              </TabsContent>
              <TabsContent value="pttt">
                <PaymentMethodsTab paymentMethods={paymentMethods} />
              </TabsContent>
              <TabsContent value="parties">
                <PartiesTab parties={parties} />
              </TabsContent>
              <TabsContent value="audit">
                <AuditLogTab logs={auditLogs} />
              </TabsContent>
            </>
          )}
        </Tabs>
      </PageBody>
    </AppShell>
  );
}
