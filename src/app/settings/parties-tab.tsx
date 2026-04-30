"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

type Party = { id: string; kind: string; name: string; phone: string | null };

const KINDS = [
  { value: "THO_SUA_CHUA", label: "Thợ sửa chữa" },
  { value: "THO_XAY", label: "Thợ xây" },
  { value: "DON_VE_SINH", label: "Dọn vệ sinh" },
  { value: "BAO_VE", label: "Bảo vệ" },
  { value: "NHA_NUOC", label: "Nhà nước" },
  { value: "NCC_KHAC", label: "NCC khác" },
  { value: "OTHER", label: "Khác" },
];

const KIND_LABEL: Record<string, string> = Object.fromEntries(KINDS.map((k) => [k.value, k.label]));

export function PartiesTab({ parties }: { parties: Party[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function del(id: string) {
    if (!confirm("Xoá đối tượng?")) return;
    const res = await fetch(`/api/parties/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return toast.error(err.error || "Có lỗi");
    }
    toast.success("Đã xoá");
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Đối tượng (thợ, NCC, ...)</h2>
        <Button onClick={() => setOpen(true)} variant="gradient"><Plus className="h-4 w-4" /> Thêm</Button>
      </div>

      <div className="space-y-2">
        {parties.map((p) => (
          <Card key={p.id}>
            <CardContent className="p-3 flex items-center gap-3">
              <Badge variant="outline" className="text-[10px]">{KIND_LABEL[p.kind] ?? p.kind}</Badge>
              <span className="flex-1 font-medium text-sm">{p.name}</span>
              {p.phone && <span className="text-xs text-slate-500">{p.phone}</span>}
              <button onClick={() => del(p.id)} className="text-slate-300 hover:text-rose-500">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </CardContent>
          </Card>
        ))}
      </div>

      <CreateDialog open={open} onClose={() => setOpen(false)} />
    </div>
  );
}

function CreateDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [kind, setKind] = useState("THO_SUA_CHUA");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!name.trim()) return toast.error("Nhập tên");
    setLoading(true);
    const res = await fetch("/api/parties", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, name, phone }),
    });
    setLoading(false);
    if (!res.ok) return toast.error("Có lỗi");
    toast.success("Đã thêm");
    setName(""); setPhone("");
    onClose();
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Thêm đối tượng</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Loại</Label>
            <Select value={kind} onValueChange={setKind}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {KINDS.map((k) => <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Tên</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">SĐT (tuỳ chọn)</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Huỷ</Button>
          <Button variant="gradient" onClick={submit} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />} Thêm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
