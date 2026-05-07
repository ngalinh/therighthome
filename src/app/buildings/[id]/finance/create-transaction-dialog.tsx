"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { formatNumber, parseVNDInput } from "@/lib/utils";

const PARTY_KINDS = [
  { value: "CUSTOMER", label: "Khách hàng" },
  { value: "THO_SUA_CHUA", label: "Thợ sửa chữa" },
  { value: "THO_XAY", label: "Thợ xây" },
  { value: "DON_VE_SINH", label: "Dọn vệ sinh" },
  { value: "BAO_VE", label: "Bảo vệ" },
  { value: "NHA_NUOC", label: "Nhà nước" },
  { value: "MOI_GIOI", label: "Môi giới" },
  { value: "TOA_NHA", label: "Toà nhà" },
  { value: "NCC_KHAC", label: "NCC khác" },
  { value: "OTHER", label: "Khác" },
];

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

export function CreateTransactionDialog({
  type, buildingId, month, year, categories, paymentMethods, rooms, onClose,
}: {
  type: "INCOME" | "EXPENSE" | null;
  buildingId: string;
  month: number;
  year: number;
  categories: { id: string; name: string; type: "INCOME" | "EXPENSE" }[];
  paymentMethods: { id: string; name: string; isCash: boolean }[];
  rooms: { id: string; number: string; primaryCustomerId: string | null }[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState("");
  const [content, setContent] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [paymentMethodId, setPaymentMethodId] = useState("");
  const [partyKind, setPartyKind] = useState("");
  const [roomId, setRoomId] = useState("");
  const [countInBR, setCountInBR] = useState(true);
  const [acctMonth, setAcctMonth] = useState<number | null>(null);
  const [acctYear, setAcctYear] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  if (!type) return null;
  const filteredCategories = categories.filter((c) => c.type === type);
  const dateObj = new Date(date);
  const dateMonth = dateObj.getMonth() + 1;
  const dateYear = dateObj.getFullYear();
  const effMonth = acctMonth ?? dateMonth;
  const effYear = acctYear ?? dateYear;

  async function submit() {
    const a = parseVNDInput(amount);
    if (a <= 0n) return toast.error("Số tiền > 0");
    if (!content.trim()) return toast.error("Nhập nội dung");
    if (partyKind === "CUSTOMER" && !roomId) return toast.error("Chọn số phòng cho khách hàng");
    setLoading(true);
    const inferredCustomerId = partyKind === "CUSTOMER" && roomId
      ? rooms.find((r) => r.id === roomId)?.primaryCustomerId ?? null
      : null;
    const payload: Record<string, unknown> = {
      date,
      type,
      amount: a.toString(),
      content,
      categoryId: categoryId || undefined,
      paymentMethodId: paymentMethodId || undefined,
      partyKind: partyKind || undefined,
      customerId: inferredCustomerId || undefined,
      roomId: roomId || undefined,
      countInBR,
      accountingMonth: countInBR ? effMonth : month,
      accountingYear: countInBR ? effYear : year,
      notes,
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
              <Label className="text-xs">Ngày</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
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
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger><SelectValue placeholder="Chọn loại" /></SelectTrigger>
              <SelectContent>
                {filteredCategories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Đối tượng</Label>
              <Select value={partyKind} onValueChange={(v) => { setPartyKind(v); setRoomId(""); }}>
                <SelectTrigger><SelectValue placeholder="Chọn" /></SelectTrigger>
                <SelectContent>
                  {PARTY_KINDS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
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
          <div className="space-y-1.5">
            <Label className="text-xs">Nội dung</Label>
            <Input value={content} onChange={(e) => setContent(e.target.value)} placeholder="vd: Sửa máy lạnh phòng 201" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Tài khoản TT</Label>
            <Select value={paymentMethodId} onValueChange={setPaymentMethodId}>
              <SelectTrigger><SelectValue placeholder="Chọn" /></SelectTrigger>
              <SelectContent>
                {paymentMethods.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={countInBR} onChange={(e) => setCountInBR(e.target.checked)} className="rounded" />
            <span>Hạch toán vào BCKD (báo cáo KQKD)</span>
          </label>
          {countInBR && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Tháng hạch toán</Label>
                <Select value={String(effMonth)} onValueChange={(v) => setAcctMonth(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((m) => (
                      <SelectItem key={m} value={String(m)}>Tháng {m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Năm hạch toán</Label>
                <Select value={String(effYear)} onValueChange={(v) => setAcctYear(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[dateYear - 1, dateYear, dateYear + 1].map((y) => (
                      <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
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
