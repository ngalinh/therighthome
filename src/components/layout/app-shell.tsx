"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  Home, Building2, FileText, Receipt, Wallet, Settings, LogOut, Menu, X,
  ChevronRight, ChevronDown, ClipboardList, KeyRound, Search, Calendar,
  Bell, Moon, Sparkles,
} from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type NavItem = { href: string; label: string; icon: typeof Home; activePrefix?: string; badge?: string };
type NavGroup = { label: string; icon: typeof Home; basePath: string; children: NavItem[] };
type BuildingLite = { id: string; name: string; type: "CHDV" | "VP" };

const DASHBOARD_NAV: NavItem = { href: "/", label: "Tổng quan", icon: Home, activePrefix: "/_root" };
const BUILDINGS_NAV: NavItem = { href: "/buildings", label: "Toà nhà", icon: Building2 };

const MANAGE_GROUP: NavGroup = {
  label: "Quản lý",
  icon: ClipboardList,
  basePath: "/manage",
  children: [
    { href: "/manage/chdv", label: "Căn hộ dịch vụ", icon: Home },
    { href: "/manage/vp", label: "Văn phòng", icon: Building2 },
  ],
};

const SETTINGS_NAV: NavItem = { href: "/settings", label: "Cài đặt chung", icon: Settings };

