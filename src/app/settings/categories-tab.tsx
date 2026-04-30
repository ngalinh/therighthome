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
import { Plus, Trash2, Loader2, ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import { toast } from "sonner";

type Category = {
  id: string;
  name: string;
  type: "INCOME" | "EXPENSE";
  buildingType: "CHDV" | "VP" | null;
};

export function CategoriesTab({ categories }: { categories: Category[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function deleteCat(id: string) {
    if (!confirm("Xoá loại này?")) return;
    const res = await fetch(`/api/categories/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return toast.error(err.error || "Có lỗi");
    }
    toast.success("Đã xoá");
    router.refresh();
  }

  const grouped = {
    CHDV_INCOME: categories.filter((c) => c.buildingType === "CHDV" && c.type === "INCOME"),
    CHDV_EXPENSE: categories.filter((c) => c.buildingType === "CHDV" && c.type === "EXPENSE"),
    VP_INCOME: categories.filter((c) => c.buildingType === "VP" && c.type === "INCOME"),
    VP_EXPENSE: categories.filter((c) => c.buildingType === "VP" && c.type === "EXPENSE"),
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Loại thu / chi</h2>
        <Button onClick={() => setOpen(true)} variant="gradient"><Plus className="h-4 w-4" /> Thêm loại</Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Group title="CHDV — Thu" type="INCOME" cats={grouped.CHDV_INCOME} onDelete={deleteCat} />
        <Group title="CHDV — Chi" type="EXPENSE" cats={grouped.CHDV_EXPENSE} onDelete={deleteCat} />
        <Group title="VP — Thu" type="INCOME" cats={grouped.VP_INCOME} onDelete={deleteCat} />
        <Group title="VP — Chi" type="EXPENSE" cats={grouped.VP_EXPENSE} onDelete={deleteCat} />
      </div>

      <CreateCategoryDialog open={open} onClose={() => setOpen(false)} />
    </div>
  );
}

function Group({ title, type, cats, onDelete }: { title: string; type: "INCOME" | "EXPENSE"; cats: Category[]; onDelete: (id: string) => void }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          {type === "INCOME" ? <ArrowDownCircle className="h-4 w-4 text-emerald-500" /> : <ArrowUpCircle className="h-4 w-4 text-rose-500" />}
          <h3 className="font-medium text-sm">{title}</h3>
          <Badge variant="secondary" className="text-[10px] ml-auto">{cats.length}</Badge>
        </div>
        <div className="space-y-1">
          {cats.length === 0 && <p className="text-xs text-slate-400">Chưa có</p>}
          {cats.map((c) => (
            <div key={c.id} className="flex items-center justify-between text-sm py-1.5 px-2 rounded hover:bg-slate-50">
              <span>{c.name}</span>
              <button onClick={() => onDelete(c.id)} className="text-slate-300 hover:text-rose-500">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function CreateCategoryDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [buildingType, setBuildingType] = useState<"CHDV" | "VP">("CHDV");
  const [type, setType] = useState<"INCOME" | "EXPENSE">("INCOME");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!name.trim()) return toast.error("Nhập tên");
    setLoading(true);
    const res = await fetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ buildingType, type, name }),
    });
    setLoading(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return toast.error(err.error || "Có lỗi");
    }
    toast.success("Đã thêm");
    setName("");
    onClose();
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Thêm loại thu/chi</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Toà nhà</Label>
              <Select value={buildingType} onValueChange={(v) => setBuildingType(v as never)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="CHDV">CHDV</SelectItem>
                  <SelectItem value="VP">VP</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Loại</Label>
              <Select value={type} onValueChange={(v) => setType(v as never)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="INCOME">Thu</SelectItem>
                  <SelectItem value="EXPENSE">Chi</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Tên</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="vd: Phí internet" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Huỷ</Button>
          <Button variant="gradient" onClick={submit} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Thêm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
