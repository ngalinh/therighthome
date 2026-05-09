import { cn } from "@/lib/utils";

/**
 * PageHeader — design pattern: eyebrow pill + serif title + sub line + actions.
 * Renders inside the main content padding so it lines up with PageBody below.
 * The legacy `gradient` prop is accepted for backwards compatibility but ignored;
 * the new design no longer uses gradient banners.
 */
export function PageHeader({
  title,
  description,
  eyebrow,
  actions,
  accentTitle,
  className,
}: {
  title: string;
  description?: string;
  eyebrow?: string;
  actions?: React.ReactNode;
  /** When provided, this slice of the title is rendered in coral italic accent style. */
  accentTitle?: string;
  className?: string;
  /** @deprecated kept for backwards compatibility; ignored in new design */
  gradient?: "chdv" | "vp" | "brand";
}) {
  const renderTitle = () => {
    if (!accentTitle) return title;
    const parts = title.split(accentTitle);
    return (
      <>
        {parts[0]}
        <span className="accent">{accentTitle}</span>
        {parts[1] ?? ""}
      </>
    );
  };

  return (
    <div className="px-4 lg:px-9 pt-6 lg:pt-9 max-w-[1360px] mx-auto w-full">
      <header
        className={cn(
          "rise flex flex-col lg:flex-row lg:justify-between lg:items-end gap-4 lg:gap-6 mb-2",
          className,
        )}
      >
        <div className="min-w-0">
          {eyebrow && (
            <div className="page-eyebrow">
              <span className="dot" />
              {eyebrow}
            </div>
          )}
          <h1 className="page-title">{renderTitle()}</h1>
          {description && <p className="page-sub">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2.5">{actions}</div>}
      </header>
    </div>
  );
}

export function PageBody({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("px-4 lg:px-9 pt-5 pb-12 lg:pb-20 max-w-[1360px] mx-auto", className)}>
      {children}
    </div>
  );
}
