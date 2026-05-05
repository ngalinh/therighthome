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
import { Plus, Trash2, Loader2, Wallet } from "lucide-react";
import { toast } from "sonner";

type PM = { id: string; name: string; isCash: boolean; buildingType: "CHDV" | "VP" | null };

export function PaymentMethodsTab({ paymentMethods }: { paymentMethods: PM[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function del(id: string) {
    if (!confirm("Xoá tài khoản TT?")) return;
    const res = await fetch(`/api/payment-methods/${id}`, { method: "DELETE" });
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
        <h2 className="text-base font-semibold">Phương thức thanh toán</h2>
        <Button onClick={() => setOpen(true)} variant="gradient"><Plus className="h-4 w-4" /> Thêm</Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {(["CHDV", "VP"] as const).map((bt) => {
          const list = paymentMethods.filter((p) => p.buildingType === bt);
          return (
            <Card key={bt}>
              <CardContent className="p-4">
                <h3 className="font-medium text-sm mb-3 flex items-center gap-2">
                  <Wallet className="h-4 w-4" /> {bt}
                  <Badge variant="secondary" className="text-[10px] ml-auto">{list.length}</Badge>
                </h3>
                <div className="space-y-1">
                  {list.length === 0 && <p className="text-xs text-slate-400">Chưa có</p>}
                  {list.map((p) => (
                    <div key={p.id} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-slate-50 text-sm">
                      <span className="flex items-center gap-2">
                        {p.name}
                        {p.isCash && <Badge variant="outline" className="text-[9px]">Tiền mặt</Badge>}
                      </span>
                      <button onClick={() => del(p.id)} className="text-slate-300 hover:text-rose-500">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <CreateDialog open={open} onClose={() => setOpen(false)} />
    </div>
  );
}

function CreateDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [buildingType, setBuildingType] = useState<"CHDV" | "VP">("CHDV");
  const [name, setName] = useState("");
  const [isCash, setIsCash] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!name.trim()) return toast.error("Nhập tên");
    setLoading(true);
    const res = await fetch("/api/payment-methods", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ buildingType, name, isCash }),
    });
    setLoading(false);
    if (!res.ok) return toast.error("Có lỗi");
    toast.success("Đã thêm");
    setName(""); setIsCash(false);
    onClose();
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Thêm tài khoản TT</DialogTitle></DialogHeader>
        <div className="space-y-3">
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
            <Label className="text-xs">Tên</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="vd: Chuyển khoản BIDV" />
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={isCash} onChange={(e) => setIsCash(e.target.checked)} className="rounded" />
            <span>Là tiền mặt</span>
          </label>
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
