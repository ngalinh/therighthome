import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader, PageBody } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Lock } from "lucide-react";
import { ImportClient } from "./import-client";

export default async function ImportPage() {
  const session = await auth();
  if (!session) redirect("/login");
  const isAdmin = session.user.role === "ADMIN";

  return (
    <AppShell user={{ name: session.user.name || "", email: session.user.email || "", role: session.user.role }}>
      <PageHeader title="Import dữ liệu Excel" gradient="brand" description="Tải dữ liệu hiện có vào hệ thống" />
      <PageBody>
        {!isAdmin ? (
          <Card>
            <CardContent className="py-16 text-center">
              <Lock className="h-8 w-8 text-slate-400 mx-auto mb-3" />
              <h3 className="text-lg font-semibold">Chỉ Admin có thể import</h3>
            </CardContent>
          </Card>
        ) : (
          <ImportClient />
        )}
      </PageBody>
    </AppShell>
  );
}
