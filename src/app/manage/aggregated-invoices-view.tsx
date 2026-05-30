"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty";
import { Receipt, Send, Loader2, DollarSign } from "lucide-react";
import { toast } from "sonner";
import { formatVND, formatVNDCompact, formatNumber, parseVNDInput, formatDateVN, customerDisplayName } from "@/lib/utils";
import { ExportExcelButton } from "@/components/ui/export-button";

type BuildingLite = { id: string; name: string };
type RoomLite = { id: string; buildingId: string; number: string };

type Invoice = {
  id: string;
  code: string;
  buildingId: string;
  month: number;
  year: number;
  dueDate: string;
  status: string;
  rentAmount: string;
  vatAmount: string;
  electricityFee: string;
  parkingFee: string;
  overtimeFee: string;
  repairFee: string;
  extraParkingFee: string;
  serviceFee: string;
  waterFee: string;
  totalAmount: string;
  paidAmount: string;
  sentAt: string | null;
  notes: string | null;
  building: { id: string; name: string };
  contract: {
    id: string;
    roomId: string;
    room: { number: string };
    customers: { customer: { type: string; fullName: string | null; companyName: string | null; email: string | null } }[];
  };
};

const STATUS: Record<string, { label: string; variant: "secondary" | "warning" | "success" | "destructive" }> = {
  PENDING: { label: "Chờ thanh toán", variant: "warning" },
  PARTIAL: { label: "TT một phần", variant: "warning" },
  PAID: { label: "Đã thanh toán", variant: "success" },
  OVERDUE: { label: "Quá hạn", variant: "destructive" },
  CANCELLED: { label: "Đã huỷ", variant: "secondary" },
};

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

