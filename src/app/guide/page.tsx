import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { GuideShell } from "./_shell";
import { SECTIONS } from "./sections";

export default async function GuidePage() {
  const session = await auth();
  if (!session) redirect("/login");
  const role = session.user.role;
  const isAdmin = role === "ADMIN";

  const visible = SECTIONS.filter((s) => !s.adminOnly || isAdmin);

  return (
    <GuideShell
      user={{
        name: session.user.name || "",
        email: session.user.email || "",
        role,
      }}
      activeSlug={null}
    >
      <section className="card-soft p-6 lg:p-8 rise">
        <h2 className="section-title" style={{ margin: 0 }}>
          Bắt đầu
        </h2>
        <p
          className="mt-2 text-[14.5px] leading-relaxed"
          style={{ color: "var(--text-2)" }}
        >
          Chọn một chủ đề bên dưới hoặc dùng mục lục bên trái. Mỗi chủ đề là một
          trang riêng với hướng dẫn từng bước và ảnh giao diện thật.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 lg:gap-4 mt-6">
          {visible.map((s, i) => {
            const Icon = s.icon;
            return (
              <Link
                key={s.slug}
                href={`/guide/${s.slug}`}
                prefetch
                className={`quick rise-${Math.min(6, i + 1)}`}
              >
                <div className="ico-wrap">
                  <Icon className="h-[18px] w-[18px]" />
                </div>
                <div className="min-w-0">
                  <div className="q-title truncate">{s.title}</div>
                  <div className="q-sub truncate">{s.sub}</div>
                </div>
                <ArrowRight className="q-arrow h-3.5 w-3.5" />
              </Link>
            );
          })}
        </div>
      </section>
    </GuideShell>
  );
}
