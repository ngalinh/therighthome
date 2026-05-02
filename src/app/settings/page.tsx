import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader, PageBody } from "@/components/layout/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Lock } from "lucide-react";
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

  return (
    <AppShell user={{ name: session.user.name || "", email: session.user.email || "", role: session.user.role }}>
      <PageHeader title="Cài đặt chung" gradient="brand" description="Người dùng, danh mục, đối tượng, audit log" />
      <PageBody>
        <Tabs defaultValue={tab} className="w-full">
          <div className="overflow-x-auto no-scrollbar -mx-4 px-4 lg:mx-0 lg:px-0">
            <TabsList className="inline-flex">
              <TabsTrigger value="notifications">Thông báo</TabsTrigger>
              {isAdmin && <TabsTrigger value="users">Người dùng</TabsTrigger>}
              {isAdmin && <TabsTrigger value="buildings">Toà nhà</TabsTrigger>}
              {isAdmin && <TabsTrigger value="categories">Loại thu/chi</TabsTrigger>}
              {isAdmin && <TabsTrigger value="pttt">PTTT</TabsTrigger>}
              {isAdmin && <TabsTrigger value="parties">Đối tượng</TabsTrigger>}
              {isAdmin && <TabsTrigger value="audit">Audit log</TabsTrigger>}
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
