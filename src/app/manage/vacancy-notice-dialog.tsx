"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Download, Loader2, Share2, ChevronDown, Save } from "lucide-react";
import { toast } from "sonner";
import { formatVND, formatNumber, parseVNDInput, formatRoomNumber, roomFloor } from "@/lib/utils";
import { NoticeTemplate, type NoticeData, type NoticeBuilding, type NoticeRoom } from "./notice-template";

type Building = {
  id: string;
  name: string;
  address: string;
  type: "CHDV" | "VP";
  info: string | null;
};

type VacantRoom = {
  id: string;
  buildingId: string;
  number: string;
  info: string | null;
  expectedRent: string | null;
  vacancyNotes: string | null;
  previousRent: string | null;
};

type Group = { building: Building; rooms: VacantRoom[] };

const DEFAULT_POLICY = {
  thongTin: [
    "**Nội thất:** Full nội thất như hình — sàn gỗ, tủ lạnh, giường, tủ, nệm, bếp, bàn ghế, máy giặt, máy lạnh.",
    "**Tiền điện:** 4.000đ/số",
    "**Nước:** 100.000đ/người",
    "**Phí dịch vụ:** 150.000đ/phòng",
    "**Xe máy/đạp:** Free 1 xe/khách",
    "**Đăng ký tạm trú:** 200k/người",
    "**Thú cưng:** chỉ cho phép nuôi MÈO (tối đa 2 con) có cam kết.",
  ].join("\n"),
  thongTinNoteTag: "",
  thongTinNote: "",
  coc: [
    "**HĐ 6 tháng:** cọc 1 tháng",
    "**HĐ 1 năm:** cọc 1.5 tháng · thanh toán 1 tháng/lần",
    "Cọc giữ phòng 2 triệu giữ 3 ngày, cọc đủ giữ tối đa 7 ngày",
    "Khách vào thanh toán đủ tiền cọc và tiền nhà tháng đầu tiên",
  ].join("\n"),
  hoaHongTerm1: "HĐ 6 tháng",
  hoaHongPct1: "50",
  hoaHongTerm2: "HĐ 12 tháng",
  hoaHongPct2: "80",
  hoaHongSub: "Hoa hồng tính trên giá thuê tháng đầu · thanh toán sau khi khách ký HĐ & đóng đủ cọc",
  luuY: [
    "**Không nhận khách sử dụng xe điện.**",
    "Trường hợp khách huỷ cọc: chia 50/50 cho chủ và môi giới, sau khi trừ tiền số ngày giữ phòng.",
    "Giao dịch thành công khi khách đóng đủ tiền cọc và tiền nhà tháng đầu tiên.",
    "Giá thuê và tiền đặt cọc dành cho số lượng 2 ng/phòng. Nếu số lượng > 2 người ở vui lòng liên hệ trao đổi.",
  ].join("\n"),
  thanhToanIntro: "Tiền mặt hoặc chuyển khoản",
  bankName: "TPBank",
  bankAccountName: "Bùi Thuỳ Linh",
  bankAccountNumber: "0000 5078 297",
  guideName: "Linh",
  guidePhone: "0988 020 319",
  guideSub: "Sẵn sàng sắp xếp lịch xem phòng trong ngày",
};

const DEFAULT_FOOTER = {
  phone: "0988 020 319",
  email: "info@therighthome.vn",
  website: "therighthome.vn",
  note: "**The Right Home** · Thông tin có thể thay đổi không cần báo trước.",
};

function todayVN(): string {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")} · ${String(d.getMonth() + 1).padStart(2, "0")} · ${d.getFullYear()}`;
}

function floorLabel(roomNumber: string): string {
  const f = roomFloor(roomNumber);
  if (f === "G") return "Trệt";
  return `Lầu ${f}`;
}

