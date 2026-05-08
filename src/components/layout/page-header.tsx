import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  actions,
  className,
  gradient,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
  gradient?: "chdv" | "vp" | "brand";
}) {
  const isDark = gradient === "chdv" || gradient === "vp" || gradient === "brand";

  return (
    <div
      className={cn(
        "px-4 lg:px-8 py-5 lg:py-6 border-b border-slate-200/60 relative overflow-hidden",
        gradient === "chdv" && "bg-gradient-chdv text-white",
        gradient === "vp" && "bg-gradient-vp text-white",
        gradient === "brand" && "bg-indigo-600 text-white",
        !gradient && "",
        className,
      )}
    >
      {isDark && (
        <div className="absolute -top-6 -right-6 w-28 h-28 rounded-full bg-white/10 pointer-events-none" />
      )}
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 relative">
        <div className="min-w-0">
          <h1 className={cn("text-xl lg:text-2xl font-bold tracking-tight", isDark ? "text-white" : "")}>{title}</h1>
          {description && (
            <p className={cn("text-sm mt-0.5", isDark ? "text-white/80" : "text-slate-600")}>{description}</p>
          )}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export function PageBody({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("max-w-7xl mx-auto px-4 lg:px-8 py-6", className)}>{children}</div>;
}