const VI_MONTHS = ["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8", "T9", "T10", "T11", "T12"];

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

  const isBuildingsActive = pathname === "/buildings" || pathname.startsWith("/buildings/");
  const [buildings, setBuildings] = useState<BuildingLite[]>([]);
  useEffect(() => {
    fetch("/api/buildings", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : []))
      .then((data: BuildingLite[]) => setBuildings(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  const insideBuilding = buildingNav;
  const buildingItems: NavItem[] = insideBuilding
    ? [
        { href: `/buildings/${insideBuilding.buildingId}`, label: "Sơ đồ phòng", icon: KeyRound },
        { href: `/buildings/${insideBuilding.buildingId}/contracts`, label: "Hợp đồng", icon: FileText },
        { href: `/buildings/${insideBuilding.buildingId}/invoices`, label: "Hoá đơn", icon: Receipt },
        { href: `/buildings/${insideBuilding.buildingId}/finance`, label: "Tài chính", icon: Wallet },
        { href: `/buildings/${insideBuilding.buildingId}/settings`, label: "Cài đặt", icon: Settings },
      ]
    : [];

  return (
    <div className="min-h-dvh">
      {/* Desktop sidebar */}
      <aside
        className="hidden lg:flex fixed inset-y-0 left-0 w-[248px] flex-col z-30"
        style={{ background: "var(--sidebar)", borderRight: "1px solid var(--sidebar-border)" }}
      >
        <BrandHeader />
        <NavSection>Chính</NavSection>
        <nav className="flex-1 px-3 flex flex-col gap-0.5 overflow-y-auto scrollbar-thin">
          <NavItemRow {...DASHBOARD_NAV} active={isActive(DASHBOARD_NAV.href)} />
          <NavGroupItem
            group={MANAGE_GROUP}
            active={isManageActive}
            expanded={manageExpanded}
            onToggle={() => setManageExpanded((v) => !v)}
            isActive={isActive}
          />
          <BuildingsNavGroup
            buildings={buildings}
            insideBuilding={insideBuilding}
            buildingItems={buildingItems}
            isActive={isActive}
            isBuildingsActive={isBuildingsActive}
          />
          <NavItemRow {...SETTINGS_NAV} active={isActive(SETTINGS_NAV.href)} />
        </nav>
        <PromoCard />
        <UserCard user={user} onSignOut={() => signOut({ callbackUrl: "/login" })} />
      </aside>

      {/* Mobile top bar */}
      <header
        className="lg:hidden sticky top-0 z-30 backdrop-blur-md"
        style={{ background: "rgba(253,250,243,0.85)", borderBottom: "1px solid var(--line)" }}
      >
        <div className="flex items-center justify-between px-4 h-14">
          <button
            className="p-2 -ml-2 rounded-xl transition-colors hover:bg-cream-2"
            onClick={() => setMobileOpen(true)}
            aria-label="Menu"
            style={{ color: "var(--text-2)" }}
          >
            <Menu className="h-5 w-5" />
          </button>
          <Link href="/" className="font-serif text-xl tracking-tight" style={{ color: "var(--text)" }}>
            The Right Home
          </Link>
          <div className="w-9" />
        </div>
      </header>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside
            className="absolute inset-y-0 left-0 w-[280px] shadow-design-lg flex flex-col"
            style={{ background: "var(--sidebar)" }}
          >
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--sidebar-border)" }}>
              <Link href="/" onClick={() => setMobileOpen(false)} className="font-serif text-xl">
                The Right Home
              </Link>
              <button
                onClick={() => setMobileOpen(false)}
                className="p-1.5 rounded-lg transition-colors hover:bg-sidebar-hover"
                aria-label="Close"
                style={{ color: "var(--text-on-sidebar-2)" }}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <NavSection>Chính</NavSection>
            <nav className="flex-1 px-3 flex flex-col gap-0.5 overflow-y-auto">
              <NavItemRow {...DASHBOARD_NAV} active={isActive(DASHBOARD_NAV.href)} onClick={() => setMobileOpen(false)} />
              <NavGroupItem
                group={MANAGE_GROUP}
                active={isManageActive}
                expanded={manageExpanded}
                onToggle={() => setManageExpanded((v) => !v)}
                isActive={isActive}
                onChildClick={() => setMobileOpen(false)}
              />
              <BuildingsNavGroup
                buildings={buildings}
                insideBuilding={insideBuilding}
                buildingItems={buildingItems}
                isActive={isActive}
                isBuildingsActive={isBuildingsActive}
                onChildClick={() => setMobileOpen(false)}
              />
              <NavItemRow {...SETTINGS_NAV} active={isActive(SETTINGS_NAV.href)} onClick={() => setMobileOpen(false)} />
            </nav>
            <UserCard user={user} onSignOut={() => signOut({ callbackUrl: "/login" })} />
          </aside>
        </div>
      )}

      {/* Content */}
      <main className="lg:ml-[248px] pb-28 lg:pb-8">
        {/* Desktop topbar */}
        <DesktopTopbar />
        <div className="page-anim">{children}</div>
      </main>

      {/* Mobile bottom nav (when inside a building) */}
      {insideBuilding && (
        <nav
          className="lg:hidden fixed bottom-0 inset-x-0 z-30 backdrop-blur-md pb-[max(env(safe-area-inset-bottom),0.5rem)]"
          style={{ background: "rgba(253,250,243,0.92)", borderTop: "1px solid var(--line)" }}
        >
          <div className="grid grid-cols-5">
            {buildingItems.map((it) => {
              const Icon = it.icon;
              const active = isActive(it.href);
              return (
                <Link
                  key={it.href}
                  href={it.href}
                  className="flex flex-col items-center gap-0.5 py-3 text-[11px] font-medium transition-colors"
                  style={{ color: active ? "var(--accent-coral)" : "var(--text-3)" }}
                >
                  <div
                    className={cn(
                      "h-7 w-7 rounded-xl flex items-center justify-center mb-0.5 transition-all",
                      active && "shadow-design-pop",
                    )}
                    style={active ? { background: "linear-gradient(135deg, var(--accent-coral) 0%, var(--accent-coral-2) 100%)", color: "#fff" } : {}}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <span className="leading-tight">{it.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      )}

      {/* Mobile bottom nav (top level) */}
      {!insideBuilding && (
        <nav
          className="lg:hidden fixed bottom-0 inset-x-0 z-30 backdrop-blur-md pb-[max(env(safe-area-inset-bottom),0.5rem)]"
          style={{ background: "rgba(253,250,243,0.92)", borderTop: "1px solid var(--line)" }}
        >
          <div className="grid grid-cols-4">
            {[
              DASHBOARD_NAV,
              { href: MANAGE_GROUP.children[0].href, label: MANAGE_GROUP.label, icon: MANAGE_GROUP.icon, activePrefix: MANAGE_GROUP.basePath },
              BUILDINGS_NAV,
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
                  className="flex flex-col items-center gap-0.5 py-3 text-[11px] font-medium transition-colors"
                  style={{ color: active ? "var(--accent-coral)" : "var(--text-3)" }}
                >
                  <div
                    className={cn(
                      "h-7 w-7 rounded-xl flex items-center justify-center mb-0.5 transition-all",
                      active && "shadow-design-pop",
                    )}
                    style={active ? { background: "linear-gradient(135deg, var(--accent-coral) 0%, var(--accent-coral-2) 100%)", color: "#fff" } : {}}
                  >
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

/* ── Brand header (sidebar top) ── */
function BrandHeader() {
  return (
    <Link
      href="/"
      className="flex items-center gap-3 px-5 pt-[22px] pb-[18px] group"
    >
      <div
        className="h-10 w-10 rounded-full flex items-center justify-center text-white font-serif text-2xl shrink-0 transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-105"
        style={{
          background: "linear-gradient(135deg, var(--accent-coral) 0%, #d5866c 100%)",
          boxShadow: "0 6px 18px -6px rgba(201, 100, 66, .55), inset 0 1px 0 rgba(255,255,255,.3)",
        }}
      >
        R
      </div>
      <div className="min-w-0 flex-1">
        <div
          className="font-serif text-[22px] leading-[1.05] tracking-tight truncate"
          style={{ color: "var(--brand-text)" }}
        >
          The Right Home
        </div>
        <div
          className="text-[10px] font-medium uppercase tracking-[0.12em] mt-1 truncate"
          style={{ color: "var(--text-on-sidebar-2)" }}
        >
          Quản lý CHDV & VP
        </div>
      </div>
    </Link>
  );
}

function NavSection({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="px-4 pt-[18px] pb-2 text-[10px] font-semibold uppercase tracking-[0.2em]"
      style={{ color: "var(--text-on-sidebar-2)" }}
    >
      {children}
    </div>
  );
}

function NavItemRow({
  href, label, icon: Icon, active, onClick, badge,
}: NavItem & { active: boolean; onClick?: () => void }) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "relative flex items-center gap-3 px-3 py-2.5 rounded-[10px] text-[13.5px] font-medium transition-all whitespace-nowrap",
        active && "shadow-design-pop",
      )}
      style={
        active
          ? {
              background: "linear-gradient(135deg, var(--accent-coral) 0%, var(--accent-coral-2) 100%)",
              color: "#fff",
            }
          : { color: "var(--text-on-sidebar)" }
      }
    >
      {active && (
        <span
          className="absolute -left-3 top-1/2 -translate-y-1/2 w-1 h-[22px] rounded-r"
          style={{ background: "var(--accent-coral)" }}
        />
      )}
      <Icon className={cn("h-[18px] w-[18px] shrink-0 transition-transform", active && "scale-105")} />
      <span className="flex-1 truncate">{label}</span>
      {badge && (
        <span
          className="text-[11px] font-semibold px-2 py-px rounded-[10px] tabular-nums"
          style={
            active
              ? { background: "rgba(255,255,255,0.25)", color: "#fff" }
              : { background: "rgba(0,0,0,0.06)", color: "var(--text-on-sidebar)" }
          }
        >
          {badge}
        </span>
      )}
    </Link>
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
          "w-full relative flex items-center gap-3 px-3 py-2.5 rounded-[10px] text-[13.5px] font-medium transition-all",
        )}
        style={
          active
            ? { background: "var(--sidebar-hover)", color: "var(--accent-ink)" }
            : { color: "var(--text-on-sidebar)" }
        }
      >
        <Icon className="h-[18px] w-[18px] shrink-0" />
        <span className="flex-1 text-left truncate">{group.label}</span>
        {open ? (
          <ChevronDown className="h-3.5 w-3.5 opacity-60" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 opacity-50" />
        )}
      </button>
      {open && (
        <div
          className="mt-0.5 ml-3 pl-3 flex flex-col gap-0.5"
          style={{ borderLeft: "1px solid var(--sidebar-border)" }}
        >
          {group.children.map((c) => (
            <NavItemRow key={c.href} {...c} active={isActive(c.href)} onClick={onChildClick} />
          ))}
        </div>
      )}
    </div>
  );
}

function BuildingsNavGroup({
  buildings,
  insideBuilding, buildingItems,
  isActive, isBuildingsActive,
  onChildClick,
}: {
  buildings: BuildingLite[];
  insideBuilding?: { buildingId: string; buildingName: string; type: "CHDV" | "VP" };
  buildingItems: NavItem[];
  isActive: (href: string) => boolean;
  isBuildingsActive: boolean;
  onChildClick?: () => void;
}) {
  const open = isBuildingsActive;
  return (
    <div>
      <Link
        href="/buildings"
        onClick={onChildClick}
        className="w-full relative flex items-center gap-3 px-3 py-2.5 rounded-[10px] text-[13.5px] font-medium transition-all"
        style={
          isBuildingsActive
            ? { background: "var(--sidebar-hover)", color: "var(--brand-text)" }
            : { color: "var(--text-on-sidebar)" }
        }
      >
        <Building2 className="h-[18px] w-[18px] shrink-0" />
        <span className="flex-1 truncate">Toà nhà</span>
        {open ? (
          <ChevronDown className="h-3.5 w-3.5 opacity-60" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 opacity-50" />
        )}
      </Link>
      {open && (
        <div
          className="mt-0.5 ml-3 pl-3 flex flex-col gap-0.5"
          style={{ borderLeft: "1px solid var(--sidebar-border)" }}
        >
          {buildings.map((b) => {
            const isThis = insideBuilding?.buildingId === b.id;
            return (
              <div key={b.id}>
                <Link
                  href={`/buildings/${b.id}`}
                  onClick={onChildClick}
                  className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[12.5px] font-medium transition-all"
                  style={
                    isThis
                      ? { background: "var(--sidebar-hover)", color: "var(--brand-text)" }
                      : { color: "var(--text-on-sidebar)" }
                  }
                >
                  <span
                    className="h-1.5 w-1.5 rounded-full shrink-0"
                    style={{
                      background: b.type === "VP" ? "#6b4226" : "var(--accent-coral)",
                    }}
                  />
                  <span className="flex-1 truncate">{b.name}</span>
                </Link>
                {isThis && (
                  <div
                    className="mt-0.5 ml-3 pl-3 flex flex-col gap-0.5"
                    style={{ borderLeft: "1px solid var(--sidebar-border)" }}
                  >
                    {buildingItems.map((it) => (
                      <Link
                        key={it.href}
                        href={it.href}
                        onClick={onChildClick}
                        className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[12px] font-medium transition-all"
                        style={
                          isActive(it.href)
                            ? { background: "var(--accent-tint)", color: "var(--accent-ink)" }
                            : { color: "var(--text-on-sidebar-2)" }
                        }
                      >
                        <it.icon className="h-3 w-3 shrink-0" />
                        <span className="truncate">{it.label}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PromoCard() {
  return (
    <div
      className="relative overflow-hidden mx-3.5 mt-3.5 mb-2 p-3.5 rounded-[14px] flex gap-2.5 items-start"
      style={{
        background: "linear-gradient(135deg, var(--accent-tint) 0%, var(--sun-soft) 100%)",
        border: "1px solid var(--accent-soft)",
      }}
    >
      <span
        className="absolute -top-5 -right-5 w-14 h-14 rounded-full"
        style={{ background: "radial-gradient(circle, rgba(255,255,255,.6), transparent 70%)" }}
        aria-hidden
      />
      <div
        className="w-[30px] h-[30px] rounded-[9px] grid place-items-center text-white shrink-0 animate-float"
        style={{
          background: "linear-gradient(135deg, var(--accent-coral), var(--accent-coral-2))",
          boxShadow: "0 4px 12px -4px rgba(201, 100, 66, .55)",
        }}
      >
        <Sparkles className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[12px] font-bold tracking-wide" style={{ color: "var(--accent-ink)" }}>
          Mẹo hôm nay
        </div>
        <div
          className="text-[11.5px] leading-snug mt-0.5"
          style={{ color: "var(--accent-ink)", opacity: 0.78 }}
        >
          Thiết lập nhắc nhở tự động cho hoá đơn quá hạn.
        </div>
      </div>
    </div>
  );
}

function UserCard({ user, onSignOut }: { user: { name: string; email: string; role: string }; onSignOut: () => void }) {
  return (
    <div className="px-4 py-3.5 flex items-center gap-3" style={{ borderTop: "1px solid var(--sidebar-border)" }}>
      <div
        className="h-[38px] w-[38px] rounded-full grid place-items-center text-white font-serif text-lg shrink-0"
        style={{
          background: "linear-gradient(135deg, var(--sage) 0%, #6ba978 100%)",
          boxShadow: "0 4px 10px -4px rgba(79, 138, 92, .5)",
        }}
      >
        {user.name.charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13.5px] font-semibold truncate" style={{ color: "var(--brand-text)" }}>
          {user.name}
        </div>
        <div className="text-[11.5px] truncate" style={{ color: "var(--text-on-sidebar-2)" }}>
          {user.role === "ADMIN" ? "Quản trị viên" : "Nhân viên"}
        </div>
      </div>
      <button
        onClick={onSignOut}
        className="w-7 h-7 rounded-lg grid place-items-center transition-all hover:bg-sidebar-hover"
        aria-label="Đăng xuất"
        style={{ border: "1px solid var(--sidebar-border)", color: "var(--text-on-sidebar-2)" }}
      >
        <LogOut className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function DesktopTopbar() {
  const now = new Date();
  const monthLabel = `${VI_MONTHS[now.getMonth()]} · ${now.getFullYear()}`;
  return (
    <div
      className="hidden lg:flex sticky top-0 z-20 items-center gap-3.5 px-8 py-3.5 backdrop-blur-md"
      style={{
        background: "rgba(253,250,243,0.78)",
        borderBottom: "1px solid var(--line)",
      }}
    >
      <div
        className="flex items-center gap-2.5 flex-1 max-w-[460px] px-3.5 py-2 rounded-xl transition-all focus-within:shadow-design-md"
        style={{ background: "var(--surface)", border: "1px solid var(--line)" }}
      >
        <Search className="h-4 w-4 shrink-0" style={{ color: "var(--text-3)" }} />
        <input
          placeholder="Tìm kiếm hoá đơn, khách thuê, toà nhà..."
          className="flex-1 border-none outline-none bg-transparent text-[13.5px] placeholder:opacity-70"
          style={{ color: "var(--text)" }}
        />
        <span
          className="text-[11px] px-2 py-px rounded font-mono"
          style={{
            color: "var(--text-3)",
            border: "1px solid var(--line)",
            background: "var(--bg-2)",
          }}
        >
          ⌘K
        </span>
      </div>
      <div className="flex-1" />
      <div
        className="hidden xl:inline-flex items-center gap-2 px-3 py-2 rounded-full text-[12.5px] font-semibold"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--line)",
          color: "var(--text-2)",
        }}
      >
        <Calendar className="h-3.5 w-3.5" style={{ color: "var(--accent-coral)" }} />
        <span>{monthLabel}</span>
      </div>
      <IconBtn aria-label="Chế độ tối"><Moon className="h-[15px] w-[15px]" /></IconBtn>
      <IconBtn aria-label="Thông báo">
        <Bell className="h-[15px] w-[15px]" />
        <span
          className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full"
          style={{ background: "var(--accent-coral)" }}
        />
      </IconBtn>
    </div>
  );
}

function IconBtn({ children, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      className="relative w-[38px] h-[38px] rounded-[11px] grid place-items-center transition-all hover:shadow-design-md"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--line)",
        color: "var(--text-2)",
      }}
    >
      {children}
    </button>
  );
}
