"use client";
import { useState } from "react";
import { Plus, Trash2, Loader2, Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn, roomFloor, compareRooms } from "@/lib/utils";

type Room = {
  id: string;
  number: string;
  status: "AVAILABLE" | "OCCUPIED" | "MAINTENANCE";
  info: string | null;
  customerName: string | null;
  daysLeft: number | null;
  contractId: string | null;
};

export function RoomsManager({
  buildingId,
  canWrite,
  rooms,
}: {
  buildingId: string;
  canWrite: boolean;
  rooms: Room[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [addInfo, setAddInfo] = useState("");
  const [editing, setEditing] = useState<Room | null>(null);

  async function addRooms(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const raw = String(fd.get("numbers") || "");
    const numbers = raw.split(/[,\s\n]+/).map((s) => s.trim()).filter(Boolean);
    if (numbers.length === 0) {
      toast.error("Nhập ít nhất 1 số phòng");
      setLoading(false);
      return;
    }
    const res = await fetch(`/api/buildings/${buildingId}/rooms`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ numbers, info: addInfo.trim() || undefined }),
    });
    setLoading(false);
    if (!res.ok) {
      toast.error("Có lỗi xảy ra");
      return;
    }
    const { count } = await res.json();
    toast.success(`Đã thêm ${count} phòng`);
    setAddInfo("");
    setOpen(false);
    router.refresh();
  }

  async function deleteRoom(roomId: string, number: string) {
    if (!confirm(`Xoá phòng ${number}?`)) return;
    const res = await fetch(`/api/buildings/${buildingId}/rooms/${roomId}`, { method: "DELETE" });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toast.error(err.error || "Có lỗi xảy ra");
      return;
    }
    toast.success("Đã xoá phòng");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {canWrite && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Plus className="h-4 w-4" /> Thêm phòng
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Thêm phòng mới</DialogTitle>
            </DialogHeader>
            <form onSubmit={addRooms} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="numbers">Số phòng</Label>
                <Input id="numbers" name="numbers" placeholder="vd: 101, 102, 103" />
                <p className="text-xs text-slate-500">Cách nhau bằng dấu phẩy hoặc xuống dòng. Phòng trùng sẽ bị bỏ qua.</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="info">Thông tin (tuỳ chọn)</Label>
                <Textarea
                  id="info"
                  value={addInfo}
                  onChange={(e) => setAddInfo(e.target.value)}
                  rows={4}
                  placeholder="Mô tả phòng, nội thất, ghi chú… Áp dụng cho tất cả phòng vừa thêm."
                />
              </div>
              <DialogFooter>
                <Button type="submit" variant="gradient" disabled={loading}>
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                  Thêm
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {rooms.length === 0 ? (
        <p className="text-sm text-slate-500 text-center py-8">Chưa có phòng nào. {canWrite && "Bấm Thêm phòng để bắt đầu."}</p>
      ) : (
        <FloorGroupedRooms
          rooms={rooms}
          buildingId={buildingId}
          canWrite={canWrite}
          onDelete={(r) => deleteRoom(r.id, r.number)}
          onEdit={(r) => setEditing(r)}
        />
      )}

      <EditRoomDialog
        key={editing?.id ?? "none"}
        room={editing}
        buildingId={buildingId}
        onClose={() => setEditing(null)}
      />
    </div>
  );
}

