"use client";
import { useState } from "react";
import { Plus, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export function NewBuildingButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [type, setType] = useState<"CHDV" | "VP">("CHDV");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const res = await fetch("/api/buildings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: fd.get("name"),
        address: fd.get("address"),
        type,
        roomCount: Number(fd.get("roomCount") || 0),
      }),
    });
    setLoading(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toast.error(err.error || "Có lỗi xảy ra");
      return;
    }
    const data = await res.json();
    toast.success("Đã thêm toà nhà");
    setOpen(false);
    router.push(`/buildings/${data.id}`);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="gradient">
          <Plus className="h-4 w-4" /> Thêm toà nhà
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Thêm toà nhà mới</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Loại toà nhà</Label>
            <Select value={type} onValueChange={(v) => setType(v as "CHDV" | "VP")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="CHDV">Căn hộ dịch vụ (CHDV)</SelectItem>
                <SelectItem value="VP">Văn phòng (VP)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="name">Tên toà nhà</Label>
            <Input id="name" name="name" required placeholder="vd: CHDV 1 - Trần Thái Tông" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="address">Địa chỉ</Label>
            <Input id="address" name="address" required placeholder="vd: 45/10 Trần Thái Tông" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="roomCount">Số phòng ban đầu</Label>
            <Input id="roomCount" name="roomCount" type="number" min={0} max={500} defaultValue={0} />
            <p className="text-xs text-slate-500">Tự động tạo các phòng đánh số 1, 2, 3… Bạn có thể thêm/sửa sau.</p>
          </div>
          <DialogFooter>
            <Button type="submit" variant="gradient" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Tạo toà nhà
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
