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
import { Plus, Edit, Trash2, DollarSign, Loader2, ClipboardList } from "lucide-react";
import { toast } from "sonner";
import { formatVND, formatNumber, parseVNDInput, formatDateVN } from "@/lib/utils";
import { ExportExcelButton } from "@/components/ui/export-button";

type BuildingLite = { id: string; name: string; type: "CHDV" | "VP" };
type RoomLite = { id: string; buildingId: string; number: string };
type PartyLite = { id: string; name: string; kind: string };

type Task = {
  id: string;
  buildingId: string;
  roomId: string | null;
  date: string;
  partyKind: string | null;
  partyId: string | null;
  customerId: string | null;
  taskName: string;
  status: "PENDING" | "DONE";
  cost: string;
  notes: string | null;
  expenseTransactionId: string | null;
  building: { id: string; name: string; type: "CHDV" | "VP" };
  room: { id: string; number: string } | null;
  party: { id: string; name: string; kind: string } | null;
  customer: { id: string; fullName: string | null; companyName: string | null } | null;
};

export function ManageTasksTab({
  kind, buildings, rooms, parties, tasks,
}: {
  kind: "CHDV" | "VP";
  buildings: BuildingLite[];
  rooms: RoomLite[];
  parties: PartyLite[];
  tasks: Task[];
}) {
  const [editing, setEditing] = useState<Task | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold flex items-center gap-2">
          <ClipboardList className="h-4 w-4" /> {tasks.length} công việc
        </h2>
        <div className="flex gap-2">
          <ExportExcelButton
            filename={`cong-viec-${kind.toLowerCase()}.xlsx`}
            sheets={() => [{
              name: `Cong viec ${kind}`,
              rows: tasks.map((t) => ({
                "Ngày": formatDateVN(t.date),
                "Toà nhà": t.building.name,
                "Phòng": t.room?.number ?? "",
                "Đối tượng": t.party?.name ?? "",
                "Công việc": t.taskName,
                "Tình trạng": t.status === "DONE" ? "Hoàn thành" : "Chờ xử lý",
                "Chi phí": Number(t.cost),
                "Đã có phiếu chi": t.expenseTransactionId ? "x" : "",
                "Ghi chú": t.notes ?? "",
              })),
            }]}
          />
          <Button variant="gradient" size="sm" onClick={() => setCreating(true)} disabled={buildings.length === 0}>
            <Plus className="h-4 w-4" /> Thêm công việc
          </Button>
        </div>
      </div>

      {tasks.length === 0 ? (
        <EmptyState icon={ClipboardList} title="Chưa có công việc nào" description="Bấm “Thêm công việc” để tạo mới." />
      ) : (
        <>
          {/* Mobile cards */}
          <div className="space-y-2 lg:hidden">
            {tasks.map((t) => (
              <TaskCard key={t.id} task={t} onEdit={() => setEditing(t)} />
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
                  <th className="text-left px-3 py-2.5">Đối tượng</th>
                  <th className="text-left px-3 py-2.5">Công việc</th>
                  <th className="text-left px-3 py-2.5">Tình trạng</th>
                  <th className="text-right px-3 py-2.5">Chi phí</th>
                  <th className="text-right px-3 py-2.5">Hành động</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((t) => (
                  <TaskRow key={t.id} task={t} onEdit={() => setEditing(t)} />
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {creating && (
        <TaskDialog
          mode="create"
          kind={kind}
          buildings={buildings}
          rooms={rooms}
          parties={parties}
          onClose={() => setCreating(false)}
        />
      )}
      {editing && (
        <TaskDialog
          mode="edit"
          task={editing}
          kind={kind}
          buildings={buildings}
          rooms={rooms}
          parties={parties}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function TaskCard({ task, onEdit }: { task: Task; onEdit: () => void }) {
  return (
    <Card>
      <CardContent className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="font-medium text-sm truncate">{task.taskName}</div>
            <div className="text-xs text-slate-500 mt-0.5">
              {formatDateVN(task.date)} · {task.building.name}
              {task.room ? ` · Phòng ${task.room.number}` : ""}
            </div>
          </div>
          <StatusBadge status={task.status} />
        </div>
        {task.party && <div className="text-xs text-slate-600">Đối tượng: {task.party.name}</div>}
        {task.notes && <div className="text-xs text-slate-500 line-clamp-2">{task.notes}</div>}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          <div className="font-semibold text-sm">{formatVND(BigInt(task.cost))}</div>
          <TaskActions task={task} onEdit={onEdit} />
        </div>
      </CardContent>
    </Card>
  );
}

function TaskRow({ task, onEdit }: { task: Task; onEdit: () => void }) {
  return (
    <tr className="border-t border-slate-100 hover:bg-slate-50/60">
      <td className="px-3 py-2.5 whitespace-nowrap">{formatDateVN(task.date)}</td>
      <td className="px-3 py-2.5 truncate max-w-[180px]">{task.building.name}</td>
      <td className="px-3 py-2.5">{task.room?.number ?? "—"}</td>
      <td className="px-3 py-2.5 truncate max-w-[160px]">{task.party?.name ?? "—"}</td>
      <td className="px-3 py-2.5 truncate max-w-[260px]">{task.taskName}</td>
      <td className="px-3 py-2.5"><StatusBadge status={task.status} /></td>
      <td className="px-3 py-2.5 text-right whitespace-nowrap">{formatVND(BigInt(task.cost))}</td>
      <td className="px-3 py-2.5 text-right">
        <TaskActions task={task} onEdit={onEdit} />
      </td>
    </tr>
  );
}

function StatusBadge({ status }: { status: "PENDING" | "DONE" }) {
  return status === "DONE" ? (
    <Badge variant="success" className="text-[10px]">Hoàn thành</Badge>
  ) : (
    <Badge variant="warning" className="text-[10px]">Chờ xử lý</Badge>
  );
}

function TaskActions({ task, onEdit }: { task: Task; onEdit: () => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function pay() {
    if (task.expenseTransactionId) {
      return toast.info("Đã có phiếu chi cho công việc này");
    }
    if (!confirm(`Tạo phiếu chi ${formatVND(BigInt(task.cost))} cho công việc này?`)) return;
    setBusy(true);
    const res = await fetch(`/api/maintenance-tasks/${task.id}/pay`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    setBusy(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return toast.error(err.error || "Không tạo được phiếu chi");
    }
    const { code } = await res.json();
    toast.success(`Đã tạo phiếu chi ${code}`);
    router.refresh();
  }

  async function del() {
    if (!confirm("Xoá công việc này?")) return;
    setBusy(true);
    const res = await fetch(`/api/maintenance-tasks/${task.id}`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) return toast.error("Xoá thất bại");
    toast.success("Đã xoá");
    router.refresh();
  }

  return (
    <div className="flex items-center justify-end gap-1.5">
      <Button size="sm" variant="outline" onClick={onEdit}><Edit className="h-3.5 w-3.5" /></Button>
      <Button size="sm" variant="outline" onClick={del} disabled={busy}><Trash2 className="h-3.5 w-3.5" /></Button>
      <Button size="sm" variant={task.expenseTransactionId ? "ghost" : "gradient"} onClick={pay} disabled={busy || !!task.expenseTransactionId}>
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <DollarSign className="h-3.5 w-3.5" />}
      </Button>
    </div>
  );
}

function TaskDialog({
  mode, task, kind, buildings, rooms, parties, onClose,
}: {
  mode: "create" | "edit";
  task?: Task;
  kind: "CHDV" | "VP";
  buildings: BuildingLite[];
  rooms: RoomLite[];
  parties: PartyLite[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [date, setDate] = useState(task ? task.date.slice(0, 10) : new Date().toISOString().slice(0, 10));
  const [buildingId, setBuildingId] = useState<string>(task?.buildingId ?? buildings[0]?.id ?? "");
  const [roomId, setRoomId] = useState<string>(task?.roomId ?? "");
  const [partyId, setPartyId] = useState<string>(task?.partyId ?? "");
  const [taskName, setTaskName] = useState(task?.taskName ?? "");
  const [status, setStatus] = useState<"PENDING" | "DONE">(task?.status ?? "PENDING");
  const [cost, setCost] = useState(task?.cost ?? "0");
  const [notes, setNotes] = useState(task?.notes ?? "");
  const [saving, setSaving] = useState(false);

  const filteredRooms = useMemo(
    () => rooms.filter((r) => r.buildingId === buildingId),
    [rooms, buildingId],
  );

  async function save() {
    if (!buildingId) return toast.error("Chọn toà nhà");
    if (!taskName.trim()) return toast.error("Nhập công việc");
    setSaving(true);
    const partyKind = partyId ? parties.find((p) => p.id === partyId)?.kind ?? null : null;
    const body = {
      buildingId,
      roomId: roomId || null,
      date,
      partyKind,
      partyId: partyId || null,
      taskName: taskName.trim(),
      status,
      cost: parseVNDInput(cost).toString(),
      notes: notes || null,
    };
    const res = await fetch(
      mode === "create" ? "/api/maintenance-tasks" : `/api/maintenance-tasks/${task!.id}`,
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

  const costDisplay = cost ? formatNumber(parseVNDInput(cost)) : "";

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === "create" ? `Thêm công việc ${kind}` : "Sửa công việc"}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Ngày</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Tình trạng</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as "PENDING" | "DONE")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="PENDING">Chờ xử lý</SelectItem>
                <SelectItem value="DONE">Hoàn thành</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Toà nhà</Label>
            <Select value={buildingId} onValueChange={(v) => { setBuildingId(v); setRoomId(""); }}>
              <SelectTrigger><SelectValue placeholder="Chọn toà nhà" /></SelectTrigger>
              <SelectContent>
                {buildings.map((b) => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Phòng (tuỳ chọn)</Label>
            <Select value={roomId || "_none"} onValueChange={(v) => setRoomId(v === "_none" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">— Toàn toà —</SelectItem>
                {filteredRooms.map((r) => (
                  <SelectItem key={r.id} value={r.id}>Phòng {r.number}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 col-span-2">
            <Label className="text-xs">Đối tượng</Label>
            <Select value={partyId || "_none"} onValueChange={(v) => setPartyId(v === "_none" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">— Không —</SelectItem>
                {parties.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 col-span-2">
            <Label className="text-xs">Công việc</Label>
            <Input value={taskName} onChange={(e) => setTaskName(e.target.value)} placeholder="VD: Sửa bồn rửa phòng 305" />
          </div>
          <div className="space-y-1 col-span-2">
            <Label className="text-xs">Chi phí (₫)</Label>
            <Input value={costDisplay} inputMode="numeric" onChange={(e) => setCost(e.target.value)} />
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
