"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DoorOpen, Megaphone, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { formatVND, formatNumber, parseVNDInput, formatRoomNumber } from "@/lib/utils";
import { VacancyNoticeDialog } from "./vacancy-notice-dialog";

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

export function VacantRoomsTab({ buildings, rooms }: { buildings: Building[]; rooms: VacantRoom[] }) {
  const [buildingFilter, setBuildingFilter] = useState<string>("ALL");
  const [notice, setNotice] = useState<{ building: Building; room: VacantRoom } | null>(null);
  const buildingById = useMemo(() => new Map(buildings.map((b) => [b.id, b])), [buildings]);

  const filteredRooms = useMemo(
    () => rooms.filter((r) => buildingFilter === "ALL" || r.buildingId === buildingFilter),
    [rooms, buildingFilter],
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="text-base font-semibold flex items-center gap-2">
          <DoorOpen className="h-4 w-4" /> {filteredRooms.length} phòng trống
        </h2>
        <Select value={buildingFilter} onValueChange={setBuildingFilter}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Toà nhà" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Tất cả toà nhà</SelectItem>
            {buildings.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {filteredRooms.length === 0 ? (
        <EmptyState icon={DoorOpen} title="Không có phòng trống" description="Tất cả phòng đang có hợp đồng đang hoạt động." />
      ) : (
        <>
          {/* Mobile cards */}
          <div className="space-y-2 lg:hidden">
            {filteredRooms.map((r) => {
              const b = buildingById.get(r.buildingId);
              if (!b) return null;
              return (
                <VacantRoomCard
                  key={r.id}
                  building={b}
                  room={r}
                  onNotice={() => setNotice({ building: b, room: r })}
                />
              );
            })}
          </div>

          {/* Desktop table */}
          <div className="hidden lg:block rounded-2xl border border-slate-200 bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                <tr>
                  <th className="text-left px-3 py-2.5">Toà nhà</th>
                  <th className="text-left px-3 py-2.5">Thông tin toà nhà</th>
                  <th className="text-left px-3 py-2.5">Số phòng</th>
                  <th className="text-left px-3 py-2.5 min-w-[180px]">Thông tin phòng</th>
                  <th className="text-right px-3 py-2.5 whitespace-nowrap">Giá thuê trước</th>
                  <th className="text-right px-3 py-2.5 whitespace-nowrap">Giá thuê dự kiến</th>
                  <th className="text-left px-3 py-2.5 min-w-[160px]">Ghi chú</th>
                  <th className="text-right px-3 py-2.5">Thông báo</th>
                </tr>
              </thead>
              <tbody>
                {filteredRooms.map((r) => {
                  const b = buildingById.get(r.buildingId);
                  if (!b) return null;
                  return (
                    <VacantRoomRow
                      key={r.id}
                      building={b}
                      room={r}
                      onNotice={() => setNotice({ building: b, room: r })}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {notice && (
        <VacancyNoticeDialog
          building={notice.building}
          room={notice.room}
          onClose={() => setNotice(null)}
        />
      )}
    </div>
  );
}

function VacantRoomRow({
  building, room, onNotice,
}: {
  building: Building;
  room: VacantRoom;
  onNotice: () => void;
}) {
  return (
    <tr className="border-t border-slate-100 hover:bg-slate-50/60 align-top">
      <td className="px-3 py-2.5 whitespace-nowrap font-medium">{building.name}</td>
      <td className="px-3 py-2.5 text-xs text-slate-600 max-w-[200px]">
        <div className="line-clamp-3 whitespace-pre-line">{building.info || <span className="text-slate-400">—</span>}</div>
      </td>
      <td className="px-3 py-2.5 whitespace-nowrap font-semibold">{formatRoomNumber(room.number)}</td>
      <td className="px-3 py-2.5 text-xs text-slate-600">
        <div className="line-clamp-3 whitespace-pre-line">{room.info || <span className="text-slate-400">—</span>}</div>
      </td>
      <td className="px-3 py-2.5 text-right whitespace-nowrap text-slate-600">
        {room.previousRent ? formatVND(BigInt(room.previousRent)) : <span className="text-slate-400">—</span>}
      </td>
      <td className="px-3 py-2.5 text-right whitespace-nowrap">
        <ExpectedRentInput roomId={room.id} buildingId={building.id} value={room.expectedRent} />
      </td>
      <td className="px-3 py-2.5">
        <VacancyNotesInput roomId={room.id} buildingId={building.id} value={room.vacancyNotes} />
      </td>
      <td className="px-3 py-2.5 text-right">
        <Button size="sm" variant="outline" onClick={onNotice}>
          <Megaphone className="h-3.5 w-3.5" /> Thông báo
        </Button>
      </td>
    </tr>
  );
}

function VacantRoomCard({
  building, room, onNotice,
}: {
  building: Building;
  room: VacantRoom;
  onNotice: () => void;
}) {
  return (
    <Card>
      <CardContent className="p-4 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="font-semibold text-sm">{building.name} · Phòng {room.number}</div>
            <div className="text-xs text-slate-500">{building.address}</div>
          </div>
          <Button size="sm" variant="outline" onClick={onNotice}>
            <Megaphone className="h-3.5 w-3.5" />
          </Button>
        </div>
        {room.info && <p className="text-xs text-slate-600 whitespace-pre-line line-clamp-4">{room.info}</p>}
        <div className="grid grid-cols-2 gap-2">
          <div className="text-xs">
            <div className="text-slate-500">Giá thuê trước</div>
            <div className="font-medium">{room.previousRent ? formatVND(BigInt(room.previousRent)) : "—"}</div>
          </div>
          <div className="text-xs">
            <div className="text-slate-500 mb-0.5">Giá thuê dự kiến</div>
            <ExpectedRentInput roomId={room.id} buildingId={building.id} value={room.expectedRent} />
          </div>
        </div>
        <div className="text-xs">
          <div className="text-slate-500 mb-0.5">Ghi chú</div>
          <VacancyNotesInput roomId={room.id} buildingId={building.id} value={room.vacancyNotes} />
        </div>
      </CardContent>
    </Card>
  );
}

function ExpectedRentInput({ roomId, buildingId, value }: { roomId: string; buildingId: string; value: string | null }) {
  const router = useRouter();
  const [raw, setRaw] = useState<string>(value ?? "");
  const [saving, setSaving] = useState(false);
  const initial = value ?? "";

  async function save() {
    if (raw === initial) return;
    setSaving(true);
    const parsed = raw.trim() === "" ? null : parseVNDInput(raw).toString();
    const res = await fetch(`/api/buildings/${buildingId}/rooms/${roomId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expectedRent: parsed }),
    });
    setSaving(false);
    if (!res.ok) {
      toast.error("Lưu thất bại");
      setRaw(initial);
      return;
    }
    router.refresh();
  }

  const display = raw ? formatNumber(parseVNDInput(raw)) : "";
  return (
    <div className="flex items-center justify-end gap-1">
      <Input
        inputMode="numeric"
        value={display}
        onChange={(e) => setRaw(e.target.value)}
        onBlur={save}
        className="h-8 w-28 text-right tabular-nums"
        placeholder="—"
      />
      {saving && <Loader2 className="h-3 w-3 animate-spin text-slate-400" />}
    </div>
  );
}

function VacancyNotesInput({ roomId, buildingId, value }: { roomId: string; buildingId: string; value: string | null }) {
  const router = useRouter();
  const [raw, setRaw] = useState<string>(value ?? "");
  const [saving, setSaving] = useState(false);
  const initial = value ?? "";

  async function save() {
    if (raw === initial) return;
    setSaving(true);
    const res = await fetch(`/api/buildings/${buildingId}/rooms/${roomId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vacancyNotes: raw.trim() || null }),
    });
    setSaving(false);
    if (!res.ok) {
      toast.error("Lưu thất bại");
      setRaw(initial);
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex items-center gap-1">
      <Input
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        onBlur={save}
        className="h-8 w-full text-xs"
        placeholder="vd: ưu tiên người thuê dài hạn"
      />
      {saving && <Loader2 className="h-3 w-3 animate-spin text-slate-400" />}
    </div>
  );
}