function buildInitialData(groups: Group[]): NoticeData {
  const totalRooms = groups.reduce((s, g) => s + g.rooms.length, 0);
  const allRents = groups.flatMap((g) => g.rooms.map((r) => r.expectedRent).filter(Boolean) as string[]);
  const minRent = allRents.length > 0 ? allRents.reduce((m, r) => (BigInt(r) < BigInt(m) ? r : m)) : "";
  const minRentLabel = minRent ? formatRentShort(BigInt(minRent)) : "—";

  return {
    brand: "The Right Home",
    brandSub: "Quản lý CHDV & Văn phòng",
    date: todayVN(),
    eyebrow: "Thông báo · Phòng trống",
    titleBefore: `${totalRooms} phòng sẵn sàng`,
    titleEm: "cho thuê",
    subtitle: "Kính gửi Quý đối tác môi giới, dưới đây là danh sách phòng đang trống tại các toà nhà do The Right Home quản lý. Vui lòng liên hệ để xem trực tiếp hoặc nhận tư liệu chi tiết.",
    summary: [
      { label: "Tổng phòng trống", value: String(totalRooms), unit: "phòng" },
      { label: "Toà nhà", value: String(groups.length), unit: "địa điểm" },
      { label: "Giá thuê từ", value: minRentLabel, unit: "triệu/tháng" },
      { label: "Sẵn sàng", value: "Ngay", unit: "hôm nay" },
    ],
    buildings: groups.map((g) => buildInitialBuilding(g)),
    policy: { ...DEFAULT_POLICY },
    footer: { ...DEFAULT_FOOTER },
  };
}

function formatRentShort(amount: bigint): string {
  // 5800000 → "5.8"; 12000000 → "12"
  const n = Number(amount) / 1_000_000;
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(1);
}

function formatDate(d: Date): string {
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function buildInitialBuilding(g: Group): NoticeBuilding {
  return {
    id: g.building.id,
    name: g.building.name,
    metaParts: [g.building.address, g.building.type === "CHDV" ? "Căn hộ dịch vụ" : "Văn phòng", ""],
    countLabel: `${g.rooms.length} phòng`,
    info: g.building.info ?? "",
    rooms: g.rooms.map((r) => buildInitialRoom(r)),
  };
}

// Local cache key — server is authoritative, this is just an offline / first-paint fallback.
const STORAGE_KEY = "vacancy-notice-template:v1";

type SavedTemplate = {
  brand?: string;
  brandSub?: string;
  date?: string;
  eyebrow?: string;
  titleBefore?: string;
  titleEm?: string;
  subtitle?: string;
  summary?: NoticeData["summary"];
  policy?: NoticeData["policy"];
  footer?: NoticeData["footer"];
  buildingsById?: Record<string, Partial<NoticeBuilding>>;
  roomsById?: Record<string, Partial<NoticeRoom>>;
};

function loadLocal(): SavedTemplate | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SavedTemplate;
  } catch {
    return null;
  }
}

function applySaved(base: NoticeData, saved: SavedTemplate | null): NoticeData {
  if (!saved) return base;
  return {
    ...base,
    brand: saved.brand ?? base.brand,
    brandSub: saved.brandSub ?? base.brandSub,
    // Don't restore date — time-sensitive default.
    date: base.date,
    eyebrow: saved.eyebrow ?? base.eyebrow,
    // Don't restore titleBefore — it embeds room count ("N phòng sẵn sàng")
    // which must reflect the current selection, not what was saved earlier.
    titleBefore: base.titleBefore,
    titleEm: saved.titleEm ?? base.titleEm,
    subtitle: saved.subtitle ?? base.subtitle,
    // Summary: restore labels/units but keep computed values (count, etc.).
    summary: base.summary.map((s, i) => {
      const ss = saved.summary?.[i];
      if (!ss) return s;
      return { label: ss.label ?? s.label, value: s.value, unit: ss.unit ?? s.unit };
    }),
    policy: saved.policy ? { ...base.policy, ...saved.policy } : base.policy,
    footer: saved.footer ? { ...base.footer, ...saved.footer } : base.footer,
    // Buildings/rooms: DB-derived fields (name, address, info, expectedRent,
    // vacancyNotes, etc.) must always come from `base` so that DB edits flow
    // into the notice immediately. Only notice-specific customizations
    // (tag, tagLabel, title, featured) are restored from saved template.
    buildings: base.buildings.map((b) => ({
      ...b,
      rooms: b.rooms.map((r) => {
        const sr = saved.roomsById?.[r.id];
        if (!sr) return r;
        return {
          ...r,
          tag: sr.tag ?? r.tag,
          tagLabel: sr.tagLabel ?? r.tagLabel,
          title: sr.title ?? r.title,
          featured: sr.featured ?? r.featured,
        };
      }),
    })),
  };
}

