import { existsSync } from "node:fs";
import path from "node:path";
import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import {
  ArrowRight,
  ArrowLeft,
  ChevronRight,
  Lightbulb,
} from "lucide-react";
import { SECTIONS, type Section } from "./sections";

const IMAGE_EXTS = ["png", "jpg", "jpeg", "webp"] as const;

export function findImage(slug: string): string | null {
  const dir = path.join(process.cwd(), "public", "guide");
  for (const ext of IMAGE_EXTS) {
    if (existsSync(path.join(dir, `${slug}.${ext}`))) {
      return `/guide/${slug}.${ext}`;
    }
  }
  return null;
}

export function GuideShell({
  user,
  activeSlug,
  children,
}: {
  user: { name: string; email: string; role: string };
  activeSlug: string | null;
  children: React.ReactNode;
}) {
  const isAdmin = user.role === "ADMIN";
  const tocItems = SECTIONS.filter((s) => !s.adminOnly || isAdmin);

  return (
    <AppShell user={user}>
      <div className="px-4 lg:px-9 pt-6 lg:pt-9 pb-12 lg:pb-20 max-w-[1360px] mx-auto">
        <header className="rise mb-6 lg:mb-8">
          <div className="page-eyebrow">
            <span className="dot" />
            Hướng dẫn sử dụng
          </div>
          <h1 className="page-title">
            Làm quen với <span className="accent">The Right Home</span>.
          </h1>
          <p className="page-sub">
            Chọn một mục bên trái để xem hướng dẫn từng bước, kèm hình ảnh giao
            diện thật.
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-6 lg:gap-10">
          {/* TOC */}
          <aside
            className="lg:sticky lg:top-24 lg:self-start lg:max-h-[calc(100vh-7rem)] overflow-y-auto scrollbar-thin p-3 rounded-[var(--r-lg)]"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--line)",
            }}
          >
            <div
              className="px-3 pt-1 pb-2 text-[10px] font-semibold uppercase tracking-[0.2em]"
              style={{ color: "var(--text-3)" }}
            >
              Mục lục
            </div>
            <nav className="flex flex-col gap-1">
              {tocItems.map((s) => {
                const Icon = s.icon;
                const active = s.slug === activeSlug;
                return (
                  <Link
                    key={s.slug}
                    href={`/guide/${s.slug}`}
                    prefetch
                    className="relative flex items-center gap-2.5 px-3 py-2 rounded-[10px] text-[12.5px] font-medium transition-all"
                    style={
                      active
                        ? {
                            background:
                              "linear-gradient(135deg, var(--accent-coral) 0%, var(--accent-coral-2) 100%)",
                            color: "#fff",
                            boxShadow:
                              "0 6px 14px -6px rgba(var(--accent-shadow-rgb), .55)",
                          }
                        : { color: "var(--text-2)" }
                    }
                  >
                    <Icon
                      className="h-3.5 w-3.5 shrink-0"
                      style={{ color: active ? "#fff" : "var(--accent-coral)" }}
                    />
                    <span className="truncate">{s.title}</span>
                  </Link>
                );
              })}
            </nav>
          </aside>

          <div className="min-w-0">{children}</div>
        </div>
      </div>
    </AppShell>
  );
}

