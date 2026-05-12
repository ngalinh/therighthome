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

export function VacancyNoticeDialog({
  building, room, onClose,
}: {
  building: Building;
  room: VacantRoom;
  onClose: () => void;
}) {
  const [title, setTitle] = useState("THE RIGHT HOME");
  const [address, setAddress] = useState(building.address);
  const [roomNumber, setRoomNumber] = useState(formatRoomNumber(room.number));
  const [expectedRent, setExpectedRent] = useState(room.expectedRent ?? "");
  const [roomInfo, setRoomInfo] = useState(room.info ?? "");
  const [vacancyNotes, setVacancyNotes] = useState(room.vacancyNotes ?? "");
  const [body, setBody] = useState(building.info ?? "");
  const [exporting, setExporting] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  const rentDisplay = expectedRent ? formatNumber(parseVNDInput(expectedRent)) : "";
  const rentVND = expectedRent ? formatVND(parseVNDInput(expectedRent)) : "";

  const bodyBlocks = useMemo(() => parseTemplateBody(body), [body]);

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

  async function download() {
    setExporting(true);
    try {
      const blob = await generateBlob();
      if (!blob) throw new Error("Không tạo được hình");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `thong-bao-${building.name}-P${room.number}.png`;
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
      const file = new File([blob], `thong-bao-${building.name}-P${room.number}.png`, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `Phòng trống — ${building.name}` });
      } else {
        await download();
      }
    } catch (e) {
      // Sharing cancelled is not an error.
      if (e instanceof Error && e.name === "AbortError") return;
      toast.error(e instanceof Error ? e.message : "Lỗi chia sẻ");
    } finally {
      setExporting(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Thông báo phòng trống — {building.name} · Phòng {room.number}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Editor */}
          <div className="space-y-3 text-sm">
            <p className="text-xs text-slate-500">
              Chỉnh nội dung bên dưới rồi bấm "Tải hình" để xuất ảnh gửi môi giới. Mỗi dòng bắt đầu bằng <code>**Heading**</code> sẽ in đậm trong mẫu.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Tiêu đề</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Phòng</Label>
                <Input value={roomNumber} onChange={(e) => setRoomNumber(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Địa chỉ</Label>
              <Input value={address} onChange={(e) => setAddress(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Giá thuê dự kiến (₫)</Label>
                <Input
                  inputMode="numeric"
                  value={rentDisplay}
                  onChange={(e) => setExpectedRent(e.target.value)}
                  placeholder="—"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Ghi chú phòng</Label>
                <Input value={vacancyNotes} onChange={(e) => setVacancyNotes(e.target.value)} placeholder="vd: dọn vào tháng 6" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Thông tin phòng</Label>
              <Textarea
                value={roomInfo}
                onChange={(e) => setRoomInfo(e.target.value)}
                rows={3}
                placeholder="vd: 25m², ban công, hướng Đông Nam"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Nội dung chung</Label>
              <Textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={16}
                className="font-mono text-[12px]"
                placeholder="Mỗi dòng một mục. Dùng **...** để in đậm tiêu đề."
              />
              <p className="text-[11px] text-slate-500">
                Mặc định lấy từ trường "Thông tin chung" của toà nhà (Cài đặt chung &gt; Toà nhà).
              </p>
            </div>
          </div>

          {/* Preview (also the export target) */}
          <div className="lg:sticky lg:top-0 lg:self-start">
            <div className="text-[11px] text-slate-500 mb-1.5">Xem trước · Tỷ lệ thật khi xuất hình</div>
            <div className="overflow-x-auto -mx-1 px-1">
              <div className="inline-block min-w-[640px]">
                <NoticePreview
                  ref={previewRef}
                  title={title}
                  address={address}
                  roomNumber={roomNumber}
                  rentVND={rentVND}
                  roomInfo={roomInfo}
                  vacancyNotes={vacancyNotes}
                  bodyBlocks={bodyBlocks}
                />
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
  ref, title, address, roomNumber, rentVND, roomInfo, vacancyNotes, bodyBlocks,
}: {
  ref?: React.Ref<HTMLDivElement>;
  title: string;
  address: string;
  roomNumber: string;
  rentVND: string;
  roomInfo: string;
  vacancyNotes: string;
  bodyBlocks: BodyBlock[];
}) {
  // Inline styles only — html2canvas-pro needs concrete values; Tailwind
  // classes work but using inline keeps the captured layout deterministic
  // regardless of viewport.
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
      {/* Header */}
      <div style={{ textAlign: "center", paddingBottom: 14, borderBottom: "1px solid rgba(255,255,255,0.18)" }}>
        <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: 1.5 }}>{title}</div>
        <div style={{ marginTop: 4, fontSize: 13, opacity: 0.92 }}>{address}</div>
      </div>

      {/* Room highlight */}
      <div
        style={{
          marginTop: 14,
          padding: "12px 14px",
          background: "rgba(255,255,255,0.07)",
          border: "1px solid rgba(255,255,255,0.15)",
          borderRadius: 8,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 16, flexWrap: "wrap" }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>Phòng {roomNumber}</div>
          {rentVND && (
            <div style={{ fontWeight: 700, fontSize: 15, color: "#ffd47a" }}>
              {rentVND}/tháng
            </div>
          )}
        </div>
        {roomInfo && (
          <div style={{ marginTop: 6, fontSize: 12.5, opacity: 0.92, whiteSpace: "pre-line" }}>{roomInfo}</div>
        )}
        {vacancyNotes && (
          <div style={{ marginTop: 6, fontSize: 12, fontStyle: "italic", color: "#ffd47a" }}>{vacancyNotes}</div>
        )}
      </div>

      {/* Body */}
      <div style={{ marginTop: 14 }}>
        {bodyBlocks.length === 0 ? (
          <p style={{ opacity: 0.7, fontSize: 12.5 }}>
            (Chưa có nội dung chung. Cập nhật ở Cài đặt chung &gt; Toà nhà hoặc gõ trực tiếp ở ô bên trái.)
          </p>
        ) : (
          bodyBlocks.map((b, i) => {
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
              <div key={i} style={{ fontSize: 12.5 }}>
                {b.text}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
