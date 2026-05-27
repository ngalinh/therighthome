"use client";
import { useEffect, useState } from "react";
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

export type EditableTransaction = {
  id: string;
  type: "INCOME" | "EXPENSE";
  date: string;
  amount: string;
  content: string;
  notes: string | null;
  categoryId: string | null;
  paymentMethodId: string | null;
  partyKind: string | null;
  customerId: string | null;
  partyId: string | null;
  roomId: string | null;
  accountingMonth: number | null;
  accountingYear: number | null;
  transferPairId: string | null;
};

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

export function EditTransactionDialog({
  tx, categories, paymentMethods, partyKindConfigs, rooms, onClose,
}: {
  tx: EditableTransaction | null;
  categories: { id: string; name: string; type: "INCOME" | "EXPENSE" }[];
  paymentMethods: { id: string; name: string; isCash: boolean }[];
  partyKindConfigs: PartyKindConfig[];
  rooms: { id: string; number: string; primaryCustomerId: string | null }[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [date, setDate] = useState("");
  const [amount, setAmount] = useState("");
  const [content, setContent] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [paymentMethodId, setPaymentMethodId] = useState("");
  const [partyKind, setPartyKind] = useState("");
  const [roomId, setRoomId] = useState("");
  const [notes, setNotes] = useState("");
  const [acctMonth, setAcctMonth] = useState<number | null>(null);
  const [acctYear, setAcctYear] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!tx) return;
    setDate(tx.date.slice(0, 10));
    setAmount(tx.amount);
    setContent(tx.content);
    setCategoryId(tx.categoryId ?? "");
    setPaymentMethodId(tx.paymentMethodId ?? "");
    setPartyKind(tx.partyKind ?? "");
    setRoomId(tx.roomId ?? "");
    setNotes(tx.notes ?? "");
    setAcctMonth(tx.accountingMonth);
    setAcctYear(tx.accountingYear);
  }, [tx]);

  if (!tx) return null;
  const isTransfer = !!tx.transferPairId;
  const filteredCategories = categories.filter((c) => c.type === tx.type);
  const visibleParties = partyKindConfigs.filter((p) => tx.type === "INCOME" ? p.forRevenue : p.forExpense);

  async function submit() {
    if (!tx) return;
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
      amount: a.toString(),
      content,
      categoryId: categoryId || null,
      paymentMethodId: paymentMethodId || null,
      partyKind: partyKind || null,
      customerId: partyKind === "CUSTOMER" ? inferredCustomerId : null,
      roomId: roomId || null,
      notes,
      accountingMonth: acctMonth,
      accountingYear: acctYear,
    };
    const res = await fetch(`/api/transactions/${tx.id}`, {
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
    <Dialog open={!!tx} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sửa {tx.type === "INCOME" ? "phiếu thu" : "phiếu chi"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {isTransfer && (
            <div className="rounded-md bg-blue-50 border border-blue-200 px-3 py-2 text-xs text-blue-700">
              Phiếu chuyển nguồn — ngày, số tiền, nội dung sẽ áp dụng cho cả 2 giao dịch
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Ngày</Label>
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
            <Label className="text-xs">Loại {tx.type === "INCOME" ? "thu" : "chi"}</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
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
                <Select value={partyKind} onValueChange={(v) => { setPartyKind(v); if (v !== "CUSTOMER") setRoomId(""); }}>
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
            <Textarea value={content} onChange={(e) => setContent(e.target.value)} rows={3} />
          </div>
          {!isTransfer && (
            <div className="space-y-1.5">
              <Label className="text-xs">Tài khoản TT</Label>
              <Select value={paymentMethodId} onValueChange={setPaymentMethodId}>
                <SelectTrigger><SelectValue placeholder="Chọn" /></SelectTrigger>
                <SelectContent>
                  {paymentMethods.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Tháng hạch toán</Label>
              <Select
                value={acctMonth ? String(acctMonth) : ""}
                onValueChange={(v) => setAcctMonth(v ? Number(v) : null)}
              >
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m) => (
                    <SelectItem key={m} value={String(m)}>Tháng {m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Năm hạch toán</Label>
              <Select
                value={acctYear ? String(acctYear) : ""}
                onValueChange={(v) => setAcctYear(v ? Number(v) : null)}
              >
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {(() => {
                    const base = acctYear ?? new Date(date).getFullYear();
                    return [base - 1, base, base + 1].map((y) => (
                      <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                    ));
                  })()}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Ghi chú</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Huỷ</Button>
          <Button variant="gradient" onClick={submit} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Lưu
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
