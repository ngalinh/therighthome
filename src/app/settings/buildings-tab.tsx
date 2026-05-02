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
import { Building2, Edit, Loader2, MapPin } from "lucide-react";
import { toast } from "sonner";

type Building = {
  id: string;
  name: string;
  address: string;
  type: "CHDV" | "VP";
};

export function BuildingsTab({ buildings }: { buildings: Building[] }) {
  const [editing, setEditing] = useState<Building | null>(null);

  return (
    <div className="space-y-3">
      <h2 className="text-base font-semibold flex items-center gap-2">
        <Building2 className="h-4 w-4" /> {buildings.length} toà nhà
      </h2>

      <div className="space-y-2">
        {buildings.map((b) => (
          <Card key={b.id}>
            <CardContent className="p-4 flex items-start gap-3">
              <div
                className={`h-11 w-11 rounded-xl flex items-center justify-center text-white shrink-0 ${
                  b.type === "CHDV" ? "bg-gradient-chdv" : "bg-gradient-vp"
                }`}
              >
                <Building2 className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium">{b.name}</span>
                  <Badge variant={b.type === "CHDV" ? "chdv" : "vp"} className="text-[10px]">
                    {b.type === "CHDV" ? "Căn hộ DV" : "Văn phòng"}
                  </Badge>
                </div>
                <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> {b.address}
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={() => setEditing(b)}>
                <Edit className="h-3.5 w-3.5" /> Sửa
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <EditDialog
        key={editing?.id ?? "none"}
        building={editing}
        onClose={() => setEditing(null)}
      />
    </div>
  );
}

function EditDialog({ building, onClose }: { building: Building | null; onClose: () => void }) {
  const router = useRouter();
  const [name, setName] = useState(building?.name ?? "");
  const [address, setAddress] = useState(building?.address ?? "");
  const [type, setType] = useState<"CHDV" | "VP">(building?.type ?? "CHDV");
  const [loading, setLoading] = useState(false);

  if (!building) return null;

  async function submit() {
    if (!name.trim() || !address.trim()) return toast.error("Tên + địa chỉ không được để trống");
    setLoading(true);
    const payload: Record<string, string> = { name, address };
    if (type !== building!.type) payload.type = type;
    const res = await fetch(`/api/buildings/${building!.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setLoading(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return toast.error(err.error || "Có lỗi");
    }
    toast.success("Đã lưu");
    onClose();
    router.refresh();
  }

  return (
    <Dialog
      open={!!building}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sửa toà nhà</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Loại toà nhà</Label>
            <Select value={type} onValueChange={(v) => setType(v as "CHDV" | "VP")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CHDV">Căn hộ dịch vụ (CHDV)</SelectItem>
                <SelectItem value="VP">Văn phòng (VP)</SelectItem>
              </SelectContent>
            </Select>
            {type !== building.type && (
              <p className="text-[11px] text-amber-600">
                ⚠ Đổi loại toà nhà sẽ ảnh hưởng đến danh mục thu/chi và PTTT (lọc theo loại). Nên chỉ đổi khi cần thật.
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Tên toà nhà</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Địa chỉ</Label>
            <Input value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Huỷ
          </Button>
          <Button variant="gradient" onClick={submit} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Lưu
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
