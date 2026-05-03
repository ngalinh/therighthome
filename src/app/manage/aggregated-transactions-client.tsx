"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty";
import { ArrowDownCircle, ArrowUpCircle, Trash2, Loader2, Wallet } from "lucide-react";
import { toast } from "sonner";
import { formatVND, formatNumber, parseVNDInput, formatDateVN } from "@/lib/utils";
import { ExportExcelButton } from "@/components/ui/export-button";

type BuildingLite = { id: string; name: string };
type RoomLite = { id: string; buildingId: string; number: string };
type CustomerLite = { id: string; buildingId: string; fullName: string | null; companyName: string | null };

type Transaction = {
  id: string;
  buildingId: string;
  code: string;
  date: string;
  type: "INCOME" | "EXPENSE";
  amount: string;
  content: string;
  notes: string | null;
  countInBR: boolean;
  building: { id: string; name: string };
  category: { name: string } | null;
  paymentMethod: { name: string } | null;
  customer: { fullName: string | null; companyName: string | null } | null;
  party: { name: string } | null;
};

const PARTY_KINDS = [
  { value: "CUSTOMER", label: "Khách hàng" },
  { value: "THO_SUA_CHUA", label: "Thợ sửa chữa" },
  { value: "THO_XAY", label: "Thợ xây" },
  { value: "DON_VE_SINH", label: "Dọn vệ sinh" },
  { value: "BAO_VE", label: "Bảo vệ" },
  { value: "NHA_NUOC", label: "Nhà nước" },
  { value: "NCC_KHAC", label: "NCC khác" },
  { value: "OTHER", label: "Khác" },
];

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