export function AggregatedInvoicesView({
  buildingType, buildings, rooms, month, year, status, buildingFilter, roomFilter,
  invoices, paymentMethods, canWrite, canSend,
}: {
  buildingType: "CHDV" | "VP";
  buildings: BuildingLite[];
  rooms: RoomLite[];
  month: number;
  year: number;
  status: string;
  buildingFilter: string;
  roomFilter: string;
  invoices: Invoice[];
  paymentMethods: { id: string; name: string }[];
  canWrite: boolean;
  canSend: boolean;
}) {
  const router = useRouter();
  const [payOpen, setPayOpen] = useState<Invoice | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkSending, setBulkSending] = useState(false);

  const isVP = buildingType === "VP";

  const filteredRooms = useMemo(
    () => buildingFilter === "ALL" ? [] : rooms.filter((r) => r.buildingId === buildingFilter),
    [rooms, buildingFilter],
  );

  const selectableInvoices = useMemo(
    () => invoices.filter((inv) => inv.contract.customers[0]?.customer?.email && inv.status !== "CANCELLED"),
    [invoices],
  );

  function navigate(next: Partial<{ month: number; year: number; status: string; building: string; room: string }>) {
    const sp = new URLSearchParams();
    sp.set("tab", "invoices");
    sp.set("month", String(next.month ?? month));
    sp.set("year", String(next.year ?? year));
    const s = next.status ?? status;
    if (s !== "ALL") sp.set("status", s);
    const b = next.building ?? buildingFilter;
    if (b !== "ALL") sp.set("building", b);
    const r = next.room ?? roomFilter;
    if (r !== "ALL" && (next.building ?? buildingFilter) !== "ALL") sp.set("room", r);
    const base = buildingType === "CHDV" ? "/manage/chdv" : "/manage/vp";
    router.push(`${base}?${sp.toString()}`);
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === selectableInvoices.length && selectableInvoices.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(selectableInvoices.map((i) => i.id)));
    }
  }

  async function bulkSend() {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    setBulkSending(true);
    let ok = 0;
    const errors: string[] = [];
    for (const id of ids) {
      const res = await fetch(`/api/invoices/${id}/send`, { method: "POST" });
      if (res.ok) {
        ok++;
      } else {
        const err = await res.json().catch(() => ({}));
        errors.push(err.error || `Lỗi ${res.status}`);
      }
    }
    setBulkSending(false);
    setSelectedIds(new Set());
    if (errors.length === 0) {
      toast.success(`Đã gửi ${ok} hoá đơn`);
    } else {
      toast.error(errors[0]);
      if (ok > 0) toast.success(`Đã gửi thêm ${ok} hoá đơn`);
    }
    router.refresh();
  }

  const totalDue = invoices.reduce((s, i) => s + Number(i.totalAmount), 0);
  const totalPaid = invoices.reduce((s, i) => s + Number(i.paidAmount), 0);
  const overdueCount = invoices.filter((i) => i.status === "OVERDUE").length;

  return (
    <div className="space-y-4">
      {/* Filters */}
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
        <Select value={status} onValueChange={(v) => navigate({ status: v })}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Tất cả trạng thái</SelectItem>
            {Object.entries(STATUS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={buildingFilter} onValueChange={(v) => navigate({ building: v, room: "ALL" })}>
          <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Tất cả toà nhà</SelectItem>
            {buildings.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
          </SelectContent>
        </Select>
        {buildingFilter !== "ALL" && (
          <Select value={roomFilter} onValueChange={(v) => navigate({ room: v })}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Tất cả phòng</SelectItem>
              {filteredRooms.map((r) => <SelectItem key={r.id} value={r.id}>Phòng {r.number}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        <div className="ml-auto flex gap-2 items-center">
          {isVP && canSend && selectedIds.size > 0 && (
            <Button onClick={bulkSend} variant="gradient" disabled={bulkSending}>
              {bulkSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Gửi qua email ({selectedIds.size})
            </Button>
          )}
          <ExportExcelButton
            filename={`hoa-don-${buildingType.toLowerCase()}-${month}-${year}.xlsx`}
            sheets={() => [{
              name: `T${month}-${year}`,
              rows: invoices.map((inv) => {
                const primary = inv.contract.customers[0]?.customer;
                const name = customerDisplayName(primary);
                return {
                  "Toà nhà": inv.building.name,
                  "Mã HĐ": inv.code,
                  "Phòng": inv.contract.room.number,
                  "Khách thuê": name,
                  "Trạng thái": STATUS[inv.status]?.label ?? inv.status,
                  "Hạn TT": formatDateVN(inv.dueDate),
                  "Tiền thuê": Number(inv.rentAmount),
                  "Tiền điện": Number(inv.electricityFee),
                  "Phí xe": Number(inv.parkingFee),
                  "Phí ngoài giờ": Number(inv.overtimeFee),
                  "Phí dịch vụ": Number(inv.serviceFee),
                  "Tổng": Number(inv.totalAmount),
                  "Đã thu": Number(inv.paidAmount),
                  "Còn lại": Number(BigInt(inv.totalAmount) - BigInt(inv.paidAmount)),
                };
              }),
            }]}
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <GradStat label="Tổng phải thu" mobileValue={formatVNDCompact(totalDue)} desktopValue={formatVND(totalDue)} variant="tan" />
        <GradStat label="Đã thu" mobileValue={formatVNDCompact(totalPaid)} desktopValue={formatVND(totalPaid)} variant="sage" />
        <GradStat label="Còn lại" mobileValue={formatVNDCompact(totalDue - totalPaid)} desktopValue={formatVND(totalDue - totalPaid)} variant="accent" />
        <GradStat label="Quá hạn" mobileValue={`${overdueCount} HĐ`} desktopValue={`${overdueCount} HĐ`} variant="dark" />
      </div>

      {invoices.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="Chưa có hoá đơn"
          description="Chưa có hoá đơn nào trong tháng này."
        />
      ) : (
        <>
          {/* Mobile cards */}
          <div className="space-y-2 lg:hidden">
            {invoices.map((inv) => (
              <InvoiceCard
                key={inv.id}
                inv={inv}
                canWrite={canWrite}
                canSend={canSend}
                onPay={() => setPayOpen(inv)}
                showCheckbox={isVP && canSend}
                selected={selectedIds.has(inv.id)}
                onToggleSelect={() => toggleSelect(inv.id)}
              />
            ))}
          </div>

          {/* Desktop table */}
          <Card className="hidden lg:block">
            <CardContent className="p-0 overflow-x-auto">
              <InvoiceTable
                invoices={invoices}
                isVP={isVP}
                canWrite={canWrite}
                canSend={canSend}
                onPay={(inv) => setPayOpen(inv)}
                showCheckbox={isVP && canSend}
                selectedIds={selectedIds}
                onToggleSelect={toggleSelect}
                onToggleSelectAll={toggleSelectAll}
                selectableCount={selectableInvoices.length}
              />
            </CardContent>
          </Card>
        </>
      )}

      <PayDialog
        invoice={payOpen}
        paymentMethods={paymentMethods}
        onClose={() => setPayOpen(null)}
        onSuccess={() => { setPayOpen(null); router.refresh(); }}
      />
    </div>
  );
}

function GradStat({ label, mobileValue, desktopValue, variant }: {
  label: string;
  mobileValue: string;
  desktopValue: string;
  variant?: "accent" | "dark" | "sage" | "tan";
}) {
  return (
    <div className={`stat ${variant ?? ""} flex flex-col justify-center min-h-[110px]`}>
      <div className="stat-label">{label}</div>
      <div className="stat-value text-xl">
        <span className="lg:hidden">{mobileValue}</span>
        <span className="hidden lg:inline">{desktopValue}</span>
      </div>
    </div>
  );
}

function InvoiceTable({
  invoices, isVP, canWrite, canSend, onPay,
  showCheckbox, selectedIds, onToggleSelect, onToggleSelectAll, selectableCount,
}: {
  invoices: Invoice[];
  isVP: boolean;
  canWrite: boolean;
  canSend: boolean;
  onPay: (inv: Invoice) => void;
  showCheckbox: boolean;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
  selectableCount: number;
}) {
  const activeInvoices = invoices.filter((i) => i.status !== "CANCELLED");
  const totRent = activeInvoices.reduce((s, i) => s + BigInt(i.rentAmount), 0n);
  const totElec = activeInvoices.reduce((s, i) => s + BigInt(i.electricityFee), 0n);
  const totParking = activeInvoices.reduce((s, i) => s + BigInt(i.parkingFee), 0n);
  const totFee = activeInvoices.reduce((s, i) => s + BigInt(isVP ? i.overtimeFee : i.serviceFee), 0n);
  const totTotal = activeInvoices.reduce((s, i) => s + BigInt(i.totalAmount), 0n);
  const totPaid = activeInvoices.reduce((s, i) => s + BigInt(i.paidAmount), 0n);
  const totFeeVat = totTotal - totRent - totElec - totParking - totFee
    - activeInvoices.reduce((s, i) => s + BigInt(i.repairFee) + BigInt(i.extraParkingFee) + BigInt(i.serviceFee) + BigInt(i.waterFee), 0n);
  const totRemaining = totTotal - totPaid;

  const allSelected = selectableCount > 0 && selectedIds.size === selectableCount;
  const someSelected = !allSelected && selectedIds.size > 0;

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
          {showCheckbox && (
            <th className="pl-3 py-2.5 text-center w-8">
              <input
                type="checkbox"
                checked={allSelected}
                ref={(el) => { if (el) el.indeterminate = someSelected; }}
                onChange={onToggleSelectAll}
                className="h-4 w-4 rounded border-slate-300 accent-primary cursor-pointer"
                title="Chọn tất cả"
              />
            </th>
          )}
          <th className="px-3 py-2.5 text-left">Toà nhà</th>
          <th className="px-3 py-2.5 text-left">Phòng / Mã HĐ</th>
          <th className="px-3 py-2.5 text-left">Khách thuê</th>
          <th className="px-3 py-2.5 text-center">Hạn TT / Tình trạng</th>
          <th className="px-3 py-2.5 text-right">Tiền thuê</th>
          <th className="px-3 py-2.5 text-right">Tiền điện</th>
          <th className="px-3 py-2.5 text-right">Phí xe</th>
          <th className="px-3 py-2.5 text-right">{isVP ? "Phí ngoài giờ" : "Phí DV"}</th>
          {isVP && <th className="px-3 py-2.5 text-right">VAT phí</th>}
          <th className="px-3 py-2.5 text-right">Tổng</th>
          <th className="px-3 py-2.5 text-right">Đã thu</th>
          <th className="px-3 py-2.5 text-right">Còn lại</th>
          <th className="px-3 py-2.5 text-right">Thao tác</th>
        </tr>
      </thead>
      <tbody>
        <tr className="border-b-2 font-semibold text-slate-700" style={{ background: "linear-gradient(135deg, #fef2e8 0%, #fbddc8 100%)", borderBottomColor: "#f8d0b8" }}>
          <td className="px-3 py-2.5 font-semibold text-slate-700" colSpan={showCheckbox ? 5 : 4}>Tổng cộng ({invoices.length} HĐ)</td>
          <td className="px-3 py-2.5 text-right whitespace-nowrap">{formatVND(totRent)}</td>
          <td className="px-3 py-2.5 text-right whitespace-nowrap">{formatVND(totElec)}</td>
          <td className="px-3 py-2.5 text-right whitespace-nowrap">{formatVND(totParking)}</td>
          <td className="px-3 py-2.5 text-right whitespace-nowrap">{formatVND(totFee)}</td>
          {isVP && <td className="px-3 py-2.5 text-right whitespace-nowrap">{formatVND(totFeeVat)}</td>}
          <td className="px-3 py-2.5 text-right whitespace-nowrap text-emerald-700">{formatVND(totTotal)}</td>
          <td className="px-3 py-2.5 text-right whitespace-nowrap">{formatVND(totPaid)}</td>
          <td className={`px-3 py-2.5 text-right whitespace-nowrap ${totRemaining > 0n ? "text-rose-600" : ""}`}>{formatVND(totRemaining)}</td>
          <td className="px-3 py-2.5" />
        </tr>
        {invoices.map((inv) => {
          const primary = inv.contract.customers[0]?.customer;
          const name = customerDisplayName(primary);
          const st = STATUS[inv.status] ?? { label: inv.status, variant: "secondary" as const };
          const remaining = BigInt(inv.totalAmount) - BigInt(inv.paidAmount);
          const overdueDays = inv.status === "OVERDUE"
            ? Math.max(1, Math.ceil((Date.now() - new Date(inv.dueDate).getTime()) / (24 * 3600 * 1000)))
            : null;
          const selectable = showCheckbox && !!primary?.email && inv.status !== "CANCELLED";
          return (
            <tr key={inv.id} className="border-t hover:bg-slate-50/60">
              {showCheckbox && (
                <td className="pl-3 py-2.5 text-center">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(inv.id)}
                    onChange={() => onToggleSelect(inv.id)}
                    disabled={!selectable}
                    className="h-4 w-4 rounded border-slate-300 accent-primary cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                    title={selectable ? undefined : "Khách chưa có email"}
                  />
                </td>
              )}
              <td className="px-3 py-2.5">
                <div className="line-clamp-2 break-words" style={{ maxWidth: 180, minWidth: 140 }} title={inv.building.name}>{inv.building.name}</div>
              </td>
              <td className="px-3 py-2.5 whitespace-nowrap">
                <Link href={`/buildings/${inv.buildingId}/invoices/${inv.id}`} className="block hover:underline" target="_blank" rel="noopener noreferrer">
                  <div className="font-semibold text-sm text-slate-900">{inv.contract.room.number}</div>
                  <div className="font-mono text-[11px] text-primary">{inv.code}</div>
                </Link>
              </td>
              <td className="px-3 py-2.5">
                <div className="line-clamp-2 break-words" style={{ maxWidth: 240, minWidth: 180 }} title={name}>{name}</div>
              </td>
              <td className="px-3 py-2.5 text-center whitespace-nowrap">
                <div className="text-sm font-semibold text-slate-800">{formatDateVN(inv.dueDate)}</div>
                <Badge variant={st.variant} className="text-[10px] whitespace-nowrap mt-1">
                  {st.label}{overdueDays !== null && ` ${overdueDays}d`}
                </Badge>
              </td>
              <td className="px-3 py-2.5 text-right whitespace-nowrap">{formatVND(BigInt(inv.rentAmount))}</td>
              <td className="px-3 py-2.5 text-right whitespace-nowrap">{formatVND(BigInt(inv.electricityFee))}</td>
              <td className="px-3 py-2.5 text-right whitespace-nowrap">{formatVND(BigInt(inv.parkingFee))}</td>
              <td className="px-3 py-2.5 text-right whitespace-nowrap">
                {formatVND(BigInt(isVP ? inv.overtimeFee : inv.serviceFee))}
              </td>
              {isVP && <td className="px-3 py-2.5 text-right whitespace-nowrap">{formatVND(BigInt(inv.totalAmount) - BigInt(inv.rentAmount) - BigInt(inv.electricityFee) - BigInt(inv.parkingFee) - BigInt(inv.overtimeFee) - BigInt(inv.repairFee) - BigInt(inv.extraParkingFee) - BigInt(inv.serviceFee) - BigInt(inv.waterFee))}</td>}
              <td className="px-3 py-2.5 text-right font-semibold whitespace-nowrap text-emerald-700">
                {formatVND(BigInt(inv.totalAmount))}
              </td>
              <td className="px-3 py-2.5 text-right whitespace-nowrap">{formatVND(BigInt(inv.paidAmount))}</td>
              <td className={`px-3 py-2.5 text-right whitespace-nowrap font-medium ${remaining > 0n ? "text-rose-600" : ""}`}>
                {formatVND(remaining)}
              </td>
              <td className="px-3 py-2.5 text-right">
                <div className="flex gap-1 justify-end">
                  {canWrite && inv.status !== "PAID" && inv.status !== "CANCELLED" && (
                    <Button onClick={() => onPay(inv)} variant="gradient" size="sm" className="h-7 px-2">
                      <DollarSign className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function InvoiceCard({ inv, canWrite, canSend, onPay, showCheckbox, selected, onToggleSelect }: {
  inv: Invoice;
  canWrite: boolean;
  canSend: boolean;
  onPay: () => void;
  showCheckbox: boolean;
  selected: boolean;
  onToggleSelect: () => void;
}) {
  const primary = inv.contract.customers[0]?.customer;
  const name = customerDisplayName(primary);
  const st = STATUS[inv.status] ?? { label: inv.status, variant: "secondary" as const };
  const remaining = BigInt(inv.totalAmount) - BigInt(inv.paidAmount);
  const overdueDays = inv.status === "OVERDUE" ? Math.max(1, Math.ceil((Date.now() - new Date(inv.dueDate).getTime()) / (24 * 3600 * 1000))) : null;
  const selectable = showCheckbox && !!primary?.email && inv.status !== "CANCELLED";

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              {showCheckbox && (
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={onToggleSelect}
                  disabled={!selectable}
                  className="h-4 w-4 rounded border-slate-300 accent-primary cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                  title={selectable ? undefined : "Khách chưa có email"}
                />
              )}
              <span className="text-xs font-mono text-slate-500">{inv.code}</span>
              <Badge variant={st.variant}>
                {st.label}
                {overdueDays !== null && ` ${overdueDays}d`}
              </Badge>
              {inv.sentAt && <Badge variant="secondary" className="text-[10px]">Đã gửi</Badge>}
            </div>
            <div className="text-xs text-slate-500 mb-1">{inv.building.name}</div>
            <div className="text-sm space-y-0.5">
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="font-medium">{inv.contract.room.number}</span>
                <span className="text-slate-700 break-words">{name}</span>
              </div>
              <div className="flex items-baseline gap-3 flex-wrap">
                <span className="text-slate-500">Hạn: {formatDateVN(inv.dueDate)}</span>
                <span className="font-semibold text-emerald-700">{formatVND(BigInt(inv.totalAmount))}</span>
              </div>
              {remaining > 0n && (
                <div className="text-rose-600 text-xs">Còn {formatVND(remaining)}</div>
              )}
            </div>
          </div>
          <div className="flex gap-1.5 items-center justify-end sm:justify-start flex-wrap">
            <Button asChild variant="outline" size="sm">
              <Link href={`/buildings/${inv.buildingId}/invoices/${inv.id}`}>Chi tiết</Link>
            </Button>
            {canWrite && inv.status !== "PAID" && inv.status !== "CANCELLED" && (
              <Button onClick={onPay} variant="gradient" size="sm">
                <DollarSign className="h-3.5 w-3.5" /> Ghi nhận
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function PayDialog({
  invoice, paymentMethods, onClose, onSuccess,
}: {
  invoice: Invoice | null;
  paymentMethods: { id: string; name: string }[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [pmId, setPmId] = useState<string>("");
  const [paidAt, setPaidAt] = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);

  if (!invoice) return null;
  const remaining = BigInt(invoice.totalAmount) - BigInt(invoice.paidAmount);

  async function submit() {
    const a = parseVNDInput(amount);
    if (a <= 0n) return toast.error("Số tiền > 0");
    setLoading(true);
    const res = await fetch(`/api/invoices/${invoice!.id}/pay`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: a.toString(), paymentMethodId: pmId || undefined, paidAt }),
    });
    setLoading(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return toast.error(err.error || "Có lỗi");
    }
    toast.success("Đã ghi nhận thanh toán");
    onSuccess();
  }

  return (
    <Dialog open={!!invoice} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ghi nhận thanh toán — {invoice.code}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="text-sm text-slate-600">{invoice.building.name} · Phòng {invoice.contract.room.number}</div>
          <div className="text-sm text-slate-600">Còn lại: <strong>{formatVND(remaining)}</strong></div>
          <div className="space-y-1.5">
            <Label>Số tiền nhận</Label>
            <Input
              inputMode="numeric"
              value={amount ? formatNumber(parseVNDInput(amount)) : ""}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={formatNumber(remaining)}
            />
            <button type="button" className="text-xs text-primary" onClick={() => setAmount(remaining.toString())}>
              Dùng số còn lại
            </button>
          </div>
          <div className="space-y-1.5">
            <Label>Ngày thanh toán</Label>
            <DateInput value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Phương thức thanh toán</Label>
            <Select value={pmId} onValueChange={setPmId}>
              <SelectTrigger><SelectValue placeholder="Chọn PTTT" /></SelectTrigger>
              <SelectContent>
                {paymentMethods.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Huỷ</Button>
          <Button variant="gradient" onClick={submit} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Ghi nhận
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
