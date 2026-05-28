"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { formatNumber, parseVNDInput } from "@/lib/utils";

type PartyKindConfig = { code: string; label: string; forRevenue: boolean; forExpense: boolean };

export function CreateTransactionDialog({
  type, buildingId, month, year, categories, paymentMethods, partyKindConfigs, rooms, onClose,
}: {
  type: "INCOME" | "EXPENSE" | null;
  buildingId: string;
  month: number;
  year: number;
  categories: { id: string; name: string; type: "INCOME" | "EXPENSE"; isTransfer: boolean }[];
  paymentMethods: { id: string; name: string; isCash: boolean }[];
  partyKindConfigs: PartyKindConfig[];
  rooms: { id: string; number: string; primaryCustomerId: string | null }[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState("");
  const [content, setContent] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [paymentMethodId, setPaymentMethodId] = useState("");
  const [paymentDate, setPaymentDate] = useState("");
  const [partyKind, setPartyKind] = useState("");
  const [roomId, setRoomId] = useState("");
  const [countInBR, setCountInBR] = useState(true);
  const [notes, setNotes] = useState("");
  const [destPaymentMethodId, setDestPaymentMethodId] = useState("");
  const [loading, setLoading] = useState(false);

  if (!type) return null;
  const filteredCategories = categories.filter((c) => c.type === type);
  const selectedCategory = filteredCategories.find((c) => c.id === categoryId);
  const isTransfer = selectedCategory?.isTransfer ?? false;
  const visibleParties = partyKindConfigs.filter((p) => type === "INCOME" ? p.forRevenue : p.forExpense);
  const dateObj = new Date(date);
  const dateMonth = dateObj.getMonth() + 1;
  const dateYear = dateObj.getFullYear();

  async function submit() {
    const a = parseVNDInput(amount);
    if (a <= 0n) return toast.error("Số tiền > 0");
    if (!content.trim()) return toast.error("Nhập nội dung");
    if (isTransfer && !destPaymentMethodId) return toast.error("Chọn tài khoản nhận");
    if (!isTransfer && partyKind === "CUSTOMER" && !roomId) return toast.error("Chọn số phòng cho khách hàng");
    setLoading(true);
    const inferredCustomerId = !isTransfer && partyKind === "CUSTOMER" && roomId
      ? rooms.find((r) => r.id === roomId)?.primaryCustomerId ?? null
      : null;
    const payload: Record<string, unknown> = {
      date,
      type,
      amount: a.toString(),
      content,
      categoryId: categoryId || undefined,
      paymentMethodId: paymentMethodId || undefined,
      paymentDate: (!isTransfer && paymentDate) ? paymentDate : undefined,
      partyKind: isTransfer ? undefined : (partyKind || undefined),
      customerId: inferredCustomerId || undefined,
      roomId: isTransfer ? undefined : (roomId || undefined),
      countInBR: isTransfer ? false : countInBR,
      accountingMonth: isTransfer ? month : dateMonth,
      accountingYear: isTransfer ? year : dateYear,
      notes,
      destinationPaymentMethodId: isTransfer ? destPaymentMethodId : undefined,
    };
    const res = await fetch(`/api/buildings/${buildingId}/transactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setLoading(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return toast.error(err.error || "Có lỗi");
    }
    toast.success("Đã tạo");
    onClose();
    router.refresh();
  }

  return (
    <Dialog open={!!type} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{type === "INCOME" ? "Phiếu thu" : "Phiếu chi"} mới</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Ngày tạo phiếu</Label>
              <DateInput value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Số tiền</Label>
              <Input
                inputMode="numeric"
                value={amount ? formatNumber(parseVNDInput(amount)) : ""}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Loại {type === "INCOME" ? "thu" : "chi"}</Label>
            <Select value={categoryId} onValueChange={(v) => { setCategoryId(v); const cat = filteredCategories.find((c) => c.id === v); if (!cat?.isTransfer) setDestPaymentMethodId(""); }}>
              <SelectTrigger><SelectValue placeholder="Chọn loại" /></SelectTrigger>
              <SelectContent>
                {filteredCategories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {!isTransfer && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Đối tượng</Label>
                <Select value={partyKind} onValueChange={(v) => { setPartyKind(v); setRoomId(""); }}>
                  <SelectTrigger><SelectValue placeholder="Chọn" /></SelectTrigger>
                  <SelectContent>
                    {visibleParties.map((p) => <SelectItem key={p.code} value={p.code}>{p.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {partyKind === "CUSTOMER" && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Số phòng <span className="text-rose-500">*</span></Label>
                  <Select value={roomId} onValueChange={setRoomId}>
                    <SelectTrigger><SelectValue placeholder="Chọn phòng" /></SelectTrigger>
                    <SelectContent>
                      {rooms.map((r) => <SelectItem key={r.id} value={r.id}>Phòng {r.number}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}
          <div className="space-y-1.5">
            <Label className="text-xs">Nội dung</Label>
            <Textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="vd: Sửa máy lạnh phòng 201" rows={3} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">{isTransfer ? "Tài khoản chuyển" : "Tài khoản TT"}</Label>
              <Select value={paymentMethodId} onValueChange={setPaymentMethodId}>
                <SelectTrigger><SelectValue placeholder="Chọn" /></SelectTrigger>
                <SelectContent>
                  {paymentMethods.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {!isTransfer && (
              <div className="space-y-1.5">
                <Label className="text-xs">Ngày TT</Label>
                <DateInput value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
              </div>
            )}
          </div>
          {isTransfer && (
            <div className="space-y-1.5">
              <Label className="text-xs">Tài khoản nhận</Label>
              <Select value={destPaymentMethodId} onValueChange={setDestPaymentMethodId}>
                <SelectTrigger><SelectValue placeholder="Chọn" /></SelectTrigger>
                <SelectContent>
                  {paymentMethods.filter((p) => p.id !== paymentMethodId).map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          {!isTransfer && (
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={countInBR} onChange={(e) => setCountInBR(e.target.checked)} className="rounded" />
              <span>Hạch toán vào BCKD (báo cáo KQKD)</span>
            </label>
          )}
          <div className="space-y-1.5">
            <Label className="text-xs">Ghi chú</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Huỷ</Button>
          <Button variant="gradient" onClick={submit} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Tạo phiếu
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
