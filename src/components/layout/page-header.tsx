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
  return (
    <div
      className={cn(
        "px-4 lg:px-8 py-5 lg:py-6 border-b border-slate-200/60",
        gradient === "chdv" && "bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50",
        gradient === "vp" && "bg-gradient-to-br from-sky-50 to-cyan-50",
        gradient === "brand" && "bg-gradient-to-br from-indigo-50 to-pink-50",
        className,
      )}
    >
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl lg:text-2xl font-bold tracking-tight">{title}</h1>
          {description && <p className="text-sm text-slate-600 mt-0.5">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export function PageBody({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("max-w-7xl mx-auto px-4 lg:px-8 py-6", className)}>{children}</div>;
}
