"use client";
import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty";
import { ArrowDownCircle, ArrowUpCircle, Trash2, Loader2, Wallet, Pencil } from "lucide-react";
import { toast } from "sonner";
import { formatVND, formatNumber, parseVNDInput, formatDateVN, formatRoomNumber } from "@/lib/utils";
import { ExportExcelButton } from "@/components/ui/export-button";

type Transaction = {
  id: string;
  code: string;
  date: string;
  type: "INCOME" | "EXPENSE";
  amount: string;
  content: string;
  notes: string | null;
  countInBR: boolean;
  partyKind: string | null;
  roomId: string | null;
  category: { name: string } | null;
  paymentMethod: { name: string } | null;
  customer: { fullName: string | null; companyName: string | null } | null;
  party: { name: string } | null;
  room: { number: string } | null;
};

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

export function TransactionsClient({
  buildingId, month, year, transactions, categories, paymentMethods, parties, customers, rooms, contracts, canWrite,
}: {
  buildingId: string;
  month: number;
  year: number;
  transactions: Transaction[];
  categories: { id: string; name: string; type: "INCOME" | "EXPENSE" }[];
  paymentMethods: { id: string; name: string; isCash: boolean }[];
  parties: { id: string; name: string; kind: string }[];
  customers: { id: string; fullName: string | null; companyName: string | null }[];
  rooms: { id: string; number: string; primaryCustomerId: string | null }[];
  contracts: { id: string; code: string }[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const [createOpen, setCreateOpen] = useState<"INCOME" | "EXPENSE" | null>(null);
  const [editTx, setEditTx] = useState<Transaction | null>(null);
  const [filterType, setFilterType] = useState<"ALL" | "INCOME" | "EXPENSE">("ALL");
  const [filterRoom, setFilterRoom] = useState<string>("ALL");

  const filtered = useMemo(() => {
    return transactions.filter((t) =>
      (filterType === "ALL" || t.type === filterType) &&
      (filterRoom === "ALL" || t.roomId === filterRoom),
    );
  }, [transactions, filterType, filterRoom]);

  const contractByCode = useMemo(() => {
    const m = new Map<string, string>();
    contracts.forEach((c) => m.set(c.code, c.id));
    return m;
  }, [contracts]);

  const totalIn = filtered.filter((t) => t.type === "INCOME").reduce((s, t) => s + Number(t.amount), 0);
  const totalOut = filtered.filter((t) => t.type === "EXPENSE").reduce((s, t) => s + Number(t.amount), 0);

  function navigate(m: number, y: number) {
    const params = new URLSearchParams(sp);
    params.set("tab", "transactions");
    params.set("month", String(m));
    params.set("year", String(y));
    router.push(`/buildings/${buildingId}/finance?${params}`);
  }

  async function deleteTx(id: string) {
    if (!confirm("Xoá giao dịch này?")) return;
    const res = await fetch(`/api/transactions/${id}`, { method: "DELETE" });
    if (!res.ok) return toast.error("Có lỗi");
    toast.success("Đã xoá");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <Select value={String(month)} onValueChange={(v) => navigate(Number(v), year)}>
          <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {MONTHS.map((m) => <SelectItem key={m} value={String(m)}>Tháng {m}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={String(year)} onValueChange={(v) => navigate(month, Number(v))}>
          <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {[year - 1, year, year + 1].map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterType} onValueChange={(v) => setFilterType(v as never)}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Tất cả</SelectItem>
            <SelectItem value="INCOME">Thu</SelectItem>
            <SelectItem value="EXPENSE">Chi</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterRoom} onValueChange={setFilterRoom}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Phòng" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Tất cả phòng</SelectItem>
            {rooms.map((r) => <SelectItem key={r.id} value={r.id}>Phòng {r.number}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="ml-auto flex gap-2">
          <ExportExcelButton
            filename={`giao-dich-${month}-${year}.xlsx`}
            sheets={() => [{
              name: `T${month}-${year}`,
              rows: filtered.map((t) => ({
                "Mã": t.code,
                "Ngày": formatDateVN(t.date),
                "Loại": t.type === "INCOME" ? "Thu" : "Chi",
                "Số tiền": Number(t.amount),
                "Nội dung": t.content,
                "Hạng mục": t.category?.name ?? "",
                "Tài khoản TT": t.paymentMethod?.name ?? "",
                "Đối tượng": t.customer ? (t.customer.fullName || t.customer.companyName || "") : (t.party?.name ?? ""),
                "Hạch toán BCKD": t.countInBR ? "x" : "",
                "Ghi chú": t.notes ?? "",
              })),
            }]}
          />
          {canWrite && (
            <>
              <Button onClick={() => setCreateOpen("INCOME")} size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white">
                <ArrowDownCircle className="h-4 w-4" /> Phiếu thu
              </Button>
              <Button onClick={() => setCreateOpen("EXPENSE")} size="sm" className="bg-rose-600 hover:bg-rose-700 text-white">
                <ArrowUpCircle className="h-4 w-4" /> Phiếu chi
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <MiniStat label="Tổng thu" value={formatVND(totalIn)} positive />
        <MiniStat label="Tổng chi" value={formatVND(totalOut)} danger />
        <MiniStat label="Chênh lệch" value={formatVND(totalIn - totalOut)} bold />
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Wallet} title="Chưa có giao dịch" description={`Tháng ${month}/${year}.`} />
      ) : (
        <>
          {/* Mobile/PWA: card list */}
          <div className="space-y-2 lg:hidden">
            {filtered.map((t) => (
              <TransactionRow key={t.id} t={t} buildingId={buildingId} contractByCode={contractByCode} onDelete={() => deleteTx(t.id)} onEdit={() => setEditTx(t)} canWrite={canWrite} />
            ))}
          </div>
          {/* Desktop: table */}
          <Card className="hidden lg:block overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b">
                  <tr className="text-left text-xs text-slate-500">
                    <th className="px-3 py-2 font-medium">Ngày tháng</th>
                    <th className="px-3 py-2 font-medium">Phòng</th>
                    <th className="px-3 py-2 font-medium">Loại</th>
                    <th className="px-3 py-2 font-medium">Đối tượng</th>
                    <th className="px-3 py-2 font-medium">Nội dung</th>
                    <th className="px-3 py-2 font-medium">Tài khoản TT</th>
                    <th className="px-3 py-2 font-medium text-right">Số tiền</th>
                    {canWrite && <th className="px-3 py-2 font-medium w-20"></th>}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((t) => (
                    <TransactionTableRow key={t.id} t={t} buildingId={buildingId} contractByCode={contractByCode} onDelete={() => deleteTx(t.id)} onEdit={() => setEditTx(t)} canWrite={canWrite} />
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      <CreateDialog
        type={createOpen}
        buildingId={buildingId}
        month={month}
        year={year}
        categories={categories}
        paymentMethods={paymentMethods}
        parties={parties}
        customers={customers}
        rooms={rooms}
        onClose={() => setCreateOpen(null)}
      />
      <EditTransactionDialog
        tx={editTx}
        categories={categories}
        paymentMethods={paymentMethods}
        rooms={rooms}
        onClose={() => setEditTx(null)}
      />
    </div>
  );
}

function MiniStat({ label, value, positive, danger, bold }: { label: string; value: string; positive?: boolean; danger?: boolean; bold?: boolean }) {
  const color = danger ? "text-rose-600" : positive ? "text-emerald-600" : "";
  return (
    <Card>
      <CardContent className="p-3">
        <div className="text-[11px] text-slate-500">{label}</div>
        <div className={`text-base lg:text-lg font-bold ${color}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

// Render content with the contract code (HĐ XXX-DDMMYY) turned into a link
// when it matches a known contract.
function renderContent(content: string, buildingId: string, contractByCode: Map<string, string>) {
  // Match patterns like "HĐ CHDV-051226" or "HĐ VP-051226-01"
  const re = /(HĐ\s+)([A-Z]+-\d{6}(?:-\d{2})?)/u;
  const m = content.match(re);
  if (!m) return content;
  const code = m[2];
  const cid = contractByCode.get(code);
  if (!cid) return content;
  const before = content.slice(0, m.index!);
  const after = content.slice(m.index! + m[0].length);
  return (
    <>
      {before}
      {m[1]}
      <Link href={`/buildings/${buildingId}/contracts/${cid}/edit`} className="text-primary hover:underline">
        {code}
      </Link>
      {after}
    </>
  );
}

function TransactionTableRow({ t, buildingId, contractByCode, onDelete, onEdit, canWrite }: {
  t: Transaction;
  buildingId: string;
  contractByCode: Map<string, string>;
  onDelete: () => void;
  onEdit: () => void;
  canWrite: boolean;
}) {
  const partyLabel = t.partyKind
    ? PARTY_KINDS.find((p) => p.value === t.partyKind)?.label ?? null
    : (t.party?.name ?? null);
  const customerName = t.customer ? (t.customer.fullName || t.customer.companyName) : null;
  return (
    <tr className="border-b last:border-b-0 hover:bg-slate-50/60">
      <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{formatDateVN(t.date)}</td>
      <td className="px-3 py-2 text-slate-600 whitespace-nowrap">
        {t.room?.number ? formatRoomNumber(t.room.number) : <span className="text-slate-400">—</span>}
      </td>
      <td className="px-3 py-2">
        {t.category?.name ?? <span className="text-slate-400">—</span>}
        {!t.countInBR && <Badge variant="secondary" className="text-[10px] ml-1">Ko HT</Badge>}
      </td>
      <td className="px-3 py-2 text-slate-600">{partyLabel ?? <span className="text-slate-400">—</span>}</td>
      <td className="px-3 py-2 max-w-[280px] truncate" title={(customerName ? `${customerName} — ` : "") + t.content}>
        {customerName && <span>{customerName} — </span>}
        {renderContent(t.content, buildingId, contractByCode)}
      </td>
      <td className="px-3 py-2 text-slate-600">{t.paymentMethod?.name ?? <span className="text-slate-400">—</span>}</td>
      <td className={`px-3 py-2 text-right font-semibold whitespace-nowrap ${t.type === "INCOME" ? "text-emerald-700" : "text-rose-700"}`}>
        {t.type === "INCOME" ? "+" : "−"}{formatVND(BigInt(t.amount))}
      </td>
      {canWrite && (
        <td className="px-3 py-2 text-right whitespace-nowrap">
          <button onClick={onEdit} className="text-slate-400 hover:text-primary mr-2" aria-label="Sửa">
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button onClick={onDelete} className="text-slate-400 hover:text-rose-500" aria-label="Xoá">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </td>
      )}
    </tr>
  );
}

function TransactionRow({ t, buildingId, contractByCode, onDelete, onEdit, canWrite }: {
  t: Transaction;
  buildingId: string;
  contractByCode: Map<string, string>;
  onDelete: () => void;
  onEdit: () => void;
  canWrite: boolean;
}) {
  const partyLabel = t.partyKind
    ? PARTY_KINDS.find((p) => p.value === t.partyKind)?.label ?? null
    : (t.party?.name ?? null);
  const customerName = t.customer ? (t.customer.fullName || t.customer.companyName) : null;
  return (
    <Card>
      <CardContent className="p-3 flex items-start gap-3">
        <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${
          t.type === "INCOME" ? "bg-emerald-100 text-emerald-600" : "bg-rose-100 text-rose-600"
        }`}>
          {t.type === "INCOME" ? <ArrowDownCircle className="h-5 w-5" /> : <ArrowUpCircle className="h-5 w-5" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            {t.room?.number && <Badge variant="outline" className="text-[10px]">{formatRoomNumber(t.room.number)}</Badge>}
            {t.category && <Badge variant="outline" className="text-[10px]">{t.category.name}</Badge>}
            {!t.countInBR && <Badge variant="secondary" className="text-[10px]">Ko hạch toán</Badge>}
          </div>
          <div className="text-sm font-medium truncate">
            {customerName && <span>{customerName} — </span>}
            {renderContent(t.content, buildingId, contractByCode)}
          </div>
          <div className="text-xs text-slate-500 truncate">
            {formatDateVN(t.date)}
            {partyLabel && ` · ${partyLabel}`}
            {t.paymentMethod && ` · ${t.paymentMethod.name}`}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className={`font-semibold ${t.type === "INCOME" ? "text-emerald-700" : "text-rose-700"}`}>
            {t.type === "INCOME" ? "+" : "−"}{formatVND(BigInt(t.amount))}
          </div>
          {canWrite && (
            <div className="mt-1 flex justify-end gap-2">
              <button onClick={onEdit} className="text-xs text-slate-400 hover:text-primary" aria-label="Sửa">
                <Pencil className="h-3 w-3 inline" />
              </button>
              <button onClick={onDelete} className="text-xs text-slate-400 hover:text-rose-500" aria-label="Xoá">
                <Trash2 className="h-3 w-3 inline" />
              </button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function CreateDialog({
  type, buildingId, month, year, categories, paymentMethods, parties, customers, rooms, onClose,
}: {
  type: "INCOME" | "EXPENSE" | null;
  buildingId: string;
  month: number;
  year: number;
  categories: { id: string; name: string; type: "INCOME" | "EXPENSE" }[];
  paymentMethods: { id: string; name: string; isCash: boolean }[];
  parties: { id: string; name: string; kind: string }[];
  customers: { id: string; fullName: string | null; companyName: string | null }[];
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
  // Accounting month/year. null = follows the date field.
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
    // When party = CUSTOMER, derive customerId from chosen room's active contract.
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
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
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

function EditTransactionDialog({
  tx, categories, paymentMethods, rooms, onClose,
}: {
  tx: Transaction | null;
  categories: { id: string; name: string; type: "INCOME" | "EXPENSE" }[];
  paymentMethods: { id: string; name: string; isCash: boolean }[];
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
  const [loading, setLoading] = useState(false);
  const [hydratedFor, setHydratedFor] = useState<string | null>(null);

  // Hydrate state from tx when it changes.
  if (tx && hydratedFor !== tx.id) {
    setDate(tx.date.slice(0, 10));
    setAmount(BigInt(tx.amount).toString());
    setContent(tx.content);
    setCategoryId(""); // category id not on Transaction lite type; left blank — only set if user changes
    setPaymentMethodId("");
    setPartyKind(tx.partyKind ?? "");
    setRoomId("");
    setNotes(tx.notes ?? "");
    setHydratedFor(tx.id);
  }

  if (!tx) return null;
  const filteredCategories = categories.filter((c) => c.type === tx.type);

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
      amount: a.toString(),
      content,
      categoryId: categoryId || null,
      paymentMethodId: paymentMethodId || null,
      partyKind: partyKind || null,
      customerId: partyKind === "CUSTOMER" ? inferredCustomerId : null,
      roomId: roomId || null,
      notes,
    };
    const res = await fetch(`/api/transactions/${tx!.id}`, {
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
    setHydratedFor(null);
    onClose();
    router.refresh();
  }

  return (
    <Dialog open={!!tx} onOpenChange={(o) => { if (!o) { setHydratedFor(null); onClose(); } }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sửa {tx.type === "INCOME" ? "phiếu thu" : "phiếu chi"} {tx.code}</DialogTitle>
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
            <Label className="text-xs">Loại {tx.type === "INCOME" ? "thu" : "chi"} (để trống = giữ nguyên)</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger><SelectValue placeholder="Chọn để đổi loại" /></SelectTrigger>
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
            <Input value={content} onChange={(e) => setContent(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Tài khoản TT (để trống = giữ nguyên)</Label>
            <Select value={paymentMethodId} onValueChange={setPaymentMethodId}>
              <SelectTrigger><SelectValue placeholder="Chọn để đổi" /></SelectTrigger>
              <SelectContent>
                {paymentMethods.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Ghi chú</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => { setHydratedFor(null); onClose(); }}>Huỷ</Button>
          <Button variant="gradient" onClick={submit} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Lưu
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
