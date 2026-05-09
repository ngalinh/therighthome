import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { listAccessibleBuildings } from "@/lib/permissions";
import { AppShell } from "@/components/layout/app-shell";
import { Filter, Plus, Building2 } from "lucide-react";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { NewBuildingButton } from "./new-building-button";
import { BuildingsGrid } from "./buildings-grid";

export default async function BuildingsPage() {
  const session = await auth();
  if (!session) redirect("/login");
  const role = session.user.role;
  const buildings = (await listAccessibleBuildings(session.user.id, role))
    .slice()
    .sort((a, b) => (a.type === b.type ? 0 : a.type === "VP" ? -1 : 1));

  const counts = await prisma.room.groupBy({
    by: ["buildingId", "status"],
    where: { buildingId: { in: buildings.map((b) => b.id) } },
    _count: true,
  });
  const countMap = new Map<string, { total: number; occupied: number }>();
  for (const c of counts) {
    const cur = countMap.get(c.buildingId) ?? { total: 0, occupied: 0 };
    cur.total += c._count;
    if (c.status === "OCCUPIED") cur.occupied += c._count;
    countMap.set(c.buildingId, cur);
  }

  const buildingsWithCounts = buildings.map((b) => {
    const c = countMap.get(b.id) ?? { total: 0, occupied: 0 };
    return { id: b.id, name: b.name, type: b.type as "CHDV" | "VP", filled: c.occupied, total: c.total };
  });

  const totalRooms = buildingsWithCounts.reduce((s, b) => s + b.total, 0);
  const filledRooms = buildingsWithCounts.reduce((s, b) => s + b.filled, 0);
  const overallPct = totalRooms > 0 ? Math.round((filledRooms / totalRooms) * 100) : 0;

  const chdvList = buildingsWithCounts.filter((b) => b.type === "CHDV");
  const vpList = buildingsWithCounts.filter((b) => b.type === "VP");
  const chdvFill = chdvList.reduce((s, b) => s + b.filled, 0);
  const chdvTot = chdvList.reduce((s, b) => s + b.total, 0);
  const vpFill = vpList.reduce((s, b) => s + b.filled, 0);
  const vpTot = vpList.reduce((s, b) => s + b.total, 0);

  return (
    <AppShell user={{ name: session.user.name || "", email: session.user.email || "", role }}>
      <div className="px-4 lg:px-9 pt-6 lg:pt-9 pb-12 lg:pb-20 max-w-[1360px] mx-auto">
        {buildings.length === 0 ? (
          <div className="card-soft p-12 text-center max-w-lg mx-auto mt-12 rise">
            <div className="ico-wrap mx-auto mb-4 h-12 w-12">
              <Building2 className="h-6 w-6" />
            </div>
            <h3 className="font-serif text-2xl font-medium" style={{ color: "var(--text)" }}>
              Chưa có toà nhà
            </h3>
            <p className="page-sub mx-auto mt-2">
              Thêm toà nhà đầu tiên để bắt đầu quản lý.
            </p>
            {role === "ADMIN" && (
              <div className="mt-5">
                <NewBuildingButton />
              </div>
            )}
          </div>
        ) : (
          <>
            <header className="rise flex flex-col lg:flex-row lg:justify-between lg:items-end gap-4 lg:gap-6 mb-7">
              <div className="min-w-0">
                <div className="page-eyebrow">
                  <span className="dot" />
                  Bất động sản
                </div>
                <h1 className="page-title">
                  <span className="accent">Toà nhà</span> của bạn
                </h1>
                <p className="page-sub">
                  Quản lý {buildings.length} toà nhà, {totalRooms} phòng — tỷ lệ lấp đầy hiện tại {overallPct}%.
                </p>
              </div>
              <div className="flex flex-wrap gap-2.5">
                <button type="button" className="btn btn-ghost">
                  <Filter className="h-3.5 w-3.5" /> Lọc
                </button>
                {role === "ADMIN" && <NewBuildingButton />}
              </div>
            </header>

            {/* Hero block: dark stats card + occupancy split */}
            <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-4 mb-8 rise-1">
              <div className="bld-hero-card">
                <div>
                  <div className="bld-hero-eyebrow">
                    <span className="pip" />
                    Tổng quy mô
                  </div>
                  <div className="bld-hero-num">
                    {buildings.length}
                    <small>toà nhà</small>
                  </div>
                </div>
                <div className="bld-hero-row">
                  <Item label="CHDV" value={chdvList.length} />
                  <Item label="Văn phòng" value={vpList.length} />
                  <Item label="Tổng phòng" value={totalRooms} />
                  <Item label="Đang thuê" value={filledRooms} />
                </div>
                {/* mini ring at top-right */}
                <div className="absolute top-7 right-8 z-[2]">
                  <Ring filled={filledRooms} total={totalRooms} size={120} dark gradId="heroRingGrad" />
                </div>
              </div>

              <div className="bld-occupancy">
                <div className="split-item">
                  <Ring filled={chdvFill} total={chdvTot} size={120} gradId="chdvRingGrad" />
                  <div className="text-center">
                    <div className="split-tag chdv">Căn hộ DV</div>
                    <div className="split-num">
                      {chdvFill}
                      <small>/{chdvTot}</small>
                    </div>
                    <div className="split-sub">
                      {chdvList.length} toà · {chdvTot - chdvFill} trống
                    </div>
                  </div>
                </div>
                <div className="split-divider" />
                <div className="split-item">
                  <Ring filled={vpFill} total={vpTot} size={120} gradId="vpRingGrad" />
                  <div className="text-center">
                    <div className="split-tag vp">Văn phòng</div>
                    <div className="split-num">
                      {vpFill}
                      <small>/{vpTot}</small>
                    </div>
                    <div className="split-sub">
                      {vpList.length} toà · {vpTot - vpFill} trống
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <BuildingsGrid buildings={buildingsWithCounts} />
          </>
        )}
      </div>
    </AppShell>
  );
}

function Item({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="item-label">{label}</div>
      <div className="item-val">{value}</div>
    </div>
  );
}

function Ring({
  filled, total, size = 130, dark = false, gradId,
}: {
  filled: number; total: number; size?: number; dark?: boolean; gradId: string;
}) {
  const pct = total > 0 ? Math.round((filled / total) * 100) : 0;
  const r = (size - 16) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;
  const stops = dark
    ? [{ o: "0%", c: "#f9d4be" }, { o: "100%", c: "var(--accent-coral-2)" }]
    : [{ o: "0%", c: "var(--accent-coral)" }, { o: "100%", c: "#de9f8a" }];
  return (
    <div className={"occupancy-ring " + (dark ? "ring-dark" : "")} style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset={stops[0].o} stopColor={stops[0].c} />
            <stop offset={stops[1].o} stopColor={stops[1].c} />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth="11"
          stroke={dark ? "rgba(255,255,255,0.08)" : "var(--surface-3)"}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth="11"
          stroke={`url(#${gradId})`}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 1.4s var(--ease)" }}
        />
      </svg>
      <div className="ring-center">
        <div className="pct">
          {pct}
          <small>%</small>
        </div>
        <div className="lbl">Lấp đầy</div>
      </div>
    </div>
  );
}