export function AggregatedTransactionsClient({
  buildingType, buildings, rooms, month, year, buildingFilter,
  transactions, categories, paymentMethods, parties, customers, canWrite,
}: {
  buildingType: "CHDV" | "VP";
  buildings: BuildingLite[];
  rooms: RoomLite[];
  month: number;
  year: number;
  buildingFilter: string; // "ALL" or buildingId
  transactions: Transaction[];
  categories: { id: string; name: string; type: "INCOME" | "EXPENSE" }[];
  paymentMethods: { id: string; name: string; isCash: boolean }[];
  parties: { id: string; name: string; kind: string }[];
  customers: CustomerLite[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState<"INCOME" | "EXPENSE" | null>(null);
  const [filterType, setFilterType] = useState<"ALL" | "INCOME" | "EXPENSE">("ALL");

  const filtered = useMemo(
    () => transactions.filter((t) => filterType === "ALL" || t.type === filterType),
    [transactions, filterType],
  );

  const totalIn = filtered.filter((t) => t.type === "INCOME").reduce((s, t) => s + Number(t.amount), 0);
  const totalOut = filtered.filter((t) => t.type === "EXPENSE").reduce((s, t) => s + Number(t.amount), 0);

  function navigate(next: Partial<{ month: number; year: number; building: string }>) {
    const sp = new URLSearchParams();
    sp.set("tab", "transactions");
    sp.set("month", String(next.month ?? month));
    sp.set("year", String(next.year ?? year));
    const b = next.building ?? buildingFilter;
    if (b !== "ALL") sp.set("building", b);
    const base = buildingType === "CHDV" ? "/manage/chdv" : "/manage/vp";
    router.push(`${base}?${sp.toString()}`);
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
      <div className="flex flex-wrap gap-2 items-center">
        <Select value={String(month)} onValueChange={(v) => navigate({ month: Number(v) })}>
          <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {MONTHS.map((m) => <SelectItem key={m} value={String(m)}>Tháng {m}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={String(year)} onValueChange={(v) => navigate({ year: Number(v) })}>
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
        <Select value={buildingFilter} onValueChange={(v) => navigate({ building: v })}>
          <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Tất cả toà nhà</SelectItem>
            {buildings.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="ml-auto flex gap-2">
          <ExportExcelButton
            filename={`giao-dich-${buildingType.toLowerCase()}-${month}-${year}.xlsx`}
            sheets={() => [{
              name: `T${month}-${year}`,
              rows: filtered.map((t) => ({
                "Mã": t.code,
                "Toà nhà": t.building.name,
                "Ngày": formatDateVN(t.date),
                "Loại": t.type === "INCOME" ? "Thu" : "Chi",
                "Số tiền": Number(t.amount),
                "Nội dung": t.content,
                "Hạng mục": t.category?.name ?? "",
                "PTTT": t.paymentMethod?.name ?? "",
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
        <div className="space-y-2">
          {filtered.map((t) => (
            <TransactionRow key={t.id} t={t} onDelete={() => deleteTx(t.id)} canWrite={canWrite} />
          ))}
        </div>
      )}

      <CreateDialog
        type={createOpen}
        buildings={buildings}
        rooms={rooms}
        defaultBuildingId={buildingFilter !== "ALL" ? buildingFilter : ""}
        month={month}
        year={year}
        categories={categories}
        paymentMethods={paymentMethods}
        parties={parties}
        customers={customers}
        onClose={() => setCreateOpen(null)}
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

function TransactionRow({ t, onDelete, canWrite }: { t: Transaction; onDelete: () => void; canWrite: boolean }) {
  const partyName = t.customer
    ? (t.customer.fullName || t.customer.companyName)
    : t.party?.name;
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
            <span className="text-xs font-mono text-slate-500">{t.code}</span>
            <Badge variant="outline" className="text-[10px]">{t.building.name}</Badge>
            {t.category && <Badge variant="outline" className="text-[10px]">{t.category.name}</Badge>}
            {!t.countInBR && <Badge variant="secondary" className="text-[10px]">Ko hạch toán</Badge>}
          </div>
          <div className="text-sm font-medium truncate">{t.content}</div>
          <div className="text-xs text-slate-500 truncate">
            {formatDateVN(t.date)}
            {partyName && ` · ${partyName}`}
            {t.paymentMethod && ` · ${t.paymentMethod.name}`}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className={`font-semibold ${t.type === "INCOME" ? "text-emerald-700" : "text-rose-700"}`}>
            {t.type === "INCOME" ? "+" : "−"}{formatVND(BigInt(t.amount))}
          </div>
          {canWrite && (
            <button onClick={onDelete} className="text-xs text-slate-400 hover:text-rose-500 mt-1">
              <Trash2 className="h-3 w-3 inline" />
            </button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function CreateDialog({
  type, buildings, rooms, defaultBuildingId, month, year, categories, paymentMethods, parties, customers, onClose,
}: {
  type: "INCOME" | "EXPENSE" | null;
  buildings: BuildingLite[];
  rooms: RoomLite[];
  defaultBuildingId: string;
  month: number;
  year: number;
  categories: { id: string; name: string; type: "INCOME" | "EXPENSE" }[];
  paymentMethods: { id: string; name: string; isCash: boolean }[];
  parties: { id: string; name: string; kind: string }[];
  customers: CustomerLite[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [buildingId, setBuildingId] = useState(defaultBuildingId);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState("");
  const [content, setContent] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [paymentMethodId, setPaymentMethodId] = useState("");
  const [partyKind, setPartyKind] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [partyId, setPartyId] = useState("");
  const [roomId, setRoomId] = useState("");
  const [countInBR, setCountInBR] = useState(true);
  const [acctMonth, setAcctMonth] = useState<number | null>(null);
  const [acctYear, setAcctYear] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  const filteredCategories = useMemo(
    () => type ? categories.filter((c) => c.type === type) : [],
    [categories, type],
  );
  const filteredCustomers = useMemo(
    () => customers.filter((c) => c.buildingId === buildingId),
    [customers, buildingId],
  );
  const filteredRooms = useMemo(
    () => rooms.filter((r) => r.buildingId === buildingId),
    [rooms, buildingId],
  );

  if (!type) return null;
  const dateObj = new Date(date);
  const dateMonth = dateObj.getMonth() + 1;
  const dateYear = dateObj.getFullYear();
  const effMonth = acctMonth ?? dateMonth;
  const effYear = acctYear ?? dateYear;

  async function submit() {
    if (!buildingId) return toast.error("Chọn toà nhà");
    const a = parseVNDInput(amount);
    if (a <= 0n) return toast.error("Số tiền > 0");
    if (!content.trim()) return toast.error("Nhập nội dung");
    setLoading(true);
    const payload: Record<string, unknown> = {
      date,
      type,
      amount: a.toString(),
      content,
      categoryId: categoryId || undefined,
      paymentMethodId: paymentMethodId || undefined,
      partyKind: partyKind || undefined,
      customerId: partyKind === "CUSTOMER" && customerId ? customerId : undefined,
      partyId: partyKind && partyKind !== "CUSTOMER" && partyId ? partyId : undefined,
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
              <Label className="text-xs">Toà nhà</Label>
              <Select value={buildingId} onValueChange={(v) => { setBuildingId(v); setCustomerId(""); setRoomId(""); }}>
                <SelectTrigger><SelectValue placeholder="Chọn toà nhà" /></SelectTrigger>
                <SelectContent>
                  {buildings.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Số phòng (tuỳ chọn)</Label>
              <Select value={roomId || "_none"} onValueChange={(v) => setRoomId(v === "_none" ? "" : v)} disabled={!buildingId}>
                <SelectTrigger><SelectValue placeholder={buildingId ? "—" : "Chọn toà nhà trước"} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">— Không gắn phòng —</SelectItem>
                  {filteredRooms.map((r) => <SelectItem key={r.id} value={r.id}>Phòng {r.number}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
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
          <div className="space-y-1.5">
            <Label className="text-xs">Nội dung</Label>
            <Input value={content} onChange={(e) => setContent(e.target.value)} placeholder="vd: Sửa máy lạnh phòng 201" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Đối tượng</Label>
              <Select value={partyKind} onValueChange={(v) => { setPartyKind(v); setCustomerId(""); setPartyId(""); }}>
                <SelectTrigger><SelectValue placeholder="Chọn" /></SelectTrigger>
                <SelectContent>
                  {PARTY_KINDS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {partyKind === "CUSTOMER" && (
              <div className="space-y-1.5">
                <Label className="text-xs">Khách</Label>
                <Select value={customerId} onValueChange={setCustomerId}>
                  <SelectTrigger><SelectValue placeholder={buildingId ? "Chọn khách" : "Chọn toà nhà trước"} /></SelectTrigger>
                  <SelectContent>
                    {filteredCustomers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.fullName || c.companyName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {partyKind && partyKind !== "CUSTOMER" && (
              <div className="space-y-1.5">
                <Label className="text-xs">Tên</Label>
                <Select value={partyId} onValueChange={setPartyId}>
                  <SelectTrigger><SelectValue placeholder="Chọn" /></SelectTrigger>
                  <SelectContent>
                    {parties.filter((p) => p.kind === partyKind).map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">PTTT</Label>
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
