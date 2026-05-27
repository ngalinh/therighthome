"use client";
import { useState } from "react";
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
import { Receipt, Send, Plus, Loader2, DollarSign, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatVND, formatVNDCompact, formatNumber, parseVNDInput, formatDateVN, customerDisplayName } from "@/lib/utils";
import { ExportExcelButton } from "@/components/ui/export-button";

type ContractOption = {
  contractId: string;
  roomId: string;
  roomNumber: string;
  customerName: string;
};
type IncomeCategory = { id: string; name: string };

type Invoice = {
  id: string;
  code: string;
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
  totalAmount: string;
  paidAmount: string;
  sentAt: string | null;
  notes: string | null;
  isManual: boolean;
  contract: {
    id: string;
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

export function InvoicesView({
  buildingId, buildingType, month, year, status, invoices, paymentMethods, contractOptions, incomeCategories, canWrite, canSend,
}: {
  buildingId: string;
  buildingType: "CHDV" | "VP";
  month: number;
  year: number;
  status: string;
  invoices: Invoice[];
  paymentMethods: { id: string; name: string }[];
  contractOptions: ContractOption[];
  incomeCategories: IncomeCategory[];
  canWrite: boolean;
  canSend: boolean;
}) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [payOpen, setPayOpen] = useState<Invoice | null>(null);
  const [sending, setSending] = useState<string | null>(null);

  function navigate(m: number, y: number, s: string) {
    const sp = new URLSearchParams();
    sp.set("month", String(m));
    sp.set("year", String(y));
    if (s !== "ALL") sp.set("status", s);
    router.push(`/buildings/${buildingId}/invoices?${sp.toString()}`);
  }

  async function send(inv: Invoice) {
    const primary = inv.contract.customers[0]?.customer;
    if (!primary?.email) return toast.error("Khách thuê chưa có email");
    setSending(inv.id);
    const res = await fetch(`/api/invoices/${inv.id}/send`, { method: "POST" });
    setSending(null);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return toast.error(err.error || "Gửi thất bại");
    }
    toast.success("Đã gửi email");
    router.refresh();
  }

  async function hardDelete(inv: Invoice) {
    if (!confirm(`Xoá hoàn toàn hoá đơn ${inv.code}? Thao tác này không thể hoàn tác.`)) return;
    const res = await fetch(`/api/invoices/${inv.id}?hard=1`, { method: "DELETE" });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return toast.error(err.error || "Xoá thất bại");
    }
    toast.success("Đã xoá");
    router.refresh();
  }

  // Stats — exclude CANCELLED so huỷ HĐ không còn tính vào "phải thu / đã thu".
  const active = invoices.filter((i) => i.status !== "CANCELLED");
  const totalDue = active.reduce((s, i) => s + Number(i.totalAmount), 0);
  const totalPaid = active.reduce((s, i) => s + Number(i.paidAmount), 0);
  const overdueCount = invoices.filter((i) => i.status === "OVERDUE").length;

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <Select value={String(month)} onValueChange={(v) => navigate(Number(v), year, status)}>
          <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {MONTHS.map((m) => <SelectItem key={m} value={String(m)}>Tháng {m}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={String(year)} onValueChange={(v) => navigate(month, Number(v), status)}>
          <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {[year - 1, year, year + 1].map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={(v) => navigate(month, year, v)}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Tất cả trạng thái</SelectItem>
            {Object.entries(STATUS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="ml-auto flex gap-2">
          <ExportExcelButton
            filename={`hoa-don-${month}-${year}.xlsx`}
            sheets={() => [{
              name: `T${month}-${year}`,
              rows: invoices.map((inv) => {
                const primary = inv.contract.customers[0]?.customer;
                const name = customerDisplayName(primary);
                return {
                  "Mã HĐ": inv.code,
                  "Phòng": inv.contract.room.number,
                  "Khách thuê": name,
                  "Trạng thái": STATUS[inv.status]?.label ?? inv.status,
                  "Hạn TT": formatDateVN(inv.dueDate),
                  "Tiền thuê": Number(inv.rentAmount),
                  "Tiền điện": Number(inv.electricityFee),
                  "Phí xe": Number(inv.parkingFee),
                  "Phí ngoài giờ": Number(inv.overtimeFee),
                  "Phí sửa chữa": Number(inv.repairFee),
                  "Phí xe lẻ": Number(inv.extraParkingFee),
                  "Phí dịch vụ": Number(inv.serviceFee),
                  "Tổng": Number(inv.totalAmount),
                  "Đã thu": Number(inv.paidAmount),
                  "Còn lại": Number(BigInt(inv.totalAmount) - BigInt(inv.paidAmount)),
                };
              }),
            }]}
          />
          {canWrite && (
            <Button onClick={() => setCreateOpen(true)} variant="gradient">
              <Plus className="h-4 w-4" />
              Tạo hoá đơn
            </Button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <GradStat label="Tổng phải thu" mobileValue={formatVNDCompact(totalDue)} desktopValue={formatVND(totalDue)} variant="tan" />
        <GradStat label="Đã thu" mobileValue={formatVNDCompact(totalPaid)} desktopValue={formatVND(totalPaid)} variant="sage" />
        <GradStat label="Còn lại" mobileValue={formatVNDCompact(totalDue - totalPaid)} desktopValue={formatVND(totalDue - totalPaid)} variant="accent" />
        <GradStat label="Quá hạn" mobileValue={`${overdueCount} HĐ`} desktopValue={`${overdueCount} HĐ`} variant="dark" />
      </div>

      {/* List */}
      {invoices.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="Chưa có hoá đơn"
          description={`HĐ thuê hàng tháng được tự tạo. Bấm "Tạo hoá đơn" để tạo HĐ thủ công.`}
        />
      ) : (
        <>
          {/* Mobile: card list */}
          <div className="space-y-2 lg:hidden">
            {invoices.map((inv) => (
              <InvoiceRow
                key={inv.id}
                inv={inv}
                canWrite={canWrite}
                canSend={canSend}
                sending={sending === inv.id}
                buildingId={buildingId}
                onSend={() => send(inv)}
                onPay={() => setPayOpen(inv)}
                onHardDelete={() => hardDelete(inv)}
              />
            ))}
          </div>

          {/* Desktop: table */}
          <Card className="hidden lg:block">
            <CardContent className="p-0 overflow-x-auto">
              <InvoiceTable
                invoices={invoices}
                buildingType={buildingType}
                buildingId={buildingId}
                canWrite={canWrite}
                canSend={canSend}
                sending={sending}
                onSend={send}
                onPay={(inv) => setPayOpen(inv)}
                onHardDelete={hardDelete}
              />
            </CardContent>
          </Card>
        </>
      )}

      {/* Pay dialog */}
      <PayDialog
        invoice={payOpen}
        paymentMethods={paymentMethods}
        onClose={() => setPayOpen(null)}
        onSuccess={() => { setPayOpen(null); router.refresh(); }}
      />

      {/* Manual invoice create dialog */}
      <CreateManualInvoiceDialog
        open={createOpen}
        buildingId={buildingId}
        contractOptions={contractOptions}
        incomeCategories={incomeCategories}
        onClose={() => setCreateOpen(false)}
      />
    </div>
  );
}

function CreateManualInvoiceDialog({
  open, buildingId, contractOptions, incomeCategories, onClose,
}: {
  open: boolean;
  buildingId: string;
  contractOptions: ContractOption[];
  incomeCategories: IncomeCategory[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [contractId, setContractId] = useState<string>("");
  const [lines, setLines] = useState<{ categoryId: string; content: string; amount: string }[]>([
    { categoryId: "", content: "", amount: "" },
  ]);
  const [loading, setLoading] = useState(false);

  const selected = contractOptions.find((c) => c.contractId === contractId);
  const total = lines.reduce((s, l) => s + parseVNDInput(l.amount), 0n);

  function reset() {
    setContractId("");
    setLines([{ categoryId: "", content: "", amount: "" }]);
  }

  function updateLine(idx: number, patch: Partial<{ categoryId: string; content: string; amount: string }>) {
    setLines((arr) => arr.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }
  function addLine() {
    setLines((arr) => [...arr, { categoryId: "", content: "", amount: "" }]);
  }
  function removeLine(idx: number) {
    setLines((arr) => (arr.length === 1 ? arr : arr.filter((_, i) => i !== idx)));
  }

  async function submit() {
    if (!contractId) return toast.error("Chọn số phòng");
    const cleanLines = lines
      .map((l) => ({ ...l, amount: parseVNDInput(l.amount) }))
      .filter((l) => l.amount > 0n);
    if (cleanLines.length === 0) return toast.error("Nhập ít nhất 1 dòng chi phí");
    for (const l of cleanLines) {
      if (!l.content.trim()) return toast.error("Mỗi dòng phải có nội dung");
    }
    setLoading(true);
    const res = await fetch(`/api/buildings/${buildingId}/invoices/manual`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contractId,
        lineItems: cleanLines.map((l) => ({
          categoryId: l.categoryId || null,
          content: l.content.trim(),
          amount: l.amount.toString(),
        })),
      }),
    });
    setLoading(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return toast.error(err.error || "Tạo hoá đơn thất bại");
    }
    const { id } = await res.json();
    toast.success("Đã tạo hoá đơn");
    reset();
    onClose();
    router.push(`/buildings/${buildingId}/invoices/${id}`);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { reset(); onClose(); } }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Tạo hoá đơn</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Số phòng</Label>
              <Select value={contractId} onValueChange={setContractId}>
                <SelectTrigger><SelectValue placeholder="Chọn phòng" /></SelectTrigger>
                <SelectContent>
                  {contractOptions.map((c) => (
                    <SelectItem key={c.contractId} value={c.contractId}>
                      Phòng {c.roomNumber}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Khách thuê</Label>
              <Input value={selected?.customerName ?? ""} disabled placeholder="—" />
            </div>
          </div>
          <div className="space-y-3">
            <Label className="text-xs">Chi tiết hoá đơn</Label>
            {lines.map((l, idx) => (
              <div key={idx} className="rounded-lg border bg-slate-50/40 p-2.5 space-y-2">
                <div className="flex items-start gap-2">
                  <div className="flex-1">
                    <Select value={l.categoryId} onValueChange={(v) => updateLine(idx, { categoryId: v })}>
                      <SelectTrigger><SelectValue placeholder="Loại chi phí" /></SelectTrigger>
                      <SelectContent>
                        {incomeCategories.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Input
                    inputMode="numeric"
                    placeholder="Số tiền"
                    className="w-44 text-right tabular-nums"
                    value={l.amount ? formatNumber(parseVNDInput(l.amount)) : ""}
                    onChange={(e) => updateLine(idx, { amount: e.target.value })}
                  />
                  <button
                    type="button"
                    onClick={() => removeLine(idx)}
                    disabled={lines.length === 1}
                    className="text-slate-400 hover:text-rose-600 disabled:opacity-30 p-2 shrink-0"
                    aria-label="Xoá dòng"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <Input
                  placeholder="Nội dung"
                  value={l.content}
                  onChange={(e) => updateLine(idx, { content: e.target.value })}
                />
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={addLine}>
              <Plus className="h-3.5 w-3.5" /> Thêm
            </Button>
          </div>
          <div className="flex justify-between items-baseline pt-2 border-t">
            <span className="text-sm text-slate-600">Tổng tiền</span>
            <span className="text-lg font-bold">{formatVND(total)}</span>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => { reset(); onClose(); }}>Huỷ</Button>
          <Button variant="gradient" onClick={submit} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Tạo hoá đơn
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
  invoices, buildingType, buildingId, canWrite, canSend, sending, onSend, onPay, onHardDelete,
}: {
  invoices: Invoice[];
  buildingType: "CHDV" | "VP";
  buildingId: string;
  canWrite: boolean;
  canSend: boolean;
  sending: string | null;
  onSend: (inv: Invoice) => void;
  onPay: (inv: Invoice) => void;
  onHardDelete: (inv: Invoice) => void;
}) {
  const isVP = buildingType === "VP";

  const totRent = invoices.reduce((s, i) => s + BigInt(i.rentAmount), 0n);
  const totElec = invoices.reduce((s, i) => s + BigInt(i.electricityFee), 0n);
  const totParking = invoices.reduce((s, i) => s + BigInt(i.parkingFee), 0n);
  const totFee = invoices.reduce((s, i) => s + BigInt(isVP ? i.overtimeFee : i.serviceFee), 0n);
  const totRepair = invoices.reduce((s, i) => s + BigInt(i.repairFee), 0n);
  const totExtraParking = invoices.reduce((s, i) => s + BigInt(i.extraParkingFee), 0n);
  const totTotal = invoices.reduce((s, i) => s + BigInt(i.totalAmount), 0n);
  const totPaid = invoices.reduce((s, i) => s + BigInt(i.paidAmount), 0n);
  const totRemaining = totTotal - totPaid;

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
          <th className="px-3 py-2.5 text-left">Phòng / Mã HĐ</th>
          <th className="px-3 py-2.5 text-left">Khách thuê</th>
          <th className="px-3 py-2.5 text-center">Hạn TT / Tình trạng</th>
          <th className="px-3 py-2.5 text-right">Tiền thuê</th>
          <th className="px-3 py-2.5 text-right">Tiền điện</th>
          <th className="px-3 py-2.5 text-right">Phí xe</th>
          <th className="px-3 py-2.5 text-right">{isVP ? "Phí ngoài giờ" : "Phí DV"}</th>
          {isVP && <th className="px-3 py-2.5 text-right">Phí sửa chữa</th>}
          {isVP && <th className="px-3 py-2.5 text-right">Phí xe lẻ</th>}
          <th className="px-3 py-2.5 text-right">Tổng</th>
          <th className="px-3 py-2.5 text-right">Đã thu</th>
          <th className="px-3 py-2.5 text-right">Còn lại</th>
          <th className="px-3 py-2.5 text-right">Thao tác</th>
        </tr>
      </thead>
      <tbody>
        <tr className="bg-amber-50/60 border-b-2 border-amber-200 font-semibold text-slate-700 text-xs">
          <td className="px-3 py-2 text-slate-500" colSpan={3}>Tổng cộng ({invoices.length} HĐ)</td>
          <td className="px-3 py-2 text-right whitespace-nowrap">{formatVND(totRent)}</td>
          <td className="px-3 py-2 text-right whitespace-nowrap">{formatVND(totElec)}</td>
          <td className="px-3 py-2 text-right whitespace-nowrap">{formatVND(totParking)}</td>
          <td className="px-3 py-2 text-right whitespace-nowrap">{formatVND(totFee)}</td>
          {isVP && <td className="px-3 py-2 text-right whitespace-nowrap">{formatVND(totRepair)}</td>}
          {isVP && <td className="px-3 py-2 text-right whitespace-nowrap">{formatVND(totExtraParking)}</td>}
          <td className="px-3 py-2 text-right whitespace-nowrap text-emerald-700">{formatVND(totTotal)}</td>
          <td className="px-3 py-2 text-right whitespace-nowrap">{formatVND(totPaid)}</td>
          <td className={`px-3 py-2 text-right whitespace-nowrap ${totRemaining > 0n ? "text-rose-600" : ""}`}>{formatVND(totRemaining)}</td>
          <td className="px-3 py-2" />
        </tr>
        {invoices.map((inv) => {
          const primary = inv.contract.customers[0]?.customer;
          const name = customerDisplayName(primary);
          const st = STATUS[inv.status] ?? { label: inv.status, variant: "secondary" as const };
          const remaining = BigInt(inv.totalAmount) - BigInt(inv.paidAmount);
          const overdueDays = inv.status === "OVERDUE"
            ? Math.max(1, Math.ceil((Date.now() - new Date(inv.dueDate).getTime()) / (24 * 3600 * 1000)))
            : null;
          return (
            <tr key={inv.id} className="border-t hover:bg-slate-50/60">
              <td className="px-3 py-2.5 whitespace-nowrap">
                <Link href={`/buildings/${buildingId}/invoices/${inv.id}`} className="block hover:underline">
                  <div className="font-semibold text-sm text-slate-900">{inv.contract.room.number}</div>
                  <div className="font-mono text-[11px] text-primary">{inv.code}</div>
                </Link>
              </td>
              <td className="px-3 py-2.5">
                <div className="line-clamp-2 break-words" style={{ maxWidth: 320, minWidth: 200 }} title={name}>{name}</div>
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
              {isVP && <td className="px-3 py-2.5 text-right whitespace-nowrap">{formatVND(BigInt(inv.repairFee))}</td>}
              {isVP && <td className="px-3 py-2.5 text-right whitespace-nowrap">{formatVND(BigInt(inv.extraParkingFee))}</td>}
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
                  {canSend && primary?.email && inv.status !== "CANCELLED" && (
                    <Button onClick={() => onSend(inv)} variant="ghost" size="sm" className="h-7 px-2" disabled={sending === inv.id}>
                      {sending === inv.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                    </Button>
                  )}
                  {canWrite && inv.status === "CANCELLED" && inv.isManual && (
                    <Button
                      onClick={() => onHardDelete(inv)}
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                      aria-label="Xoá hoàn toàn"
                    >
                      <Trash2 className="h-3 w-3" />
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

function InvoiceRow({ inv, canWrite, canSend, sending, buildingId, onSend, onPay, onHardDelete }: {
  inv: Invoice;
  canWrite: boolean;
  canSend: boolean;
  sending: boolean;
  buildingId: string;
  onSend: () => void;
  onPay: () => void;
  onHardDelete: () => void;
}) {
  const primary = inv.contract.customers[0]?.customer;
  const name = customerDisplayName(primary);
  const st = STATUS[inv.status] ?? { label: inv.status, variant: "secondary" as const };
  const remaining = BigInt(inv.totalAmount) - BigInt(inv.paidAmount);
  const overdueDays = inv.status === "OVERDUE" ? Math.max(1, Math.ceil((Date.now() - new Date(inv.dueDate).getTime()) / (24 * 3600 * 1000))) : null;

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-xs font-mono text-slate-500">{inv.code}</span>
              <Badge variant={st.variant}>
                {st.label}
                {overdueDays !== null && ` ${overdueDays}d`}
              </Badge>
              {inv.sentAt && <Badge variant="secondary" className="text-[10px]">Đã gửi</Badge>}
            </div>
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
              <Link href={`/buildings/${buildingId}/invoices/${inv.id}`}>Chi tiết</Link>
            </Button>
            {canWrite && inv.status !== "PAID" && inv.status !== "CANCELLED" && (
              <Button onClick={onPay} variant="gradient" size="sm">
                <DollarSign className="h-3.5 w-3.5" /> Ghi nhận
              </Button>
            )}
            {canSend && primary?.email && inv.status !== "CANCELLED" && (
              <Button onClick={onSend} variant="ghost" size="sm" disabled={sending}>
                {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              </Button>
            )}
            {canWrite && inv.status === "CANCELLED" && inv.isManual && (
              <Button
                onClick={onHardDelete}
                variant="ghost"
                size="sm"
                className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                aria-label="Xoá hoàn toàn"
              >
                <Trash2 className="h-3.5 w-3.5" />
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
              <SelectTrigger><SelectValue placeholder="Chọn tài khoản TT" /></SelectTrigger>
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
