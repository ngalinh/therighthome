"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/ui/empty";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DoorOpen, Megaphone, Loader2, Save, Check } from "lucide-react";
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
  soonVacantDate: string | null;
};

export function VacantRoomsTab({ buildings, rooms, soonVacantRooms }: { buildings: Building[]; rooms: VacantRoom[]; soonVacantRooms: VacantRoom[] }) {
  const [buildingFilter, setBuildingFilter] = useState<string>("ALL");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [noticeOpen, setNoticeOpen] = useState(false);
  const buildingById = useMemo(() => new Map(buildings.map((b) => [b.id, b])), [buildings]);

  const filteredRooms = useMemo(
    () => rooms.filter((r) => buildingFilter === "ALL" || r.buildingId === buildingFilter),
    [rooms, buildingFilter],
  );

  const filteredSoonVacant = useMemo(
    () => soonVacantRooms.filter((r) => buildingFilter === "ALL" || r.buildingId === buildingFilter),
    [soonVacantRooms, buildingFilter],
  );

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === filteredRooms.length) setSelected(new Set());
    else setSelected(new Set(filteredRooms.map((r) => r.id)));
  }

  const selectedRooms = useMemo(
    () => rooms.filter((r) => selected.has(r.id)),
    [rooms, selected],
  );

  // Group selected rooms by building for the notice dialog.
  const noticeGroups = useMemo(() => {
    const groups = new Map<string, { building: Building; rooms: VacantRoom[] }>();
    for (const r of selectedRooms) {
      const b = buildingById.get(r.buildingId);
      if (!b) continue;
      const g = groups.get(b.id) ?? { building: b, rooms: [] };
      g.rooms.push(r);
      groups.set(b.id, g);
    }
    return Array.from(groups.values());
  }, [selectedRooms, buildingById]);

  const allSelected = filteredRooms.length > 0 && selected.size === filteredRooms.length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="text-base font-semibold flex items-center gap-2">
          <DoorOpen className="h-4 w-4" /> {filteredRooms.length} phòng trống
        </h2>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={buildingFilter} onValueChange={setBuildingFilter}>
            <SelectTrigger className="w-[200px]"><SelectValue placeholder="Toà nhà" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Tất cả toà nhà</SelectItem>
              {buildings.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button
            variant="gradient"
            size="sm"
            onClick={() => setNoticeOpen(true)}
            disabled={selected.size === 0}
          >
            <Megaphone className="h-4 w-4" /> Thông báo {selected.size > 0 && `(${selected.size})`}
          </Button>
        </div>
      </div>

      {filteredSoonVacant.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-orange-700 flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-full bg-orange-400" />
            {filteredSoonVacant.length} phòng sắp trống (trong 14 ngày tới)
          </h3>
          {/* Mobile cards */}
          <div className="space-y-2 lg:hidden">
            {filteredSoonVacant.map((r) => {
              const b = buildingById.get(r.buildingId);
              if (!b) return null;
              return <SoonVacantCard key={r.id} building={b} room={r} />;
            })}
          </div>
          {/* Desktop table */}
          <div className="hidden lg:block rounded-2xl border border-orange-200 bg-orange-50/30 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-orange-50 text-orange-700 text-xs uppercase">
                <tr>
                  <th className="text-left px-3 py-2.5">Toà nhà</th>
                  <th className="text-left px-3 py-2.5">Số phòng</th>
                  <th className="text-left px-3 py-2.5 min-w-[180px]">Thông tin phòng</th>
                  <th className="text-right px-3 py-2.5 whitespace-nowrap">Giá thuê hiện tại</th>
                  <th className="text-left px-3 py-2.5">Hết hạn HĐ</th>
                </tr>
              </thead>
              <tbody>
                {filteredSoonVacant.map((r) => {
                  const b = buildingById.get(r.buildingId);
                  if (!b) return null;
                  return <SoonVacantRow key={r.id} building={b} room={r} />;
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {filteredRooms.length === 0 && filteredSoonVacant.length === 0 ? (
        <EmptyState icon={DoorOpen} title="Không có phòng trống" description="Tất cả phòng đang có hợp đồng đang hoạt động." />
      ) : filteredRooms.length === 0 ? null : (
        <>
          {/* Mobile cards */}
          <div className="space-y-2 lg:hidden">
            <label className="flex items-center gap-2 px-1 py-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleAll}
                aria-label="Chọn tất cả phòng trống"
                className="rounded h-4 w-4"
              />
              <span>{allSelected ? "Bỏ chọn tất cả" : "Chọn tất cả"} ({filteredRooms.length})</span>
            </label>
            {filteredRooms.map((r) => {
              const b = buildingById.get(r.buildingId);
              if (!b) return null;
              return (
                <VacantRoomCard
                  key={r.id}
                  building={b}
                  room={r}
                  selected={selected.has(r.id)}
                  onToggle={() => toggle(r.id)}
                />
              );
            })}
          </div>

          {/* Desktop table */}
          <div className="hidden lg:block rounded-2xl border border-slate-200 bg-white overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                <tr>
                  <th className="px-3 py-2.5 w-10">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAll}
                      aria-label="Chọn tất cả"
                      className="rounded"
                    />
                  </th>
                  <th className="text-left px-3 py-2.5">Toà nhà</th>
                  <th className="text-left px-3 py-2.5">Thông tin toà nhà</th>
                  <th className="text-left px-3 py-2.5">Số phòng</th>
                  <th className="text-left px-3 py-2.5 min-w-[180px]">Thông tin phòng</th>
                  <th className="text-right px-3 py-2.5 whitespace-nowrap">Giá thuê trước</th>
                  <th className="text-right px-3 py-2.5 whitespace-nowrap">Giá thuê dự kiến</th>
                  <th className="text-left px-3 py-2.5 min-w-[180px]">Ghi chú</th>
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
                      selected={selected.has(r.id)}
                      onToggle={() => toggle(r.id)}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {noticeOpen && noticeGroups.length > 0 && (
        <VacancyNoticeDialog groups={noticeGroups} onClose={() => setNoticeOpen(false)} />
      )}
    </div>
  );
}

function VacantRoomRow({
  building, room, selected, onToggle,
}: {
  building: Building;
  room: VacantRoom;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <tr className={`border-t border-slate-100 align-top ${selected ? "bg-amber-50/60" : "hover:bg-slate-50/60"}`}>
      <td className="px-3 py-2.5">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          aria-label={`Chọn phòng ${room.number}`}
          className="rounded"
        />
      </td>
      <td className="px-3 py-2.5 whitespace-nowrap font-medium">{building.name}</td>
      <td className="px-3 py-2.5 text-xs text-slate-600 max-w-[200px]" title={building.info ?? undefined}>
        <div className="line-clamp-3 whitespace-pre-line">{building.info || <span className="text-slate-400">—</span>}</div>
      </td>
      <td className="px-3 py-2.5 whitespace-nowrap font-semibold">{formatRoomNumber(room.number)}</td>
      <td className="px-3 py-2.5 text-xs text-slate-600" title={room.info ?? undefined}>
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
    </tr>
  );
}

function VacantRoomCard({
  building, room, selected, onToggle,
}: {
  building: Building;
  room: VacantRoom;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <Card className={selected ? "ring-2 ring-amber-300" : undefined}>
      <CardContent className="p-4 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <input
              type="checkbox"
              checked={selected}
              onChange={onToggle}
              aria-label={`Chọn phòng ${room.number}`}
              className="rounded"
            />
            <div className="min-w-0">
              <div className="font-semibold text-sm">{building.name} · Phòng {room.number}</div>
              <div className="text-xs text-slate-500">{building.address}</div>
            </div>
          </div>
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
  const [savedFlash, setSavedFlash] = useState(false);
  const initial = value ?? "";
  const dirty = raw !== initial;

  async function save() {
    if (!dirty) return;
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
      return;
    }
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1500);
    router.refresh();
  }

  const display = raw ? formatNumber(parseVNDInput(raw)) : "";
  return (
    <div className="relative inline-block">
      <Input
        inputMode="numeric"
        value={display}
        onChange={(e) => setRaw(e.target.value)}
        className="h-8 w-32 pr-8 text-right tabular-nums"
        placeholder="—"
      />
      <button
        type="button"
        onClick={save}
        disabled={!dirty || saving}
        className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 inline-flex items-center justify-center rounded text-slate-400 hover:text-primary hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-slate-400"
        aria-label="Lưu"
      >
        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : savedFlash ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Save className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}

function VacancyNotesInput({ roomId, buildingId, value }: { roomId: string; buildingId: string; value: string | null }) {
  const router = useRouter();
  const [raw, setRaw] = useState<string>(value ?? "");
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const initial = value ?? "";
  const dirty = raw !== initial;

  async function save() {
    if (!dirty) return;
    setSaving(true);
    const res = await fetch(`/api/buildings/${buildingId}/rooms/${roomId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vacancyNotes: raw.trim() || null }),
    });
    setSaving(false);
    if (!res.ok) {
      toast.error("Lưu thất bại");
      return;
    }
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1500);
    router.refresh();
  }

  return (
    <div className="relative">
      <Textarea
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        rows={2}
        title={raw || undefined}
        className="text-xs pr-8 resize-none min-h-[52px]"
      />
      <button
        type="button"
        onClick={save}
        disabled={!dirty || saving}
        className="absolute right-1 top-1 h-6 w-6 inline-flex items-center justify-center rounded text-slate-400 hover:text-primary hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-slate-400"
        aria-label="Lưu"
      >
        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : savedFlash ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Save className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}

function daysUntil(isoDate: string): number {
  const end = new Date(isoDate);
  end.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((end.getTime() - today.getTime()) / 86400000);
}

function SoonVacantRow({ building, room }: { building: Building; room: VacantRoom }) {
  const days = room.soonVacantDate ? daysUntil(room.soonVacantDate) : null;
  const endLabel = room.soonVacantDate
    ? new Date(room.soonVacantDate).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" })
    : "—";
  const badgeColor = days !== null && days <= 3 ? "bg-red-100 text-red-700" : days !== null && days <= 7 ? "bg-orange-100 text-orange-700" : "bg-yellow-100 text-yellow-700";
  return (
    <tr className="border-t border-orange-100 align-top hover:bg-orange-50/40">
      <td className="px-3 py-2.5 whitespace-nowrap font-medium">{building.name}</td>
      <td className="px-3 py-2.5 whitespace-nowrap font-semibold">{formatRoomNumber(room.number)}</td>
      <td className="px-3 py-2.5 text-xs text-slate-600">
        <div className="line-clamp-3 whitespace-pre-line">{room.info || <span className="text-slate-400">—</span>}</div>
      </td>
      <td className="px-3 py-2.5 text-right whitespace-nowrap text-slate-600">
        {room.previousRent ? formatVND(BigInt(room.previousRent)) : <span className="text-slate-400">—</span>}
      </td>
      <td className="px-3 py-2.5">
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${badgeColor}`}>
          {endLabel}{days !== null ? ` · còn ${days}d` : ""}
        </span>
      </td>
    </tr>
  );
}

function SoonVacantCard({ building, room }: { building: Building; room: VacantRoom }) {
  const days = room.soonVacantDate ? daysUntil(room.soonVacantDate) : null;
  const endLabel = room.soonVacantDate
    ? new Date(room.soonVacantDate).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" })
    : "—";
  const badgeColor = days !== null && days <= 3 ? "bg-red-100 text-red-700" : days !== null && days <= 7 ? "bg-orange-100 text-orange-700" : "bg-yellow-100 text-yellow-700";
  return (
    <Card className="border-orange-200">
      <CardContent className="p-4 space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <div className="font-semibold text-sm">{building.name} · Phòng {room.number}</div>
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${badgeColor}`}>
            {endLabel}{days !== null ? ` · còn ${days}d` : ""}
          </span>
        </div>
        {room.info && <p className="text-xs text-slate-600 whitespace-pre-line line-clamp-3">{room.info}</p>}
        <div className="text-xs text-slate-500">
          Giá thuê hiện tại: <span className="font-medium text-slate-700">{room.previousRent ? formatVND(BigInt(room.previousRent)) : "—"}</span>
        </div>
      </CardContent>
    </Card>
  );
}
