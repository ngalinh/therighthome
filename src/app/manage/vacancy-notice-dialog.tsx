"use client";
import { useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Download, Loader2, Share2 } from "lucide-react";
import { toast } from "sonner";
import { formatVND, formatNumber, parseVNDInput, formatRoomNumber } from "@/lib/utils";

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

type EditableRoom = {
  id: string;
  number: string;
  rent: string;        // raw input (digits or empty)
  info: string;
  notes: string;
};

type EditableGroup = {
  buildingId: string;
  title: string;       // building name (editable)
  address: string;
  body: string;        // building.info-derived multiline text
  rooms: EditableRoom[];
};

export function VacancyNoticeDialog({
  groups, onClose,
}: {
  groups: Group[];
  onClose: () => void;
}) {
  const [brand, setBrand] = useState("THE RIGHT HOME");
  const [editable, setEditable] = useState<EditableGroup[]>(
    () => groups.map((g) => ({
      buildingId: g.building.id,
      title: g.building.name,
      address: g.building.address,
      body: g.building.info ?? "",
      rooms: g.rooms.map((r) => ({
        id: r.id,
        number: formatRoomNumber(r.number),
        rent: r.expectedRent ?? "",
        info: r.info ?? "",
        notes: r.vacancyNotes ?? "",
      })),
    })),
  );
  const [exporting, setExporting] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  function patchGroup(buildingId: string, patch: Partial<EditableGroup>) {
    setEditable((prev) => prev.map((g) => (g.buildingId === buildingId ? { ...g, ...patch } : g)));
  }
  function patchRoom(buildingId: string, roomId: string, patch: Partial<EditableRoom>) {
    setEditable((prev) => prev.map((g) =>
      g.buildingId === buildingId
        ? { ...g, rooms: g.rooms.map((r) => (r.id === roomId ? { ...r, ...patch } : r)) }
        : g,
    ));
  }

  async function generateBlob(): Promise<Blob | null> {
    if (!previewRef.current) return null;
    const { default: html2canvas } = await import("html2canvas-pro");
    const canvas = await html2canvas(previewRef.current, {
      backgroundColor: "#1f3a4d",
      scale: 2,
      useCORS: false,
      allowTaint: false,
      logging: false,
    });
    return new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/png"));
  }

  const fileLabel = useMemo(() => {
    if (editable.length === 1) {
      return `thong-bao-${editable[0].title}-${editable[0].rooms.map((r) => r.number).join("-")}.png`;
    }
    return `thong-bao-phong-trong.png`;
  }, [editable]);

  async function download() {
    setExporting(true);
    try {
      const blob = await generateBlob();
      if (!blob) throw new Error("Không tạo được hình");
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

  const totalRooms = editable.reduce((s, g) => s + g.rooms.length, 0);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Thông báo phòng trống — {totalRooms} phòng / {editable.length} toà
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Editor */}
          <div className="space-y-4 text-sm">
            <p className="text-xs text-slate-500">
              Chỉnh nội dung bên dưới rồi bấm "Tải hình" để xuất ảnh gửi môi giới. Mỗi dòng bắt đầu bằng <code>**Heading**</code> sẽ in đậm trong mẫu.
            </p>
            <div className="space-y-1.5">
              <Label className="text-xs">Tiêu đề thương hiệu</Label>
              <Input value={brand} onChange={(e) => setBrand(e.target.value)} />
            </div>
            {editable.map((g) => (
              <div key={g.buildingId} className="rounded-xl border border-slate-200 p-3 space-y-3 bg-slate-50/40">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Tên toà</Label>
                    <Input value={g.title} onChange={(e) => patchGroup(g.buildingId, { title: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Địa chỉ</Label>
                    <Input value={g.address} onChange={(e) => patchGroup(g.buildingId, { address: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-2">
                  {g.rooms.map((r) => {
                    const rentDisplay = r.rent ? formatNumber(parseVNDInput(r.rent)) : "";
                    return (
                      <div key={r.id} className="rounded-lg border border-slate-200 bg-white p-2.5 space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <Label className="text-[11px]">Phòng</Label>
                            <Input value={r.number} onChange={(e) => patchRoom(g.buildingId, r.id, { number: e.target.value })} />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[11px]">Giá thuê dự kiến (₫)</Label>
                            <Input
                              inputMode="numeric"
                              value={rentDisplay}
                              onChange={(e) => patchRoom(g.buildingId, r.id, { rent: e.target.value })}
                              placeholder="—"
                            />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[11px]">Thông tin phòng</Label>
                          <Textarea
                            value={r.info}
                            onChange={(e) => patchRoom(g.buildingId, r.id, { info: e.target.value })}
                            rows={2}
                            placeholder="vd: 25m², ban công, hướng Đông Nam"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[11px]">Ghi chú</Label>
                          <Input
                            value={r.notes}
                            onChange={(e) => patchRoom(g.buildingId, r.id, { notes: e.target.value })}
                            placeholder="vd: dọn vào tháng 6"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Nội dung chung của toà</Label>
                  <Textarea
                    value={g.body}
                    onChange={(e) => patchGroup(g.buildingId, { body: e.target.value })}
                    rows={10}
                    className="font-mono text-[12px]"
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Preview (export target) */}
          <div className="lg:sticky lg:top-0 lg:self-start">
            <div className="text-[11px] text-slate-500 mb-1.5">Xem trước · Tỷ lệ thật khi xuất hình</div>
            <div className="overflow-x-auto -mx-1 px-1">
              <div className="inline-block min-w-[640px]">
                <NoticePreview ref={previewRef} brand={brand} groups={editable} />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Đóng</Button>
          <Button variant="outline" onClick={share} disabled={exporting}>
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />} Chia sẻ
          </Button>
          <Button variant="gradient" onClick={download} disabled={exporting}>
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Tải hình
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type BodyBlock =
  | { kind: "heading"; text: string }
  | { kind: "para"; text: string }
  | { kind: "blank" };

function parseTemplateBody(text: string): BodyBlock[] {
  if (!text.trim()) return [];
  return text.split("\n").map((line) => {
    const trimmed = line.trim();
    if (!trimmed) return { kind: "blank" } as const;
    const headingMatch = /^\*\*(.+?)\*\*\s*:?\s*$/.exec(trimmed);
    if (headingMatch) return { kind: "heading", text: headingMatch[1].trim() };
    return { kind: "para", text: line };
  });
}

function NoticePreview({
  ref, brand, groups,
}: {
  ref?: React.Ref<HTMLDivElement>;
  brand: string;
  groups: EditableGroup[];
}) {
  return (
    <div
      ref={ref}
      style={{
        width: 640,
        background: "linear-gradient(180deg, #1f3a4d 0%, #163040 100%)",
        color: "#fefcf7",
        padding: "28px 28px 24px",
        fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
        fontSize: 13.5,
        lineHeight: 1.55,
        borderRadius: 12,
      }}
    >
      <div style={{ textAlign: "center", paddingBottom: 14, borderBottom: "1px solid rgba(255,255,255,0.18)" }}>
        <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: 1.5 }}>{brand}</div>
        <div style={{ marginTop: 4, fontSize: 12.5, opacity: 0.85 }}>
          THÔNG BÁO PHÒNG TRỐNG
        </div>
      </div>

      {groups.map((g, gi) => {
        const bodyBlocks = parseTemplateBody(g.body);
        return (
          <div key={g.buildingId} style={{ marginTop: gi === 0 ? 16 : 22 }}>
            <div style={{ textAlign: "center", marginBottom: 12 }}>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{g.title}</div>
              <div style={{ fontSize: 12.5, opacity: 0.9 }}>{g.address}</div>
            </div>

            {/* Rooms — stacked cards */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {g.rooms.map((r) => {
                const rentVND = r.rent ? formatVND(parseVNDInput(r.rent)) : "";
                return (
                  <div
                    key={r.id}
                    style={{
                      padding: "10px 14px",
                      background: "rgba(255,255,255,0.07)",
                      border: "1px solid rgba(255,255,255,0.15)",
                      borderRadius: 8,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 16, flexWrap: "wrap" }}>
                      <div style={{ fontWeight: 700, fontSize: 14.5 }}>Phòng {r.number}</div>
                      {rentVND && (
                        <div style={{ fontWeight: 700, fontSize: 14.5, color: "#ffd47a" }}>{rentVND}/tháng</div>
                      )}
                    </div>
                    {r.info && (
                      <div style={{ marginTop: 4, fontSize: 12.5, opacity: 0.92, whiteSpace: "pre-line" }}>{r.info}</div>
                    )}
                    {r.notes && (
                      <div style={{ marginTop: 4, fontSize: 12, fontStyle: "italic", color: "#ffd47a" }}>{r.notes}</div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Body — building info */}
            {bodyBlocks.length > 0 && (
              <div style={{ marginTop: 14 }}>
                {bodyBlocks.map((b, i) => {
                  if (b.kind === "blank") return <div key={i} style={{ height: 6 }} />;
                  if (b.kind === "heading") {
                    return (
                      <div
                        key={i}
                        style={{
                          fontWeight: 700,
                          fontSize: 13.5,
                          marginTop: i === 0 ? 0 : 10,
                          marginBottom: 4,
                          color: "#ffd47a",
                        }}
                      >
                        {b.text}
                      </div>
                    );
                  }
                  return (
                    <div key={i} style={{ fontSize: 12.5 }}>{b.text}</div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
