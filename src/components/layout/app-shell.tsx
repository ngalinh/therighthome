"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  Home, Building2, FileText, Receipt, Wallet, Settings, LogOut, Menu, X, ChevronRight, ChevronDown, ClipboardList,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

type NavItem = { href: string; label: string; icon: typeof Home; activePrefix?: string };
type NavGroup = { label: string; icon: typeof Home; basePath: string; children: NavItem[] };

const TOP_NAV: NavItem[] = [
  { href: "/", label: "Tổng quan", icon: Home, activePrefix: "/_root" },
  { href: "/buildings", label: "Toà nhà", icon: Building2 },
];

const MANAGE_GROUP: NavGroup = {
  label: "Quản lý",
  icon: ClipboardList,
  basePath: "/manage",
  children: [
    { href: "/manage/chdv", label: "Căn hộ dịch vụ", icon: Building2 },
    { href: "/manage/vp", label: "Văn phòng", icon: Building2 },
  ],
};

const SETTINGS_NAV: NavItem = { href: "/settings", label: "Cài đặt chung", icon: Settings };

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
  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(href + "/");
  };
  const isManageActive = pathname.startsWith(MANAGE_GROUP.basePath);
  const [manageExpanded, setManageExpanded] = useState(isManageActive);

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

  const isChdv = insideBuilding?.type === "CHDV";
  const buildingGradient = isChdv ? "bg-gradient-chdv" : "bg-gradient-vp";

  return (
    <div className="min-h-dvh">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-64 flex-col bg-white border-r border-slate-100 z-30 shadow-[1px_0_0_0_rgba(0,0,0,0.04)]">
        <BrandHeader />
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          <SectionLabel>Chính</SectionLabel>
          {TOP_NAV.map((it) => (
            <NavLink key={it.href} {...it} active={isActive(it.href)} />
          ))}
          <NavGroupItem
            group={MANAGE_GROUP}
            active={isManageActive}
            expanded={manageExpanded}
            onToggle={() => setManageExpanded((v) => !v)}
            isActive={isActive}
          />
          <NavLink {...SETTINGS_NAV} active={isActive(SETTINGS_NAV.href)} />
          {insideBuilding && (
            <>
              <div className={cn(
                "mt-5 mb-1 rounded-xl px-3 py-2.5 flex items-center gap-2 shadow-sm",
                buildingGradient,
              )}>
                <Building2 className="h-4 w-4 text-white shrink-0" />
                <span className="text-white text-sm font-semibold truncate flex-1">
                  {insideBuilding.buildingName}
                </span>
              </div>
              {buildingItems.map((it) => (
                <NavLink key={it.href} {...it} active={isActive(it.href)} buildingType={insideBuilding.type} />
              ))}
            </>
          )}
        </nav>
        <UserCard user={user} onSignOut={() => signOut({ callbackUrl: "/login" })} />
      </aside>

      {/* Mobile top bar */}
      <header className="lg:hidden sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200/60">
        <div className="flex items-center justify-between px-4 h-14">
          <button className="p-2 -ml-2 rounded-xl hover:bg-slate-100 transition-colors" onClick={() => setMobileOpen(true)} aria-label="Menu">
            <Menu className="h-5 w-5 text-slate-700" />
          </button>
          <Link href="/" className="font-bold gradient-text text-lg tracking-tight">The Right Home</Link>
          <div className="w-9" />
        </div>
      </header>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 bg-white shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <Link href="/" onClick={() => setMobileOpen(false)}>
                <span className="font-bold gradient-text text-lg">The Right Home</span>
              </Link>
              <button
                onClick={() => setMobileOpen(false)}
                className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                aria-label="Close"
              >
                <X className="h-5 w-5 text-slate-600" />
              </button>
            </div>
            <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
              <SectionLabel>Chính</SectionLabel>
              {TOP_NAV.map((it) => (
                <NavLink key={it.href} {...it} active={isActive(it.href)} onClick={() => setMobileOpen(false)} />
              ))}
              <NavGroupItem
                group={MANAGE_GROUP}
                active={isManageActive}
                expanded={manageExpanded}
                onToggle={() => setManageExpanded((v) => !v)}
                isActive={isActive}
                onChildClick={() => setMobileOpen(false)}
              />
              <NavLink {...SETTINGS_NAV} active={isActive(SETTINGS_NAV.href)} onClick={() => setMobileOpen(false)} />
              {insideBuilding && (
                <>
                  <div className={cn(
                    "mt-5 mb-1 rounded-xl px-3 py-2.5 flex items-center gap-2 shadow-sm",
                    buildingGradient,
                  )}>
                    <Building2 className="h-4 w-4 text-white shrink-0" />
                    <span className="text-white text-sm font-semibold truncate flex-1">
                      {insideBuilding.buildingName}
                    </span>
                  </div>
                  {buildingItems.map((it) => (
                    <NavLink key={it.href} {...it} active={isActive(it.href)} buildingType={insideBuilding.type} onClick={() => setMobileOpen(false)} />
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
        <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200/60 pb-[env(safe-area-inset-bottom)]">
          <div className="grid grid-cols-5">
            {buildingItems.map((it) => {
              const Icon = it.icon;
              const active = isActive(it.href);
              return (
                <Link
                  key={it.href}
                  href={it.href}
                  className={cn(
                    "flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium transition-colors",
                    active ? "text-primary" : "text-slate-400",
                  )}
                >
                  <div className={cn(
                    "h-6 w-6 rounded-lg flex items-center justify-center mb-0.5 transition-all",
                    active ? (isChdv ? "bg-gradient-chdv text-white shadow-sm" : "bg-gradient-vp text-white shadow-sm") : "",
                  )}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <span className="leading-tight">{it.label.replace("Tổng quan toà", "Tổng quan")}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      )}

      {/* Mobile bottom nav (top level) */}
      {!insideBuilding && (
        <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200/60 pb-[env(safe-area-inset-bottom)]">
          <div className="grid grid-cols-4">
            {[
              ...TOP_NAV,
              { href: MANAGE_GROUP.children[0].href, label: MANAGE_GROUP.label, icon: MANAGE_GROUP.icon, activePrefix: MANAGE_GROUP.basePath },
              SETTINGS_NAV,
            ].map((it) => {
              const Icon = it.icon;
              const active = it.activePrefix === MANAGE_GROUP.basePath
                ? pathname.startsWith(MANAGE_GROUP.basePath)
                : isActive(it.href);
              return (
                <Link
                  key={it.label}
                  href={it.href}
                  className={cn(
                    "flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium transition-colors",
                    active ? "text-primary" : "text-slate-400",
                  )}
                >
                  <div className={cn(
                    "h-6 w-6 rounded-lg flex items-center justify-center mb-0.5 transition-all",
                    active ? "bg-gradient-brand text-white shadow-sm" : "",
                  )}>
                    <Icon className="h-4 w-4" />
                  </div>
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
          <span className="text-[11px] text-slate-400">Quản lý CHDV & VP</span>
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

function NavGroupItem({
  group, active, expanded, onToggle, isActive, onChildClick,
}: {
  group: NavGroup;
  active: boolean;
  expanded: boolean;
  onToggle: () => void;
  isActive: (href: string) => boolean;
  onChildClick?: () => void;
}) {
  const Icon = group.icon;
  const open = expanded || active;
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all",
          active ? "bg-gradient-brand/10 text-primary" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
        )}
      >
        <Icon className={cn("h-4.5 w-4.5", active ? "text-primary" : "text-slate-400")} />
        <span className="flex-1 text-left">{group.label}</span>
        {open ? <ChevronDown className="h-3.5 w-3.5 opacity-60" /> : <ChevronRight className="h-3.5 w-3.5 opacity-50" />}
      </button>
      {open && (
        <div className="mt-0.5 ml-3 pl-3 border-l border-slate-100 space-y-0.5">
          {group.children.map((c) => (
            <NavLink
              key={c.href}
              {...c}
              active={isActive(c.href)}
              onClick={onChildClick}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function NavLink({
  href, label, icon: Icon, active, buildingType, onClick,
}: NavItem & { active: boolean; buildingType?: "CHDV" | "VP"; onClick?: () => void }) {
  const activeGradient = buildingType === "VP"
    ? "bg-gradient-vp/10 text-teal-700"
    : "bg-gradient-brand/10 text-primary";
  const activeIcon = buildingType === "VP" ? "text-teal-600" : "text-primary";

  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all",
        active ? activeGradient : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
      )}
    >
      <Icon className={cn("h-4.5 w-4.5", active ? activeIcon : "text-slate-400")} />
      <span className="flex-1">{label}</span>
      {active && <ChevronRight className="h-3.5 w-3.5 opacity-50" />}
    </Link>
  );
}

function UserCard({ user, onSignOut }: { user: { name: string; email: string; role: string }; onSignOut: () => void }) {
  return (
    <div className="border-t border-slate-100 p-3">
      <div className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-slate-50 transition-colors">
        <div className="h-9 w-9 rounded-full bg-gradient-brand flex items-center justify-center text-white text-sm font-bold shadow-sm shrink-0">
          {user.name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm text-slate-900 truncate">{user.name}</div>
          <div className="text-xs text-slate-400 truncate">{user.role === "ADMIN" ? "Quản trị viên" : "Nhân viên"}</div>
        </div>
        <button onClick={onSignOut} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors" aria-label="Đăng xuất">
          <LogOut className="h-4 w-4 text-slate-500" />
        </button>
      </div>
    </div>
  );
}
