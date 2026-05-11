import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { GuideShell, SectionContent } from "../_shell";
import { SECTIONS } from "../sections";

export function generateStaticParams() {
  return SECTIONS.map((s) => ({ slug: s.slug }));
}

export default async function GuideSectionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const { slug } = await params;
  const section = SECTIONS.find((s) => s.slug === slug);
  if (!section) notFound();

  const role = session.user.role;
  const isAdmin = role === "ADMIN";

  return (
    <GuideShell
      user={{
        name: session.user.name || "",
        email: session.user.email || "",
        role,
      }}
      activeSlug={section.slug}
    >
      <SectionContent section={section} isAdmin={isAdmin} />
    </GuideShell>
  );
}
