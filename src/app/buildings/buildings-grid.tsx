"use client";
import { useState, useMemo } from "react";
import Link from "next/link";
import { ArrowRight, Home, Briefcase, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

type B = {
  id: string;
  name: string;
  type: "CHDV" | "VP";
  filled: number;
  total: number;
};

type Filter = "all" | "chdv" | "vp";

export function BuildingsGrid({ buildings }: { buildings: B[] }) {
  const [filter, setFilter] = useState<Filter>("all");

  const filtered = useMemo(() => {
    if (filter === "all") return buildings;
    if (filter === "chdv") return buildings.filter((b) => b.type === "CHDV");
    return buildings.filter((b) => b.type === "VP");
  }, [filter, buildings]);

  const counts = {
    all: buildings.length,
    chdv: buildings.filter((b) => b.type === "CHDV").length,
    vp: buildings.filter((b) => b.type === "VP").length,
  };

  return (
    <>
      <div className="rise-2 flex justify-between items-center flex-wrap gap-3 mb-5">
        <div className="chips">
          {(["all", "vp", "chdv"] as Filter[]).map((f) => (
            <button
              key={f}
              type="button"
              className={cn("chip", filter === f && "active")}
              onClick={() => setFilter(f)}
            >
              {f === "all" ? "Tất cả" : f === "vp" ? "Văn phòng" : "CHDV"} · {counts[f]}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-all"
          style={{ background: "var(--bg-2)", border: "1px solid var(--line)", color: "var(--text)" }}
        >
          Tỷ lệ lấp đầy <ChevronDown className="h-3 w-3" />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-5">
        {filtered.map((b, i) => {
          const pct = b.total > 0 ? Math.round((b.filled / b.total) * 100) : 0;
          const isVp = b.type === "VP";
          const num = extractNum(b.name);
          return (
            <Link
              key={b.id}
              href={`/buildings/${b.id}`}
              className={cn("bld-card", isVp && "vp", "rise-" + Math.min(6, 2 + i))}
            >
              <div className={cn("bld-card-cover", isVp ? "vp" : "chdv")}>
                <CoverPattern seed={Number(num) || i} />
                <span className="type-badge">{isVp ? "Văn phòng" : "Căn hộ DV"}</span>
                <div className="num-watermark">{num}</div>
                <div className="ico-bg">
                  {isVp ? <Briefcase className="h-[22px] w-[22px]" /> : <Home className="h-[22px] w-[22px]" />}
                </div>
              </div>
              <div className="bld-card-body">
                <h3 className="bld-card-name">{b.name}</h3>
                <RoomDots filled={b.filled} total={b.total} />
                <div className="bld-card-stats">
                  <div className="bld-stat-item">
                    <div className="v">
                      {b.filled}
                      <small>/{b.total}</small>
                    </div>
                    <div className="l">PHÒNG THUÊ</div>
                  </div>
                  <div className="bld-stat-item">
                    <div className="v">
                      {pct}
                      <small>%</small>
                    </div>
                    <div className="l">LẤP ĐẦY</div>
                  </div>
                  <div className="bld-stat-item">
                    <div className="v">{b.total - b.filled}</div>
                    <div className="l">CÒN TRỐNG</div>
                  </div>
                </div>
              </div>
              <div className="bld-card-foot">
                <span>Cập nhật hôm nay</span>
                <span className="arrow">
                  Chi tiết <ArrowRight className="h-3 w-3" />
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </>
  );
}

function extractNum(name: string): string {
  const match = name.match(/^\d+/);
  return match ? match[0] : name.slice(0, 2).toUpperCase();
}

function RoomDots({ filled, total }: { filled: number; total: number }) {
  const dots = Math.min(total, 22);
  const filledShown = Math.round((filled / total) * dots);
  return (
    <div className="bld-rooms-viz">
      {Array.from({ length: dots }, (_, i) => (
        <div
          key={i}
          className={cn("bld-room-dot", i < filledShown && "filled")}
          style={{ animationDelay: i * 0.02 + "s" }}
        />
      ))}
    </div>
  );
}

function CoverPattern({ seed }: { seed: number }) {
  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ opacity: 0.55 }}
      viewBox="0 0 320 110"
      preserveAspectRatio="none"
    >
      <defs>
        <pattern id={`dots-${seed}`} x="0" y="0" width="14" height="14" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1.2" fill="rgba(255,255,255,0.55)" />
        </pattern>
      </defs>
      <rect width="320" height="110" fill={`url(#dots-${seed})`} />
      <path
        d={`M0,${65 + (seed % 10)} Q80,${35 + (seed % 20)} 160,${55 + (seed % 15)} T320,${45 + (seed % 18)} L320,110 L0,110 Z`}
        fill="rgba(255,255,255,0.22)"
      />
      <path
        d={`M0,${85 + (seed % 8)} Q100,${65 + (seed % 12)} 200,${80 + (seed % 10)} T320,${75 + (seed % 12)} L320,110 L0,110 Z`}
        fill="rgba(255,255,255,0.3)"
      />
    </svg>
  );
}
