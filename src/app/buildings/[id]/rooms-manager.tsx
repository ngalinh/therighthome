"use client";
import { useState } from "react";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Room = {
  id: string;
  number: string;
  status: "AVAILABLE" | "OCCUPIED" | "MAINTENANCE";
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
      body: JSON.stringify({ numbers }),
    });
    setLoading(false);
    if (!res.ok) {
      toast.error("Có lỗi xảy ra");
      return;
    }
    const { count } = await res.json();
    toast.success(`Đã thêm ${count} phòng`);
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
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2.5">
          {rooms.map((r) => (
            <RoomTile key={r.id} room={r} buildingId={buildingId} canWrite={canWrite} onDelete={() => deleteRoom(r.id, r.number)} />
          ))}
        </div>
      )}
    </div>
  );
}

function RoomTile({
  room, buildingId, canWrite, onDelete,
}: {
  room: Room; buildingId: string; canWrite: boolean; onDelete: () => void;
}) {
  const isExpiring = room.daysLeft !== null && room.daysLeft <= 30;

  const styles = {
    OCCUPIED: isExpiring
      ? { card: "bg-amber-50 border-amber-200", dot: "bg-amber-400", text: "text-amber-800", accent: "bg-amber-400" }
      : { card: "bg-rose-50 border-rose-200", dot: "bg-rose-400", text: "text-rose-800", accent: "bg-rose-400" },
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
      {canWrite && room.status !== "OCCUPIED" && (
        <button
          onClick={onDelete}
          className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-white shadow border border-slate-200 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
          aria-label="Xoá phòng"
        >
          <Trash2 className="h-3 w-3 text-slate-500" />
        </button>
      )}
    </div>
  );
}
