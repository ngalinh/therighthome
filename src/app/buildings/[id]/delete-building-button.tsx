"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Trash2, AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";

export function DeleteBuildingButton({
  buildingId,
  buildingName,
  counts,
}: {
  buildingId: string;
  buildingName: string;
  counts: { rooms: number; contracts: number; invoices: number; transactions: number };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  const canDelete = confirm.trim() === buildingName.trim();

  async function submit() {
    if (!canDelete) return;
    setLoading(true);
    const res = await fetch(`/api/buildings/${buildingId}`, { method: "DELETE" });
    setLoading(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toast.error(err.error || "Có lỗi xảy ra");
      return;
    }
    toast.success(`Đã xoá "${buildingName}"`);
    router.push("/buildings");
    router.refresh();
  }

  function close() {
    setOpen(false);
    setConfirm("");
  }

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        variant="ghost"
        size="sm"
        className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
      >
        <Trash2 className="h-4 w-4" /> Xoá toà
      </Button>

      <Dialog open={open} onOpenChange={(o) => !o && close()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-600">
              <AlertTriangle className="h-5 w-5" /> Xoá toà nhà
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm">
              Hành động này <strong>không thể hoàn tác</strong>. Sẽ xoá vĩnh viễn:
            </p>
            <ul className="text-sm space-y-1 bg-rose-50 border border-rose-200 rounded-xl p-3">
              <li>• <strong>{counts.rooms}</strong> phòng</li>
              <li>• <strong>{counts.contracts}</strong> hợp đồng</li>
              <li>• <strong>{counts.invoices}</strong> hoá đơn</li>
              <li>• <strong>{counts.transactions}</strong> giao dịch</li>
              <li>• Toàn bộ khách hàng, cài đặt, số dư đầu kỳ, ảnh CCCD/HĐ</li>
            </ul>
            <div className="space-y-1.5">
              <Label className="text-xs">
                Gõ chính xác tên toà <strong className="text-rose-600">{buildingName}</strong> để xác nhận
              </Label>
              <Input
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder={buildingName}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={close}>Huỷ</Button>
            <Button variant="destructive" onClick={submit} disabled={!canDelete || loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Xoá vĩnh viễn
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
