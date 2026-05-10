"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Trash2, Loader2, Wallet, Edit, Users as UsersIcon } from "lucide-react";
import { toast } from "sonner";

type PM = { id: string; name: string; isCash: boolean; buildingType: "CHDV" | "VP" | null };
type PartyKindConfig = {
  id: string;
  code: string;
  label: string;
  forRevenue: boolean;
  forExpense: boolean;
  sortOrder: number;
};

export function PaymentMethodsTab({
  paymentMethods,
  partyKindConfigs,
}: {
  paymentMethods: PM[];
  partyKindConfigs: PartyKindConfig[];
}) {
  return (
    <div className="space-y-8">
      <PaymentMethodsSection paymentMethods={paymentMethods} />
      <PartyKindsSection items={partyKindConfigs} />
    </div>
  );
}

function PaymentMethodsSection({ paymentMethods }: { paymentMethods: PM[] }) {
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

      <CreatePMDialog open={open} onClose={() => setOpen(false)} />
    </div>
  );
}

function CreatePMDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
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

/* ─── Đối tượng (PartyKindConfig) ─────────────────────────── */

function PartyKindsSection({ items }: { items: PartyKindConfig[] }) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<PartyKindConfig | null>(null);

  async function del(item: PartyKindConfig) {
    if (!confirm(`Xoá đối tượng "${item.label}"?`)) return;
    const res = await fetch(`/api/party-kinds/${item.id}`, { method: "DELETE" });
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
        <div>
          <h2 className="text-base font-semibold">Đối tượng</h2>
          <p className="text-xs text-slate-500">Hiển thị trong dropdown khi tạo phiếu thu/chi</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} variant="gradient"><Plus className="h-4 w-4" /> Thêm</Button>
      </div>

      <Card>
        <CardContent className="p-4">
          <h3 className="font-medium text-sm mb-3 flex items-center gap-2">
            <UsersIcon className="h-4 w-4" />
            Danh sách
            <Badge variant="secondary" className="text-[10px] ml-auto">{items.length}</Badge>
          </h3>
          <div className="space-y-1">
            {items.length === 0 && <p className="text-xs text-slate-400">Chưa có</p>}
            {items.map((it) => (
              <div key={it.id} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-slate-50 text-sm gap-2">
                <span className="flex items-center gap-2 min-w-0 flex-1">
                  <span className="truncate">{it.label}</span>
                  <span className="text-[10px] text-slate-400 font-mono shrink-0">{it.code}</span>
                  {it.forRevenue && <Badge variant="success" className="text-[9px] shrink-0">Thu</Badge>}
                  {it.forExpense && <Badge variant="warning" className="text-[9px] shrink-0">Chi</Badge>}
                </span>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => setEditing(it)} className="text-slate-400 hover:text-primary p-1" aria-label="Sửa">
                    <Edit className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => del(it)} className="text-slate-300 hover:text-rose-500 p-1" aria-label="Xoá">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <PartyKindDialog open={createOpen} onClose={() => setCreateOpen(false)} mode="create" />
      <PartyKindDialog open={!!editing} onClose={() => setEditing(null)} mode="edit" item={editing} />
    </div>
  );
}

function PartyKindDialog({
  open, onClose, mode, item,
}: {
  open: boolean;
  onClose: () => void;
  mode: "create" | "edit";
  item?: PartyKindConfig | null;
}) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [label, setLabel] = useState("");
  const [forRevenue, setForRevenue] = useState(true);
  const [forExpense, setForExpense] = useState(true);
  const [sortOrder, setSortOrder] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (mode === "edit" && item) {
      setCode(item.code);
      setLabel(item.label);
      setForRevenue(item.forRevenue);
      setForExpense(item.forExpense);
      setSortOrder(item.sortOrder);
    } else {
      setCode("");
      setLabel("");
      setForRevenue(true);
      setForExpense(true);
      setSortOrder(0);
    }
  }, [open, mode, item]);

  async function submit() {
    if (!label.trim()) return toast.error("Nhập tên");
    if (mode === "create" && !code.trim()) return toast.error("Nhập code (IN HOA, gạch dưới)");
    if (!forRevenue && !forExpense) return toast.error("Chọn ít nhất Sổ thu hoặc Sổ chi");
    setLoading(true);
    const res = mode === "create"
      ? await fetch("/api/party-kinds", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: code.trim().toUpperCase(), label: label.trim(), forRevenue, forExpense, sortOrder }),
        })
      : await fetch(`/api/party-kinds/${item!.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ label: label.trim(), forRevenue, forExpense, sortOrder }),
        });
    setLoading(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return toast.error(err.error || "Có lỗi");
    }
    toast.success(mode === "create" ? "Đã thêm" : "Đã lưu");
    onClose();
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Thêm đối tượng" : "Sửa đối tượng"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Tên hiển thị</Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="vd: Bảo trì điện" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Code {mode === "edit" && <span className="text-slate-400">(không đổi được)</span>}</Label>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ""))}
              placeholder="vd: BAO_TRI_DIEN"
              disabled={mode === "edit"}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex items-center gap-2 text-sm cursor-pointer rounded border border-slate-200 px-3 py-2">
              <input type="checkbox" checked={forRevenue} onChange={(e) => setForRevenue(e.target.checked)} className="rounded" />
              <span>Hiện ở Sổ thu</span>
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer rounded border border-slate-200 px-3 py-2">
              <input type="checkbox" checked={forExpense} onChange={(e) => setForExpense(e.target.checked)} className="rounded" />
              <span>Hiện ở Sổ chi</span>
            </label>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Thứ tự hiển thị</Label>
            <Input type="number" value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value) || 0)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Huỷ</Button>
          <Button variant="gradient" onClick={submit} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === "create" ? "Thêm" : "Lưu"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