function FloorGroupedRooms({
  rooms, buildingId, canWrite, onDelete, onEdit,
}: {
  rooms: Room[];
  buildingId: string;
  canWrite: boolean;
  onDelete: (r: Room) => void;
  onEdit: (r: Room) => void;
}) {
  // Bucket rooms by floor; floor "G" first, then numeric ascending.
  const byFloor = new Map<string, Room[]>();
  for (const r of rooms) {
    const f = roomFloor(r.number);
    if (!byFloor.has(f)) byFloor.set(f, []);
    byFloor.get(f)!.push(r);
  }
  const floors = Array.from(byFloor.keys()).sort((a, b) => {
    if (a === "G") return -1;
    if (b === "G") return 1;
    return Number(a) - Number(b);
  });
  for (const f of floors) byFloor.get(f)!.sort((a, b) => compareRooms(a.number, b.number));

  return (
    <div className="space-y-3">
      {floors.map((f) => (
        <div key={f} className="flex items-start gap-3">
          <div className="w-6 shrink-0 pt-3 text-xs font-semibold text-slate-400 text-right">
            {f === "G" ? "G" : `L${f}`}
          </div>
          <div className="flex-1 grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-2">
            {byFloor.get(f)!.map((r) => (
              <RoomTile
                key={r.id}
                room={r}
                buildingId={buildingId}
                canWrite={canWrite}
                onDelete={() => onDelete(r)}
                onEdit={() => onEdit(r)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function RoomTile({
  room, buildingId, canWrite, onDelete, onEdit,
}: {
  room: Room; buildingId: string; canWrite: boolean; onDelete: () => void; onEdit: () => void;
}) {
  const isExpiring = room.daysLeft !== null && room.daysLeft <= 30;

  const styles = {
    OCCUPIED: isExpiring
      ? { card: "bg-amber-50 border-amber-200", dot: "bg-amber-400", text: "text-amber-800", accent: "bg-amber-400" }
      : { card: "bg-slate-100 border-slate-200", dot: "bg-slate-400", text: "text-slate-700", accent: "bg-slate-400" },
    MAINTENANCE: { card: "bg-slate-100 border-slate-200", dot: "bg-slate-400", text: "text-slate-600", accent: "bg-slate-400" },
    AVAILABLE: { card: "bg-emerald-50 border-emerald-200", dot: "bg-emerald-400", text: "text-emerald-800", accent: "bg-emerald-400" },
  };
  const s = styles[room.status] ?? styles.AVAILABLE;
  // If the room has an active contract, click → contract detail. Otherwise →
  // contracts list with room filter (so the user can create one).
  const href = room.contractId
    ? `/buildings/${buildingId}/contracts/${room.contractId}/edit`
    : `/buildings/${buildingId}/contracts?room=${room.id}`;

  return (
    <div className={cn("relative rounded-xl border p-3 group", s.card)}>
      <Link href={href} className="block">
        <div className="flex items-center justify-between mb-1.5">
          <span className="font-bold text-sm text-slate-900">{room.number}</span>
          <span className={cn("h-2 w-2 rounded-full shrink-0", s.dot)} />
        </div>
        {room.customerName ? (
          <div className={cn("text-[11px] truncate font-medium", s.text)} title={room.customerName}>{room.customerName}</div>
        ) : (
          <div className="text-[11px] text-slate-500">Trống</div>
        )}
        {room.daysLeft !== null && room.daysLeft <= 30 && (
          <div className="text-[10px] mt-1.5 text-amber-700 font-semibold bg-amber-100 rounded-md px-1.5 py-0.5 inline-block">
            {room.daysLeft <= 0 ? "Hết hạn" : `Còn ${room.daysLeft}d`}
          </div>
        )}
      </Link>
      {canWrite && (
        <div className="absolute -top-1.5 -right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onEdit}
            className="h-5 w-5 rounded-full bg-white shadow border border-slate-200 flex items-center justify-center"
            aria-label="Sửa phòng"
          >
            <Pencil className="h-2.5 w-2.5 text-slate-500" />
          </button>
          {room.status !== "OCCUPIED" && (
            <button
              onClick={onDelete}
              className="h-5 w-5 rounded-full bg-white shadow border border-slate-200 flex items-center justify-center"
              aria-label="Xoá phòng"
            >
              <Trash2 className="h-3 w-3 text-slate-500" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function EditRoomDialog({
  room, buildingId, onClose,
}: {
  room: Room | null;
  buildingId: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [number, setNumber] = useState(room?.number ?? "");
  const [info, setInfo] = useState(room?.info ?? "");
  const [status, setStatus] = useState<"AVAILABLE" | "MAINTENANCE" | undefined>(undefined);
  const [loading, setLoading] = useState(false);

  if (!room) return null;

  const canResetStatus = room.status === "OCCUPIED" && !room.contractId;

  async function submit() {
    if (!number.trim()) return toast.error("Số phòng không được để trống");
    setLoading(true);
    const body: Record<string, unknown> = { number: number.trim(), info: info.trim() || null };
    if (canResetStatus && status !== undefined) body.status = status;
    const res = await fetch(`/api/buildings/${buildingId}/rooms/${room!.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setLoading(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return toast.error(err.error || "Có lỗi");
    }
    toast.success("Đã lưu");
    onClose();
    router.refresh();
  }

  return (
    <Dialog open={!!room} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sửa phòng {room.number}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Số phòng</Label>
            <Input value={number} onChange={(e) => setNumber(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Thông tin phòng</Label>
            <Textarea
              value={info}
              onChange={(e) => setInfo(e.target.value)}
              rows={6}
              placeholder="Mô tả nội thất, diện tích, hướng ban công, ghi chú…"
            />
          </div>
          {canResetStatus && (
            <div className="space-y-1.5">
              <Label className="text-xs">Trạng thái phòng</Label>
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2.5 py-1.5">
                Phòng đang ở trạng thái &quot;Đang thuê&quot; nhưng không có hợp đồng. Chọn trạng thái để cập nhật.
              </p>
              <select
                value={status ?? ""}
                onChange={(e) => setStatus(e.target.value ? e.target.value as "AVAILABLE" | "MAINTENANCE" : undefined)}
                className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm bg-white"
              >
                <option value="">-- Giữ nguyên --</option>
                <option value="AVAILABLE">Trống (cho thuê)</option>
                <option value="MAINTENANCE">Đang bảo trì</option>
              </select>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Huỷ</Button>
          <Button variant="gradient" onClick={submit} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Lưu
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
