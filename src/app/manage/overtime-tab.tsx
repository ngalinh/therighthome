"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/ui/empty";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Edit, Trash2, DollarSign, Loader2, Clock } from "lucide-react";
import { toast } from "sonner";
import { formatVND, formatNumber, parseVNDInput, formatDateVN } from "@/lib/utils";
import { ExportExcelButton } from "@/components/ui/export-button";

type BuildingLite = { id: string; name: string; type: "CHDV" | "VP" };
type RoomLite = { id: string; buildingId: string; number: string };

type Overtime = {
  id: string;
  buildingId: string;
  roomId: string | null;
  date: string;
  startTime: string;
  endTime: string;
  fee: string;
  notes: string | null;
  invoiceId: string | null;
  building: { id: string; name: string; type: "CHDV" | "VP" };
  room: { id: string; number: string } | null;
  invoice: { id: string; code: string } | null;
};

export function ManageOvertimeTab({
  buildings, rooms, overtimes,
}: {
  buildings: BuildingLite[];
  rooms: RoomLite[];
  overtimes: Overtime[];
}) {
  const [editing, setEditing] = useState<Overtime | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold flex items-center gap-2">
          <Clock className="h-4 w-4" /> {overtimes.length} đăng ký
        </h2>
        <div className="flex gap-2">
          <ExportExcelButton
            filename="lam-ngoai-gio.xlsx"
            sheets={() => [{
              name: "Ngoai gio",
              rows: overtimes.map((o) => ({
                "Ngày": formatDateVN(o.date),
                "Toà nhà": o.building.name,
                "Phòng": o.room?.number ?? "",
                "Giờ bắt đầu": o.startTime,
                "Giờ kết thúc": o.endTime,
                "Phí": Number(o.fee),
                "Hoá đơn": o.invoice?.code ?? "",
                "Ghi chú": o.notes ?? "",
              })),
            }]}
          />
          <Button variant="gradient" size="sm" onClick={() => setCreating(true)} disabled={buildings.length === 0}>
            <Plus className="h-4 w-4" /> Đăng ký
          </Button>
        </div>
      </div>

      {overtimes.length === 0 ? (
        <EmptyState icon={Clock} title="Chưa có đăng ký nào" description="Bấm “Đăng ký” để tạo mới." />
      ) : (
        <>
          {/* Mobile cards */}
          <div className="space-y-2 lg:hidden">
            {overtimes.map((o) => (
              <OtCard key={o.id} ot={o} onEdit={() => setEditing(o)} />
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden lg:block rounded-2xl border border-slate-200 bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                <tr>
                  <th className="text-left px-3 py-2.5">Ngày</th>
                  <th className="text-left px-3 py-2.5">Toà nhà</th>
                  <th className="text-left px-3 py-2.5">Phòng</th>
                  <th className="text-left px-3 py-2.5">Giờ</th>
                  <th className="text-right px-3 py-2.5">Phí</th>
                  <th className="text-left px-3 py-2.5">Hoá đơn</th>
                  <th className="text-right px-3 py-2.5">Hành động</th>
                </tr>
              </thead>
              <tbody>
                {overtimes.map((o) => (
                  <OtRow key={o.id} ot={o} onEdit={() => setEditing(o)} />
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {creating && (
        <OtDialog mode="create" buildings={buildings} rooms={rooms} onClose={() => setCreating(false)} />
      )}
      {editing && (
        <OtDialog mode="edit" ot={editing} buildings={buildings} rooms={rooms} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}

function OtCard({ ot, onEdit }: { ot: Overtime; onEdit: () => void }) {
  return (
    <Card>
      <CardContent className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="font-medium text-sm truncate">
              {ot.building.name}{ot.room ? ` · Phòng ${ot.room.number}` : ""}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              {formatDateVN(ot.date)} · {ot.startTime} - {ot.endTime}
            </div>
          </div>
          {ot.invoice && <Badge variant="success" className="text-[10px]">Đã ghi {ot.invoice.code}</Badge>}
        </div>
        {ot.notes && <div className="text-xs text-slate-500 line-clamp-2">{ot.notes}</div>}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          <div className="font-semibold text-sm">{formatVND(BigInt(ot.fee))}</div>
          <OtActions ot={ot} onEdit={onEdit} />
        </div>
      </CardContent>
    </Card>
  );
}

function OtRow({ ot, onEdit }: { ot: Overtime; onEdit: () => void }) {
  return (
    <tr className="border-t border-slate-100 hover:bg-slate-50/60">
      <td className="px-3 py-2.5 whitespace-nowrap">{formatDateVN(ot.date)}</td>
      <td className="px-3 py-2.5 truncate max-w-[180px]">{ot.building.name}</td>
      <td className="px-3 py-2.5">{ot.room?.number ?? "—"}</td>
      <td className="px-3 py-2.5 whitespace-nowrap">{ot.startTime} - {ot.endTime}</td>
      <td className="px-3 py-2.5 text-right whitespace-nowrap">{formatVND(BigInt(ot.fee))}</td>
      <td className="px-3 py-2.5 text-xs">
        {ot.invoice ? (
          <Badge variant="success" className="text-[10px]">{ot.invoice.code}</Badge>
        ) : <span className="text-slate-400">Chưa ghi</span>}
      </td>
      <td className="px-3 py-2.5 text-right">
        <OtActions ot={ot} onEdit={onEdit} />
      </td>
    </tr>
  );
}

function OtActions({ ot, onEdit }: { ot: Overtime; onEdit: () => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function pay() {
    if (ot.invoiceId) return toast.info("Đã ghi vào hoá đơn rồi");
    if (!confirm(`Cộng phí ${formatVND(BigInt(ot.fee))} vào hoá đơn tháng này?`)) return;
    setBusy(true);
    const res = await fetch(`/api/overtime-requests/${ot.id}/invoice`, { method: "POST" });
    setBusy(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return toast.error(err.error || "Không ghi được vào hoá đơn");
    }
    const { invoiceCode } = await res.json();
    toast.success(`Đã cộng vào hoá đơn ${invoiceCode}`);
    router.refresh();
  }

  async function del() {
    if (!confirm("Xoá đăng ký này?")) return;
    setBusy(true);
    const res = await fetch(`/api/overtime-requests/${ot.id}`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) return toast.error("Xoá thất bại");
    toast.success("Đã xoá");
    router.refresh();
  }

  return (
    <div className="flex items-center justify-end gap-1.5">
      <Button size="sm" variant="outline" onClick={onEdit}><Edit className="h-3.5 w-3.5" /></Button>
      <Button size="sm" variant="outline" onClick={del} disabled={busy}><Trash2 className="h-3.5 w-3.5" /></Button>
      <Button size="sm" variant={ot.invoiceId ? "ghost" : "gradient"} onClick={pay} disabled={busy || !!ot.invoiceId}>
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <DollarSign className="h-3.5 w-3.5" />}
      </Button>
    </div>
  );
}

function OtDialog({
  mode, ot, buildings, rooms, onClose,
}: {
  mode: "create" | "edit";
  ot?: Overtime;
  buildings: BuildingLite[];
  rooms: RoomLite[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [date, setDate] = useState(ot ? ot.date.slice(0, 10) : new Date().toISOString().slice(0, 10));
  const [buildingId, setBuildingId] = useState<string>(ot?.buildingId ?? buildings[0]?.id ?? "");
  const [roomId, setRoomId] = useState<string>(ot?.roomId ?? "");
  const [startTime, setStartTime] = useState(ot?.startTime ?? "18:00");
  const [endTime, setEndTime] = useState(ot?.endTime ?? "20:00");
  const [fee, setFee] = useState(ot?.fee ?? "0");
  const [notes, setNotes] = useState(ot?.notes ?? "");
  const [saving, setSaving] = useState(false);

  const filteredRooms = useMemo(
    () => rooms.filter((r) => r.buildingId === buildingId),
    [rooms, buildingId],
  );

  async function save() {
    if (!buildingId) return toast.error("Chọn toà nhà");
    if (!startTime || !endTime) return toast.error("Nhập giờ");
    setSaving(true);
    const body = {
      buildingId,
      roomId: roomId || null,
      date,
      startTime,
      endTime,
      fee: parseVNDInput(fee).toString(),
      notes: notes || null,
    };
    const res = await fetch(
      mode === "create" ? "/api/overtime-requests" : `/api/overtime-requests/${ot!.id}`,
      {
        method: mode === "create" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    setSaving(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return toast.error(err.error || "Lưu thất bại");
    }
    toast.success("Đã lưu");
    onClose();
    router.refresh();
  }

  const feeDisplay = fee ? formatNumber(parseVNDInput(fee)) : "";

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Đăng ký làm ngoài giờ" : "Sửa đăng ký"}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Toà nhà</Label>
            <Select value={buildingId} onValueChange={(v) => { setBuildingId(v); setRoomId(""); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {buildings.map((b) => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Phòng</Label>
            <Select value={roomId || "_none"} onValueChange={(v) => setRoomId(v === "_none" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">— Không gắn phòng —</SelectItem>
                {filteredRooms.map((r) => (
                  <SelectItem key={r.id} value={r.id}>Phòng {r.number}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Ngày</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Phí ngoài giờ (₫)</Label>
            <Input value={feeDisplay} inputMode="numeric" onChange={(e) => setFee(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Giờ bắt đầu</Label>
            <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Giờ kết thúc</Label>
            <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
          </div>
          <div className="space-y-1 col-span-2">
            <Label className="text-xs">Ghi chú</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Huỷ</Button>
          <Button variant="gradient" onClick={save} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Lưu
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
