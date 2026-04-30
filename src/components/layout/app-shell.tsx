"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  Home, Building2, FileText, Receipt, Wallet, Settings, LogOut, Menu, X, ChevronRight, Upload,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

type NavItem = { href: string; label: string; icon: typeof Home; activePrefix?: string };

const TOP_NAV: NavItem[] = [
  { href: "/", label: "Tổng quan", icon: Home, activePrefix: "/_root" },
  { href: "/buildings", label: "Toà nhà", icon: Building2 },
  { href: "/import", label: "Import Excel", icon: Upload },
  { href: "/settings", label: "Cài đặt chung", icon: Settings },
];

export function AppShell({
  children,
  user,
  buildingNav,
}: {
  children: React.ReactNode;
  user: { name: string; email: string; role: string };
  buildingNav?: { buildingId: string; buildingName: string; type: "CHDV" | "VP" };
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const insideBuilding = buildingNav;
  const buildingItems: NavItem[] = insideBuilding
    ? [
        { href: `/buildings/${insideBuilding.buildingId}`, label: "Tổng quan toà", icon: Home },
        { href: `/buildings/${insideBuilding.buildingId}/contracts`, label: "Hợp đồng", icon: FileText },
        { href: `/buildings/${insideBuilding.buildingId}/invoices`, label: "Hoá đơn", icon: Receipt },
        { href: `/buildings/${insideBuilding.buildingId}/finance`, label: "Tài chính", icon: Wallet },
        { href: `/buildings/${insideBuilding.buildingId}/settings`, label: "Cài đặt", icon: Settings },
      ]
    : [];

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(href + "/");
  };

  return (
    <div className="min-h-dvh">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-64 flex-col bg-white border-r border-slate-200 z-30">
        <BrandHeader />
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          <SectionLabel>Chính</SectionLabel>
          {TOP_NAV.map((it) => (
            <NavLink key={it.href} {...it} active={isActive(it.href)} />
          ))}
          {insideBuilding && (
            <>
              <SectionLabel className="mt-6">
                <span className="flex items-center gap-1.5">
                  <Building2 className="h-3 w-3" />
                  {insideBuilding.buildingName}
                </span>
              </SectionLabel>
              {buildingItems.map((it) => (
                <NavLink key={it.href} {...it} active={isActive(it.href)} />
              ))}
            </>
          )}
        </nav>
        <UserCard user={user} onSignOut={() => signOut({ callbackUrl: "/login" })} />
      </aside>

      {/* Mobile top bar */}
      <header className="lg:hidden sticky top-0 z-30 bg-white/85 backdrop-blur-md border-b border-slate-200">
        <div className="flex items-center justify-between px-4 h-14">
          <button className="p-2 -ml-2" onClick={() => setMobileOpen(true)} aria-label="Menu">
            <Menu className="h-5 w-5" />
          </button>
          <Link href="/" className="font-bold gradient-text text-lg">The Right Home</Link>
          <div className="w-9" />
        </div>
      </header>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 bg-white shadow-xl flex flex-col animate-slide-up">
            <div className="flex items-center justify-between p-4 border-b">
              <span className="font-bold gradient-text">The Right Home</span>
              <button onClick={() => setMobileOpen(false)} aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
              {TOP_NAV.map((it) => (
                <NavLink key={it.href} {...it} active={isActive(it.href)} onClick={() => setMobileOpen(false)} />
              ))}
              {insideBuilding && (
                <>
                  <SectionLabel className="mt-6">{insideBuilding.buildingName}</SectionLabel>
                  {buildingItems.map((it) => (
                    <NavLink key={it.href} {...it} active={isActive(it.href)} onClick={() => setMobileOpen(false)} />
                  ))}
                </>
              )}
            </nav>
            <UserCard user={user} onSignOut={() => signOut({ callbackUrl: "/login" })} />
          </aside>
        </div>
      )}

      {/* Content */}
      <main className="lg:ml-64 pb-24 lg:pb-8">{children}</main>

      {/* Mobile bottom nav (when inside a building) */}
      {insideBuilding && (
        <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200 pb-[env(safe-area-inset-bottom)]">
          <div className="grid grid-cols-5">
            {buildingItems.map((it) => {
              const Icon = it.icon;
              const active = isActive(it.href);
              return (
                <Link
                  key={it.href}
                  href={it.href}
                  className={cn(
                    "flex flex-col items-center gap-0.5 py-2.5 text-[11px] transition-colors",
                    active ? "text-primary" : "text-slate-500",
                  )}
                >
                  <Icon className="h-5 w-5" />
                  <span className="leading-tight">{it.label.replace("Tổng quan toà", "Tổng quan")}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      )}

      {/* Mobile bottom nav (top level) */}
      {!insideBuilding && (
        <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200 pb-[env(safe-area-inset-bottom)]">
          <div className="grid grid-cols-4">
            {TOP_NAV.map((it) => {
              const Icon = it.icon;
              const active = isActive(it.href);
              return (
                <Link
                  key={it.href}
                  href={it.href}
                  className={cn(
                    "flex flex-col items-center gap-0.5 py-2.5 text-[11px] transition-colors",
                    active ? "text-primary" : "text-slate-500",
                  )}
                >
                  <Icon className="h-5 w-5" />
                  <span className="leading-tight">{it.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}

function BrandHeader() {
  return (
    <div className="px-5 py-5 border-b border-slate-100">
      <Link href="/" className="flex items-center gap-2.5">
        <div className="h-9 w-9 rounded-xl bg-gradient-brand flex items-center justify-center shadow-md">
          <svg viewBox="0 0 24 24" className="h-5 w-5 text-white" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round">
            <path d="M5 11 L12 6 L19 11 L19 19 L14 19 L14 14 L10 14 L10 19 L5 19 Z"/>
          </svg>
        </div>
        <div className="flex flex-col leading-tight">
          <span className="font-bold gradient-text text-base">The Right Home</span>
          <span className="text-[11px] text-slate-500">Quản lý CHDV & VP</span>
        </div>
      </Link>
    </div>
  );
}

function SectionLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("text-[10px] font-semibold uppercase tracking-wider text-slate-400 px-3 mt-2 mb-1", className)}>
      {children}
    </div>
  );
}

function NavLink({
  href, label, icon: Icon, active, onClick,
}: NavItem & { active: boolean; onClick?: () => void }) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors",
        active ? "bg-gradient-brand/10 text-primary" : "text-slate-600 hover:bg-slate-50",
      )}
    >
      <Icon className={cn("h-5 w-5", active && "text-primary")} />
      <span className="flex-1">{label}</span>
      {active && <ChevronRight className="h-4 w-4" />}
    </Link>
  );
}

function UserCard({ user, onSignOut }: { user: { name: string; email: string; role: string }; onSignOut: () => void }) {
  return (
    <div className="border-t border-slate-100 p-3">
      <div className="flex items-center gap-3 px-2 py-2">
        <div className="h-9 w-9 rounded-full bg-gradient-brand flex items-center justify-center text-white text-sm font-semibold">
          {user.name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm truncate">{user.name}</div>
          <div className="text-xs text-slate-500 truncate">{user.role === "ADMIN" ? "Quản trị" : "Nhân viên"}</div>
        </div>
        <button onClick={onSignOut} className="p-2 hover:bg-slate-100 rounded-lg" aria-label="Đăng xuất">
          <LogOut className="h-4 w-4 text-slate-600" />
        </button>
      </div>
    </div>
  );
}