function buildInitialRoom(r: VacantRoom): NoticeRoom {
  const features = (r.info ?? "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  const price = r.expectedRent ? formatNumber(BigInt(r.expectedRent)) : "Liên hệ";
  return {
    id: r.id,
    floor: floorLabel(r.number),
    number: formatRoomNumber(r.number),
    tag: "",
    tagLabel: "",
    title: "",
    features,
    desc: r.vacancyNotes ?? "",
    price,
    priceUnit: r.expectedRent ? "VNĐ / tháng" : "Báo giá riêng",
    featured: false,
  };
}

export function VacancyNoticeDialog({
  groups, onClose,
}: {
  groups: Group[];
  onClose: () => void;
}) {
  // First-paint uses localStorage cache; server template overrides once fetched.
  const [data, setData] = useState<NoticeData>(() => applySaved(buildInitialData(groups), loadLocal()));
  const [exporting, setExporting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  // iOS detection runs in effect to avoid SSR hydration mismatch — server
  // doesn't know the UA so we start with false and flip on the client.
  const [isIos, setIsIos] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setIsIos(isIOS()); }, []);

  // Fetch shared template from server on mount. Server is authoritative — if
  // it has a template, override the localStorage-derived state. Stays silent
  // on network errors so the dialog still works offline.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/app-settings/vacancy-notice", { cache: "no-store" });
        if (!res.ok) return;
        const json = await res.json() as { template: SavedTemplate | null };
        if (cancelled || !json.template) return;
        setData((prev) => applySaved(buildInitialData(groups), json.template));
        // Mirror to localStorage so next open is instant.
        try {
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(json.template));
        } catch { /* ignore quota */ }
      } catch { /* offline — keep local */ }
    })();
    return () => { cancelled = true; };
    // groups is stable for the dialog's lifetime (parent rebuilds on open).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function saveTemplate() {
    const payload: SavedTemplate = {
      brand: data.brand,
      brandSub: data.brandSub,
      eyebrow: data.eyebrow,
      titleBefore: data.titleBefore,
      titleEm: data.titleEm,
      subtitle: data.subtitle,
      summary: data.summary,
      policy: data.policy,
      footer: data.footer,
      // DB-derived data (names, addresses, info, rents, notes) is intentionally
      // omitted — it flows live from DB on every dialog open so edits show up.
      // Only notice-specific customizations are persisted.
      roomsById: Object.fromEntries(
        data.buildings.flatMap((b) => b.rooms.map((r) => [r.id, { tag: r.tag, tagLabel: r.tagLabel, title: r.title, featured: r.featured }])),
      ),
    };
    setSaving(true);
    try {
      const res = await fetch("/api/app-settings/vacancy-notice", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null) as { error?: string } | null;
        throw new Error(err?.error ?? "Lưu thất bại");
      }
      try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload)); } catch { /* ignore quota */ }
      toast.success("Đã lưu mẫu (đồng bộ giữa các thiết bị)");
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1500);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Lưu thất bại");
    } finally {
      setSaving(false);
    }
  }

  function patch<K extends keyof NoticeData>(key: K, value: NoticeData[K]) {
    setData((prev) => ({ ...prev, [key]: value }));
  }
  function patchPolicy<K extends keyof NoticeData["policy"]>(key: K, value: NoticeData["policy"][K]) {
    setData((prev) => ({ ...prev, policy: { ...prev.policy, [key]: value } }));
  }
  function patchFooter<K extends keyof NoticeData["footer"]>(key: K, value: NoticeData["footer"][K]) {
    setData((prev) => ({ ...prev, footer: { ...prev.footer, [key]: value } }));
  }
  function patchSummary(i: number, patchObj: Partial<NoticeData["summary"][number]>) {
    setData((prev) => ({
      ...prev,
      summary: prev.summary.map((s, idx) => (idx === i ? { ...s, ...patchObj } : s)),
    }));
  }
  function patchBuilding(bid: string, patchObj: Partial<NoticeBuilding>) {
    setData((prev) => ({
      ...prev,
      buildings: prev.buildings.map((b) => (b.id === bid ? { ...b, ...patchObj } : b)),
    }));
  }
  function patchRoom(bid: string, rid: string, patchObj: Partial<NoticeRoom>) {
    setData((prev) => ({
      ...prev,
      buildings: prev.buildings.map((b) =>
        b.id === bid
          ? { ...b, rooms: b.rooms.map((r) => (r.id === rid ? { ...r, ...patchObj } : r)) }
          : b,
      ),
    }));
  }

  async function generateBlob(): Promise<Blob | null> {
    if (!previewRef.current) return null;
    if (document.fonts?.ready) {
      try { await document.fonts.ready; } catch { /* ignore */ }
    }

    // Clone the preview into an off-screen container at a fixed desktop width.
    // html2canvas-pro otherwise computes layout against `windowWidth` (= the
    // device viewport on mobile, ~390px), so the captured PNG ends up cramped
    // even though the preview looks correct on screen. Cloning + explicit
    // `width` + `windowWidth` makes the capture deterministic.
    const CAPTURE_WIDTH = 960;
    const node = previewRef.current;
    const offscreen = document.createElement("div");
    offscreen.style.cssText = [
      "position: fixed",
      "left: -10000px",
      "top: 0",
      `width: ${CAPTURE_WIDTH}px`,
      "background: #faf7f3",
      "pointer-events: none",
      "z-index: -1",
    ].join("; ");
    const clone = node.cloneNode(true) as HTMLElement;
    clone.style.width = `${CAPTURE_WIDTH}px`;
    offscreen.appendChild(clone);
    document.body.appendChild(offscreen);

    // scale 3 gives a noticeably sharper PNG when zoomed, but the resulting
    // canvas pixel count (CAPTURE_WIDTH * height * scale^2) can exceed iOS
    // Safari's ~16M-pixel hard limit on busy notices. Drop back to 2 when the
    // notice has many rooms to avoid a blank/crashed export on iPhone.
    const totalRooms = data.buildings.reduce((s, b) => s + b.rooms.length, 0);
    const scale = totalRooms > 20 ? 2 : 3;

    try {
      const { default: html2canvas } = await import("html2canvas-pro");
      const canvas = await html2canvas(clone, {
        backgroundColor: "#faf7f3",
        scale,
        width: CAPTURE_WIDTH,
        windowWidth: CAPTURE_WIDTH,
        useCORS: true,
        allowTaint: false,
        logging: false,
      });
      return await new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/png"));
    } finally {
      document.body.removeChild(offscreen);
    }
  }

  function isIOS(): boolean {
    if (typeof navigator === "undefined") return false;
    return /iPad|iPhone|iPod/i.test(navigator.userAgent) && !("MSStream" in window);
  }

  const fileLabel = useMemo(() => {
    const parts = data.buildings.map((b) => b.name.replace(/[^\w-]+/g, "-")).join("_");
    return `thong-bao-phong-trong-${parts || "TRH"}.png`;
  }, [data.buildings]);

  async function download() {
    setExporting(true);
    try {
      const blob = await generateBlob();
      if (!blob) throw new Error("Không tạo được hình");
      const file = new File([blob], fileLabel, { type: "image/png" });

      // On iOS, <a download> always saves to Files (no Photos route from JS).
      // The only way into Photos is the native share sheet — user taps
      // "Lưu Ảnh" → Photos. So on iOS we route "Tải hình" through Web Share.
      if (isIOS() && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "Thông báo phòng trống" });
        return;
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileLabel;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Đã tải hình ảnh");
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
      toast.error(e instanceof Error ? e.message : "Lỗi xuất hình");
    } finally {
      setExporting(false);
    }
  }

  async function share() {
    setExporting(true);
    try {
      const blob = await generateBlob();
      if (!blob) throw new Error("Không tạo được hình");
      const file = new File([blob], fileLabel, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "Thông báo phòng trống" });
      } else {
        await download();
      }
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
      toast.error(e instanceof Error ? e.message : "Lỗi chia sẻ");
    } finally {
      setExporting(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-7xl max-h-[94vh] overflow-y-auto sm:p-5">
        <DialogHeader>
          <DialogTitle>Thông báo phòng trống</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] gap-5">
          {/* Editor */}
          <div className="space-y-3 text-sm">
            <p className="text-xs text-slate-500">
              Chỉnh nội dung bên dưới rồi bấm "Tải hình" để xuất ảnh gửi môi giới. Trong textarea, gói chữ trong <code>**...**</code> để in đậm.
            </p>

            <Section title="Header" defaultOpen>
              <div className="grid grid-cols-2 gap-2">
                <FieldText label="Brand" value={data.brand} onChange={(v) => patch("brand", v)} />
                <FieldText label="Sub-brand" value={data.brandSub} onChange={(v) => patch("brandSub", v)} />
                <FieldText label="Ngày" value={data.date} onChange={(v) => patch("date", v)} />
                <FieldText label="Eyebrow" value={data.eyebrow} onChange={(v) => patch("eyebrow", v)} />
                <FieldText label="Title em (nghiêng)" value={data.titleEm} onChange={(v) => patch("titleEm", v)} />
              </div>
              <FieldText label="Title (trước em)" value={data.titleBefore} onChange={(v) => patch("titleBefore", v)} />
              <FieldArea label="Subtitle" value={data.subtitle} rows={3} onChange={(v) => patch("subtitle", v)} />
            </Section>

            <Section title="Tóm tắt (4 ô)">
              {data.summary.map((s, i) => (
                <div key={i} className="grid grid-cols-3 gap-2">
                  <FieldText label="Nhãn" value={s.label} onChange={(v) => patchSummary(i, { label: v })} />
                  <FieldText label="Giá trị" value={s.value} onChange={(v) => patchSummary(i, { value: v })} />
                  <FieldText label="Đơn vị" value={s.unit} onChange={(v) => patchSummary(i, { unit: v })} />
                </div>
              ))}
            </Section>

            {data.buildings.map((b) => (
              <Section key={b.id} title={`Toà · ${b.name || "—"}`}>
                <FieldText label="Tên toà" value={b.name} onChange={(v) => patchBuilding(b.id, { name: v })} />
                <FieldText
                  label="Meta (cách nhau bằng |)"
                  value={b.metaParts.join(" | ")}
                  onChange={(v) => patchBuilding(b.id, { metaParts: v.split("|").map((s) => s.trim()) })}
                />
                <FieldArea
                  label="Thông tin toà nhà (hiển thị dưới địa chỉ)"
                  value={b.info}
                  rows={3}
                  onChange={(v) => patchBuilding(b.id, { info: v })}
                />
                <FieldText label="Nhãn số phòng" value={b.countLabel} onChange={(v) => patchBuilding(b.id, { countLabel: v })} />
                <div className="space-y-2 mt-2">
                  {b.rooms.map((r) => (
                    <div key={r.id} className="rounded-lg border border-slate-200 bg-slate-50/40 p-2.5 space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <FieldText label="Lầu" value={r.floor} onChange={(v) => patchRoom(b.id, r.id, { floor: v })} />
                        <FieldText label="Số phòng" value={r.number} onChange={(v) => patchRoom(b.id, r.id, { number: v })} />
                      </div>
                      <FieldText label="Tiêu đề phòng" value={r.title} onChange={(v) => patchRoom(b.id, r.id, { title: v })} />
                      <FieldArea
                        label="Đặc điểm (mỗi dòng 1 thẻ, dùng **...** để in đậm)"
                        value={r.features.join("\n")}
                        rows={3}
                        onChange={(v) => patchRoom(b.id, r.id, { features: v.split("\n").map((s) => s.trim()).filter(Boolean) })}
                      />
                      <FieldText label="Mô tả" value={r.desc} onChange={(v) => patchRoom(b.id, r.id, { desc: v })} />
                      <div className="grid grid-cols-2 gap-2">
                        <FieldText label="Giá" value={r.price} onChange={(v) => patchRoom(b.id, r.id, { price: v })} />
                        <FieldText label="Đơn vị" value={r.priceUnit} onChange={(v) => patchRoom(b.id, r.id, { priceUnit: v })} />
                      </div>
                      <div className="grid grid-cols-3 gap-2 items-end">
                        <FieldSelect
                          label="Tag"
                          value={r.tag}
                          onChange={(v) => patchRoom(b.id, r.id, { tag: v as NoticeRoom["tag"] })}
                          options={[
                            { value: "", label: "— Không —" },
                            { value: "new", label: "Mới (xanh)" },
                            { value: "hot", label: "Ưu đãi (cam)" },
                          ]}
                        />
                        <FieldText label="Tag label" value={r.tagLabel} onChange={(v) => patchRoom(b.id, r.id, { tagLabel: v })} />
                        <label className="text-xs flex items-center gap-2 mt-5">
                          <input
                            type="checkbox"
                            checked={r.featured}
                            onChange={(e) => patchRoom(b.id, r.id, { featured: e.target.checked })}
                            className="rounded"
                          />
                          <span>Featured (nền sáng hơn)</span>
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
            ))}

            <Section title="Chính sách · Thông tin chung">
              <FieldArea label="Nội dung" value={data.policy.thongTin} rows={8} onChange={(v) => patchPolicy("thongTin", v)} />
              <FieldText label="Note tag (vd: Riêng G01 & G02…)" value={data.policy.thongTinNoteTag} onChange={(v) => patchPolicy("thongTinNoteTag", v)} />
              <FieldArea label="Nội dung note" value={data.policy.thongTinNote} rows={3} onChange={(v) => patchPolicy("thongTinNote", v)} />
            </Section>

            <Section title="Chính sách · Cọc & thanh toán">
              <FieldArea label="Nội dung" value={data.policy.coc} rows={5} onChange={(v) => patchPolicy("coc", v)} />
            </Section>

            <Section title="Chính sách · Hoa hồng">
              <div className="grid grid-cols-2 gap-2">
                <FieldText label="Term 1" value={data.policy.hoaHongTerm1} onChange={(v) => patchPolicy("hoaHongTerm1", v)} />
                <FieldText label="% Term 1" value={data.policy.hoaHongPct1} onChange={(v) => patchPolicy("hoaHongPct1", v)} />
                <FieldText label="Term 2" value={data.policy.hoaHongTerm2} onChange={(v) => patchPolicy("hoaHongTerm2", v)} />
                <FieldText label="% Term 2" value={data.policy.hoaHongPct2} onChange={(v) => patchPolicy("hoaHongPct2", v)} />
              </div>
              <FieldArea label="Ghi chú dưới" value={data.policy.hoaHongSub} rows={2} onChange={(v) => patchPolicy("hoaHongSub", v)} />
            </Section>

            <Section title="Chính sách · Lưu ý">
              <FieldArea label="Nội dung" value={data.policy.luuY} rows={6} onChange={(v) => patchPolicy("luuY", v)} />
            </Section>

            <Section title="Chính sách · Thanh toán & STK">
              <FieldArea label="Mô tả" value={data.policy.thanhToanIntro} rows={2} onChange={(v) => patchPolicy("thanhToanIntro", v)} />
              <div className="grid grid-cols-3 gap-2">
                <FieldText label="Ngân hàng" value={data.policy.bankName} onChange={(v) => patchPolicy("bankName", v)} />
                <FieldText label="Chủ tài khoản" value={data.policy.bankAccountName} onChange={(v) => patchPolicy("bankAccountName", v)} />
                <FieldText label="Số tài khoản" value={data.policy.bankAccountNumber} onChange={(v) => patchPolicy("bankAccountNumber", v)} />
              </div>
            </Section>

            <Section title="Chính sách · Dẫn khách liên hệ">
              <div className="grid grid-cols-2 gap-2">
                <FieldText label="Tên người dẫn" value={data.policy.guideName} onChange={(v) => patchPolicy("guideName", v)} />
                <FieldText label="Số điện thoại" value={data.policy.guidePhone} onChange={(v) => patchPolicy("guidePhone", v)} />
              </div>
              <FieldText label="Ghi chú" value={data.policy.guideSub} onChange={(v) => patchPolicy("guideSub", v)} />
            </Section>

            <Section title="Footer">
              <div className="grid grid-cols-3 gap-2">
                <FieldText label="Điện thoại" value={data.footer.phone} onChange={(v) => patchFooter("phone", v)} />
                <FieldText label="Email" value={data.footer.email} onChange={(v) => patchFooter("email", v)} />
                <FieldText label="Website" value={data.footer.website} onChange={(v) => patchFooter("website", v)} />
              </div>
              <FieldArea label="Footer note" value={data.footer.note} rows={3} onChange={(v) => patchFooter("note", v)} />
            </Section>
          </div>

          {/* Preview */}
          <div className="lg:sticky lg:top-0 lg:self-start space-y-2">
            <div className="text-[11px] text-slate-500">Xem trước · Tỷ lệ thật khi xuất hình</div>
            <div className="overflow-x-auto -mx-1 px-1 rounded-xl border border-slate-200" style={{ maxHeight: "78vh" }}>
              <div style={{ minWidth: 960 }}>
                <NoticeTemplate refProp={previewRef} data={data} />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Đóng</Button>
          <Button variant="outline" onClick={saveTemplate} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? "Đang lưu…" : savedFlash ? "Đã lưu" : "Lưu mẫu"}
          </Button>
          {/* On iOS, <a download> can't save to Photos — both Chia sẻ and Tải
              hình route through the same share sheet, so we drop the duplicate
              and keep only Chia sẻ as the primary gradient action. */}
          {isIos ? (
            <Button variant="gradient" onClick={share} disabled={exporting}>
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />} Chia sẻ
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={share} disabled={exporting}>
                {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />} Chia sẻ
              </Button>
              <Button variant="gradient" onClick={download} disabled={exporting}>
                {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Tải hình
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Section({ title, children, defaultOpen }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  return (
    <details open={defaultOpen} className="rounded-xl border border-slate-200 bg-white">
      <summary className="cursor-pointer select-none px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-2">
        <ChevronDown className="h-3 w-3 transition-transform [details[open]>summary>&]:rotate-180" />
        {title}
      </summary>
      <div className="px-3 pb-3 space-y-2">{children}</div>
    </details>
  );
}

function FieldText({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px]">{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} className="h-8 text-xs" />
    </div>
  );
}

function FieldArea({ label, value, rows, onChange }: { label: string; value: string; rows: number; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px]">{label}</Label>
      <Textarea value={value} onChange={(e) => onChange(e.target.value)} rows={rows} className="text-xs font-mono" />
    </div>
  );
}

function FieldSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px]">{label}</Label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs"
      >
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

// Re-export for VacantRoomsTab to keep its existing imports — it passes the
// same { groups, onClose } shape we accept above.
