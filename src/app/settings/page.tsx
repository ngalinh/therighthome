import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader, PageBody } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Settings } from "lucide-react";

export default async function GlobalSettingsPage() {
  const session = await auth();
  if (!session) redirect("/login");
  return (
    <AppShell user={{ name: session.user.name || "", email: session.user.email || "", role: session.user.role }}>
      <PageHeader title="Cài đặt chung" gradient="brand" description="Người dùng, đối tượng, loại thu chi, PTTT" />
      <PageBody>
        <Card>
          <CardContent className="py-16 text-center">
            <div className="rounded-2xl bg-gradient-brand/10 inline-flex p-4 mb-4">
              <Settings className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold">Cài đặt chung — Sắp ra mắt</h3>
            <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
              Phase 5: quản lý người dùng + phân quyền theo toà, đối tượng (thợ sửa, dọn vệ sinh…), loại thu/chi, PTTT, audit log, push notifications, import Excel.
            </p>
          </CardContent>
        </Card>
      </PageBody>
    </AppShell>
  );
}