export function SectionContent({
  section,
  isAdmin,
}: {
  section: Section;
  isAdmin: boolean;
}) {
  const Icon = section.icon;
  const hidden = section.adminOnly && !isAdmin;
  const image = findImage(section.slug);

  const visible = SECTIONS.filter((s) => !s.adminOnly || isAdmin);
  const idx = visible.findIndex((s) => s.slug === section.slug);
  const prev = idx > 0 ? visible[idx - 1] : null;
  const next = idx < visible.length - 1 ? visible[idx + 1] : null;

  return (
    <article className="flex flex-col gap-6 lg:gap-8">
      <section className="card-soft p-6 lg:p-8 rise">
        <div className="flex items-start gap-4">
          <div className="ico-wrap shrink-0">
            <Icon className="h-[18px] w-[18px]" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="section-title" style={{ margin: 0 }}>
                {section.title}
              </h2>
              {section.adminOnly && (
                <span
                  className="text-[10px] font-semibold uppercase tracking-[0.12em] px-2 py-0.5 rounded-full"
                  style={{
                    background: "var(--accent-tint)",
                    color: "var(--accent-ink)",
                  }}
                >
                  Chỉ quản trị
                </span>
              )}
            </div>
            <div className="section-sub" style={{ marginTop: 4 }}>
              {section.sub}
            </div>
          </div>
          {section.route && !hidden && (
            <Link
              href={section.route.href}
              className="hidden sm:inline-flex btn btn-ghost btn-sm shrink-0"
            >
              {section.route.label}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>

        {hidden ? (
          <p
            className="mt-5 text-[14px] leading-relaxed"
            style={{ color: "var(--text-3)" }}
          >
            Phần này dành riêng cho Quản trị viên. Liên hệ quản trị nếu bạn cần
            truy cập.
          </p>
        ) : (
          <>
            <div className="mt-6">
              <GuideImage slug={section.slug} title={section.title} image={image} />
            </div>

            <p
              className="mt-5 text-[14.5px] leading-relaxed"
              style={{ color: "var(--text-2)" }}
            >
              {section.intro}
            </p>

            <ol className="mt-6 flex flex-col gap-3.5">
              {section.steps.map((step, i) => (
                <li
                  key={i}
                  className="flex gap-3.5 p-3.5 rounded-[12px]"
                  style={{
                    background: "var(--surface-2)",
                    border: "1px solid var(--line)",
                  }}
                >
                  <div
                    className="h-7 w-7 rounded-full grid place-items-center shrink-0 font-serif text-[14px] font-medium"
                    style={{
                      background:
                        "linear-gradient(135deg, var(--accent-coral) 0%, var(--accent-coral-2) 100%)",
                      color: "#fff",
                      boxShadow:
                        "0 4px 10px -4px rgba(var(--accent-shadow-rgb), .5)",
                    }}
                  >
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div
                      className="font-semibold text-[14px]"
                      style={{ color: "var(--text)" }}
                    >
                      {step.title}
                    </div>
                    <div
                      className="mt-1 text-[13.5px] leading-relaxed"
                      style={{ color: "var(--text-2)" }}
                    >
                      {step.body}
                    </div>
                  </div>
                </li>
              ))}
            </ol>

            {section.tips && section.tips.length > 0 && (
              <div
                className="mt-5 rounded-[12px] p-4"
                style={{
                  background: "var(--sun-soft)",
                  border: "1px solid #f0d896",
                }}
              >
                <div
                  className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] mb-2"
                  style={{ color: "var(--sun-ink)" }}
                >
                  <Lightbulb className="h-3.5 w-3.5" />
                  Mẹo
                </div>
                <ul className="flex flex-col gap-1.5">
                  {section.tips.map((tip, i) => (
                    <li
                      key={i}
                      className="flex gap-2 text-[13px] leading-relaxed"
                      style={{ color: "var(--sun-ink)" }}
                    >
                      <ChevronRight className="h-3.5 w-3.5 mt-0.5 shrink-0 opacity-80" />
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {section.route && (
              <Link
                href={section.route.href}
                className="sm:hidden mt-5 btn btn-ghost btn-sm w-full"
              >
                {section.route.label}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </>
        )}
      </section>

      {(prev || next) && (
        <nav className="flex flex-col sm:flex-row gap-3 rise-3">
          {prev ? (
            <Link
              href={`/guide/${prev.slug}`}
              prefetch
              className="flex-1 card-soft p-4 flex items-center gap-3 transition-all hover:shadow-design-md"
              style={{ borderColor: "var(--line)" }}
            >
              <ArrowLeft
                className="h-4 w-4 shrink-0"
                style={{ color: "var(--accent-coral)" }}
              />
              <div className="min-w-0">
                <div
                  className="text-[10px] font-semibold uppercase tracking-[0.16em]"
                  style={{ color: "var(--text-3)" }}
                >
                  Trước
                </div>
                <div
                  className="text-[13.5px] font-semibold truncate"
                  style={{ color: "var(--text)" }}
                >
                  {prev.title}
                </div>
              </div>
            </Link>
          ) : (
            <span className="flex-1 hidden sm:block" />
          )}
          {next ? (
            <Link
              href={`/guide/${next.slug}`}
              prefetch
              className="flex-1 card-soft p-4 flex items-center gap-3 justify-end text-right transition-all hover:shadow-design-md"
              style={{ borderColor: "var(--line)" }}
            >
              <div className="min-w-0">
                <div
                  className="text-[10px] font-semibold uppercase tracking-[0.16em]"
                  style={{ color: "var(--text-3)" }}
                >
                  Tiếp theo
                </div>
                <div
                  className="text-[13.5px] font-semibold truncate"
                  style={{ color: "var(--text)" }}
                >
                  {next.title}
                </div>
              </div>
              <ArrowRight
                className="h-4 w-4 shrink-0"
                style={{ color: "var(--accent-coral)" }}
              />
            </Link>
          ) : (
            <span className="flex-1 hidden sm:block" />
          )}
        </nav>
      )}
    </article>
  );
}

function GuideImage({
  slug,
  title,
  image,
}: {
  slug: string;
  title: string;
  image: string | null;
}) {
  if (!image) {
    return (
      <div
        className="rounded-[14px] py-10 px-6 flex flex-col items-center justify-center text-center"
        style={{
          background: "var(--surface-2)",
          border: "2px dashed var(--line-2)",
          minHeight: 220,
        }}
      >
        <div
          className="text-[11px] font-semibold uppercase tracking-[0.14em] mb-1"
          style={{ color: "var(--text-3)" }}
        >
          Ảnh sẽ cập nhật
        </div>
        <div
          className="text-[13px] max-w-md"
          style={{ color: "var(--text-2)" }}
        >
          Đặt ảnh chụp màn hình tại{" "}
          <code
            className="px-1.5 py-0.5 rounded text-[12px]"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--line)",
              color: "var(--text)",
            }}
          >
            public/guide/{slug}.png
          </code>{" "}
          để hiển thị ở đây.
        </div>
      </div>
    );
  }
  return (
    <div
      className="rounded-[14px] overflow-hidden"
      style={{
        border: "1px solid var(--line-2)",
        boxShadow: "var(--shadow-md)",
        background: "var(--surface)",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={image}
        alt={`Ảnh giao diện: ${title}`}
        loading="lazy"
        className="block w-full h-auto"
      />
    </div>
  );
}
