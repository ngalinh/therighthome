"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Camera, Send, X as XIcon, Save, Trash2, FileText, Edit2, Check, Plus, DollarSign, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { ImageLightbox } from "@/components/ui/image-lightbox";
import { formatVND, formatNumber, parseVNDInput, formatDateVN, customerDisplayName, rentPeriodLabel } from "@/lib/utils";
import { InvoiceReceiptDialog, type ReceiptData } from "./invoice-receipt";

type LineItem = {
  id: string;
  content: string;
  amount: string;
  countInBR: boolean;
  sortOrder: number;
  category: { id: string; name: string } | null;
};

type ElectricityLine = {
  id: string;
  roomLabel: string;
  sortOrder: number;
  start: number | null;
  end: number | null;
  startPhotoUrl: string | null;
  endPhotoUrl: string | null;
};

type VatFeeKey = "electricity" | "parking" | "overtime" | "repair" | "extraParking";

type Invoice = {
  id: string;
  code: string;
  month: number;
  year: number;
  dueDate: string;
  status: string;
  isManual: boolean;
  rentAmount: string;
  vatAmount: string;
  electricityStart: number | null;
  electricityEnd: number | null;
  electricityStartPhoto: string | null;
  electricityEndPhoto: string | null;
  electricityPricePerKwh: string;
  electricityFee: string;
  parkingCount: number;
  parkingFeePerVehicle: string;
  parkingFee: string;
  overtimeFee: string;
  repairFee: string;
  extraParkingFee: string;
  serviceFee: string;
  waterPricePerPerson: string;
  waterOccupants: number;
  waterFee: string;
  totalAmount: string;
  paidAmount: string;
  notes: string | null;
  lineItems: LineItem[];
  electricityLines: ElectricityLine[];
  contract: {
    startDate: string;
    paymentDay: number;
    rentPaymentCycleMonths: number;
    vatRate: number;
    vatApplicableFees: string[];
    room: { number: string };
    customers: { isPrimary: boolean; customer: { type: string; fullName: string | null; companyName: string | null; email: string | null; phone: string | null } }[];
  };
  payments: {
    id: string;
    amount: string;
    paidAt: string;
    transaction: {
      code: string;
      paymentMethodId: string | null;
      paymentMethod: { id: string; name: string } | null;
    };
  }[];
};

type PaymentMethodInfo = {
  id: string;
  name: string;
  bankName: string | null;
  bankBin: string | null;
  accountHolder: string | null;
  accountNumber: string | null;
  qrCodeUrl: string | null;
} | null;

type PMOption = { id: string; name: string; isCash: boolean };

const STATUS: Record<string, { label: string; variant: "secondary" | "warning" | "success" | "destructive" }> = {
  PENDING: { label: "Chờ thanh toán", variant: "warning" },
  PARTIAL: { label: "Thanh toán 1 phần", variant: "warning" },
  PAID: { label: "Đã thanh toán", variant: "success" },
  OVERDUE: { label: "Quá hạn", variant: "destructive" },
  CANCELLED: { label: "Đã huỷ", variant: "secondary" },
};

export function InvoiceDetail({
  invoice, buildingType, buildingName, buildingAddress, settingFallback, canWrite, canSend, paymentMethod, paymentMethods, incomeCategories,
}: {
  invoice: Invoice;
  buildingType: "CHDV" | "VP";
  buildingName: string;
  buildingAddress: string;
  settingFallback: { parkingFeePerVehicle: string; electricityPricePerKwh: string };
  canWrite: boolean;
  canSend: boolean;
  paymentMethod: PaymentMethodInfo;
  paymentMethods: PMOption[];
  incomeCategories: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);

  const [elecStart, setElecStart] = useState<string>(invoice.electricityStart?.toString() ?? "");
  const [elecEnd, setElecEnd] = useState<string>(invoice.electricityEnd?.toString() ?? "");
  const isMultiRoom = invoice.electricityLines.length > 0;
  const [elecLines, setElecLines] = useState<ElectricityLine[]>(invoice.electricityLines);
  const [parkingCount, setParkingCount] = useState<number>(invoice.parkingCount);
  const [overtime, setOvertime] = useState(invoice.overtimeFee);
  const [repairFee, setRepairFee] = useState(invoice.repairFee);
  const [extraParkingFee, setExtraParkingFee] = useState(invoice.extraParkingFee);
  const [serviceFee, setServiceFee] = useState(invoice.serviceFee);
  const [waterPricePerPerson, setWaterPricePerPerson] = useState(invoice.waterPricePerPerson);
  const [waterOccupants, setWaterOccupants] = useState<number>(invoice.waterOccupants);
  const [notes, setNotes] = useState(invoice.notes ?? "");
  const [dueDate, setDueDate] = useState(invoice.dueDate.slice(0, 10));
  // Editable rent amount — only used when reopening a CANCELLED auto invoice.
  const [rentAmountInput, setRentAmountInput] = useState(invoice.rentAmount);

  // Manual invoice line items — editable as long as nothing has been paid yet.
  const [lineItems, setLineItems] = useState(
    invoice.lineItems.map((l) => ({
      categoryId: l.category?.id ?? "",
      content: l.content,
      amount: l.amount, // stringified BigInt
    })),
  );
  const lineItemsTotal = lineItems.reduce((s, l) => s + parseVNDInput(l.amount), 0n);
  const canEditLines = invoice.isManual && BigInt(invoice.paidAmount) === 0n && invoice.status !== "CANCELLED" && canWrite;

  const primary = invoice.contract.customers.find((c) => c.isPrimary)?.customer;
  const st = STATUS[invoice.status] ?? { label: invoice.status, variant: "secondary" as const };

  // Snapshot fee fallbacks: if the invoice was created when the building
  // setting was empty, fall back to the current setting so the user can
  // still see Phí xe / Tiền điện when they enter a count or meter reading.
  const effectiveParkingFeePerVehicle =
    invoice.parkingFeePerVehicle !== "0"
      ? BigInt(invoice.parkingFeePerVehicle)
      : BigInt(settingFallback.parkingFeePerVehicle);
  const effectiveElectricityPrice =
    invoice.electricityPricePerKwh !== "0"
      ? BigInt(invoice.electricityPricePerKwh)
      : BigInt(settingFallback.electricityPricePerKwh);

  // Live compute preview
  const elecStartN = elecStart ? Number(elecStart) : null;
  const elecEndN = elecEnd ? Number(elecEnd) : null;
  const kwh = isMultiRoom
    ? elecLines.reduce((sum, l) => {
        const k = l.start != null && l.end != null && l.end > l.start ? l.end - l.start : 0;
        return sum + k;
      }, 0)
    : (elecStartN !== null && elecEndN !== null && elecEndN > elecStartN ? elecEndN - elecStartN : 0);
  const elecFee = BigInt(kwh) * effectiveElectricityPrice;
  const parkingFee = BigInt(parkingCount) * effectiveParkingFeePerVehicle;
  const waterFee = BigInt(waterOccupants) * parseVNDInput(waterPricePerPerson);
  const overtimeBN = parseVNDInput(overtime);
  const repairBN = parseVNDInput(repairFee);
  const extraParkingBN = parseVNDInput(extraParkingFee);
  const vatRate = invoice.contract.vatRate ?? 0;
  const vatApplicable = new Set<string>(invoice.contract.vatApplicableFees ?? []);
  const vatOf = (n: bigint) => BigInt(Math.round(Number(n) * vatRate));
  const elecVat = vatApplicable.has("electricity") ? vatOf(elecFee) : 0n;
  const parkingVat = vatApplicable.has("parking") ? vatOf(parkingFee) : 0n;
  const overtimeVat = vatApplicable.has("overtime") ? vatOf(overtimeBN) : 0n;
  const repairVat = vatApplicable.has("repair") ? vatOf(repairBN) : 0n;
  const extraParkingVat = vatApplicable.has("extraParking") ? vatOf(extraParkingBN) : 0n;
  const feeVatTotal = elecVat + parkingVat + overtimeVat + repairVat + extraParkingVat;
  // rentAmount already includes VAT (after-VAT). Don't add vatAmount on top.
  // For CANCELLED auto invoices use the editable local state so the preview
  // reflects what will be saved when the user reopens the invoice.
  const rentForPreview = invoice.status === "CANCELLED" && !invoice.isManual
    ? parseVNDInput(rentAmountInput)
    : BigInt(invoice.rentAmount);
  const totalPreview =
    rentForPreview +
    elecFee + parkingFee + overtimeBN + repairBN + extraParkingBN +
    parseVNDInput(serviceFee) + waterFee +
    feeVatTotal;
  const remaining = BigInt(invoice.totalAmount) - BigInt(invoice.paidAmount);

  // Month labels: rent = current month (anchored to contract start day),
  // other costs = previous month (consumption period).
  const prevMonth = invoice.month === 1 ? 12 : invoice.month - 1;
  const cycle = invoice.contract.rentPaymentCycleMonths ?? 1;
  const rentPeriod = rentPeriodLabel(invoice.contract.paymentDay, invoice.month, invoice.year, cycle);
  const usageLabelMonth = `T${prevMonth}`;

  async function save() {
    if (invoice.isManual) {
      const cleaned = lineItems
        .map((l) => ({ ...l, amount: parseVNDInput(l.amount) }))
        .filter((l) => l.amount > 0n);
      if (canEditLines && cleaned.length === 0) {
        return toast.error("Phải có ít nhất 1 dòng chi phí");
      }
      for (const l of cleaned) {
        if (!l.content.trim()) return toast.error("Mỗi dòng phải có nội dung");
      }
      setSaving(true);
      const res = await fetch(`/api/invoices/${invoice.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notes,
          dueDate,
          ...(canEditLines
            ? {
                lineItems: cleaned.map((l) => ({
                  categoryId: l.categoryId || null,
                  content: l.content.trim(),
                  amount: l.amount.toString(),
                })),
              }
            : {}),
        }),
      });
      setSaving(false);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return toast.error(err.error || "Lưu thất bại");
      }
      toast.success("Đã lưu");
      router.refresh();
      return;
    }
    setSaving(true);
    const res = await fetch(`/api/invoices/${invoice.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        electricityStart: elecStart ? Number(elecStart) : null,
        electricityEnd: elecEnd ? Number(elecEnd) : null,
        parkingCount,
        // Bring the snapshots up to the current effective rate so the saved
        // total reflects what the user sees on screen.
        parkingFeePerVehicle: effectiveParkingFeePerVehicle.toString(),
        electricityPricePerKwh: effectiveElectricityPrice.toString(),
        overtimeFee: parseVNDInput(overtime).toString(),
        repairFee: parseVNDInput(repairFee).toString(),
        extraParkingFee: parseVNDInput(extraParkingFee).toString(),
        serviceFee: parseVNDInput(serviceFee).toString(),
        waterPricePerPerson: parseVNDInput(waterPricePerPerson).toString(),
        waterOccupants,
        notes,
        dueDate,
        ...(invoice.status === "CANCELLED" ? { rentAmount: parseVNDInput(rentAmountInput).toString() } : {}),
      }),
    });
    setSaving(false);
    if (!res.ok) return toast.error("Lưu thất bại");
    toast.success("Đã lưu");
    router.refresh();
  }

  async function reopen() {
    if (!confirm("Mở lại hoá đơn? Tiền thuê sẽ được cập nhật theo giá trị hiện tại.")) return;
    setSaving(true);
    const res = await fetch(`/api/invoices/${invoice.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        electricityStart: elecStart ? Number(elecStart) : null,
        electricityEnd: elecEnd ? Number(elecEnd) : null,
        parkingCount,
        parkingFeePerVehicle: effectiveParkingFeePerVehicle.toString(),
        electricityPricePerKwh: effectiveElectricityPrice.toString(),
        overtimeFee: parseVNDInput(overtime).toString(),
        repairFee: parseVNDInput(repairFee).toString(),
        extraParkingFee: parseVNDInput(extraParkingFee).toString(),
        serviceFee: parseVNDInput(serviceFee).toString(),
        waterPricePerPerson: parseVNDInput(waterPricePerPerson).toString(),
        waterOccupants,
        notes,
        dueDate,
        rentAmount: parseVNDInput(rentAmountInput).toString(),
        reactivate: true,
      }),
    });
    setSaving(false);
    if (!res.ok) return toast.error("Mở lại thất bại");
    toast.success("Đã mở lại hoá đơn");
    router.refresh();
  }

  function updateLine(idx: number, patch: Partial<{ categoryId: string; content: string; amount: string }>) {
    setLineItems((arr) => arr.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }
  function addLine() {
    setLineItems((arr) => [...arr, { categoryId: "", content: "", amount: "" }]);
  }
  function removeLine(idx: number) {
    setLineItems((arr) => (arr.length === 1 ? arr : arr.filter((_, i) => i !== idx)));
  }

  async function send() {
    if (!primary?.email) return toast.error("Khách thuê chưa có email");
    setSending(true);
    const res = await fetch(`/api/invoices/${invoice.id}/send`, { method: "POST" });
    setSending(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return toast.error(err.error || "Gửi thất bại");
    }
    toast.success("Đã gửi email");
    router.refresh();
  }

  async function cancelInvoice() {
    if (!confirm("Huỷ hoá đơn này?")) return;
    const res = await fetch(`/api/invoices/${invoice.id}`, { method: "DELETE" });
    if (!res.ok) return toast.error("Có lỗi");
    toast.success("Đã huỷ");
    router.refresh();
  }

  const headerGradient =
    invoice.status === "OVERDUE" ? "from-orange-500 via-rose-500 to-rose-600" :
    invoice.status === "PAID"    ? "from-emerald-500 to-teal-500" :
    invoice.status === "PARTIAL" ? "from-amber-400 to-orange-500" :
    "from-slate-500 to-slate-700";

  // Build receipt data from current invoice values (use saved snapshots, not
  // unsaved edits, so the receipt always reflects what the customer is being
  // billed).
  const receiptData: ReceiptData = {
    invoiceCode: invoice.code,
    month: invoice.month,
    year: invoice.year,
    rentPeriod,
    dueDate: invoice.dueDate,
    buildingName,
    buildingAddress,
    buildingType,
    roomNumber: invoice.contract.room.number,
    customer: primary,
    isManual: invoice.isManual,
    lineItems: invoice.lineItems.map((l) => ({
      content: l.content,
      categoryName: l.category?.name ?? null,
      amount: BigInt(l.amount),
    })),
    rentAmount: BigInt(invoice.rentAmount),
    vatAmount: BigInt(invoice.vatAmount),
    electricityStart: invoice.electricityStart,
    electricityEnd: invoice.electricityEnd,
    electricityFee: BigInt(invoice.electricityFee),
    electricityPricePerKwh: BigInt(invoice.electricityPricePerKwh),
    electricityStartPhoto: invoice.electricityStartPhoto,
    electricityEndPhoto: invoice.electricityEndPhoto,
    parkingCount: invoice.parkingCount,
    parkingFee: BigInt(invoice.parkingFee),
    overtimeFee: BigInt(invoice.overtimeFee),
    repairFee: BigInt(invoice.repairFee),
    extraParkingFee: BigInt(invoice.extraParkingFee),
    serviceFee: BigInt(invoice.serviceFee),
    vatRate: invoice.contract.vatRate ?? 0,
    vatApplicableFees: (invoice.contract.vatApplicableFees ?? []) as VatFeeKey[],
    waterOccupants: invoice.waterOccupants,
    waterPricePerPerson: BigInt(invoice.waterPricePerPerson),
    waterFee: BigInt(invoice.waterFee),
    totalAmount: BigInt(invoice.totalAmount),
    paidAmount: BigInt(invoice.paidAmount),
    notes: invoice.notes,
    paymentMethod,
  };

  return (
    <div className="grid lg:grid-cols-3 gap-4 lg:gap-6">
      <div className="lg:col-span-2 space-y-4">
        <Card className="overflow-hidden">
          {/* Gradient status header */}
          <div className={`bg-gradient-to-br ${headerGradient} px-5 py-4 text-white`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-white/75">Hoá đơn · {invoice.code}</p>
                <h3 className="text-lg font-bold mt-0.5">
                  Phòng {invoice.contract.room.number} · {customerDisplayName(primary)}
                </h3>
              </div>
              <Badge className="bg-white/20 text-white border-white/30 text-xs">
                {st.label}
              </Badge>
            </div>
            <div className="mt-3 flex items-baseline gap-1.5">
              <span className="text-2xl font-bold">{formatVND(BigInt(invoice.totalAmount))}</span>
              {remaining > 0n && (
                <span className="text-sm text-white/75">· còn {formatVND(remaining)}</span>
              )}
            </div>
          </div>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pt-4">
            <CardTitle className="text-base">Chi tiết</CardTitle>
            <Button variant="outline" size="sm" onClick={() => setReceiptOpen(true)}>
              <FileText className="h-4 w-4" /> Xem hoá đơn
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {invoice.isManual ? (
              <>
                {canEditLines ? (
                  <div className="space-y-3">
                    {lineItems.map((l, idx) => (
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
                            disabled={lineItems.length === 1}
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
                ) : (
                  invoice.lineItems.map((l) => (
                    <Row
                      key={l.id}
                      label={l.category?.name ? `${l.category.name} — ${l.content}` : l.content}
                      value={formatVND(BigInt(l.amount))}
                    />
                  ))
                )}
                <hr />
                <Row
                  label="Tổng phải thu"
                  value={formatVND(canEditLines ? lineItemsTotal : BigInt(invoice.totalAmount))}
                  bold
                />
                <Row label="Đã thu" value={formatVND(BigInt(invoice.paidAmount))} positive />
                {remaining > 0n && <Row label="Còn lại" value={formatVND(remaining)} bold danger />}
              </>
            ) : (
              <>
                {buildingType === "VP" && vatRate > 0 ? (
                  // Excel-style: all lines show NET, then subtotal + VAT + total
                  (() => {
                    const netRent = BigInt(invoice.rentAmount) - BigInt(invoice.vatAmount);
                    const totalVat = BigInt(invoice.vatAmount) + feeVatTotal;
                    const subtotal = totalPreview - totalVat;
                    return (
                      <>
                        <Row label={`Tiền thuê (${rentPeriod})`} value={formatVND(netRent)} />
                        {isMultiRoom
                          ? elecLines.map((l) => {
                              const lKwh = l.start != null && l.end != null && l.end > l.start ? l.end - l.start : 0;
                              const lFee = BigInt(lKwh) * effectiveElectricityPrice;
                              return (
                                <Row
                                  key={l.id}
                                  label={`Tiền điện ${usageLabelMonth} - ${l.roomLabel}${lKwh ? ` (${lKwh} kWh × ${formatVND(effectiveElectricityPrice)})` : ""}`}
                                  value={formatVND(lFee)}
                                />
                              );
                            })
                          : elecFee > 0n && (
                              <Row
                                label={`Tiền điện ${usageLabelMonth}${kwh ? ` (${kwh} kWh × ${formatVND(BigInt(invoice.electricityPricePerKwh))})` : ""}`}
                                value={formatVND(elecFee)}
                              />
                            )
                        }
                        {parkingFee > 0n && <Row label={`Phí xe (${parkingCount} xe)`} value={formatVND(parkingFee)} />}
                        {overtimeBN > 0n && <Row label="Phí ngoài giờ" value={formatVND(overtimeBN)} />}
                        {repairBN > 0n && <Row label="Phí sửa chữa" value={formatVND(repairBN)} />}
                        {extraParkingBN > 0n && <Row label="Phí xe lẻ" value={formatVND(extraParkingBN)} />}
                        <hr />
                        <Row label="Cộng chưa VAT" value={formatVND(subtotal)} />
                        <Row label={`VAT (${Math.round(vatRate * 100)}%)`} value={formatVND(totalVat)} />
                        <hr />
                        <Row label="Tổng phải thanh toán" value={formatVND(totalPreview)} bold />
                        <Row label="Đã thu" value={formatVND(BigInt(invoice.paidAmount))} positive />
                        {remaining > 0n && <Row label="Còn lại" value={formatVND(remaining)} bold danger />}
                      </>
                    );
                  })()
                ) : (
                  <>
                    <Row
                      label={
                        BigInt(invoice.vatAmount) > 0n
                          ? `Tiền thuê (${rentPeriod}) · đã VAT, gồm ${formatVND(BigInt(invoice.vatAmount))} VAT`
                          : `Tiền thuê (${rentPeriod})`
                      }
                      value={formatVND(BigInt(invoice.rentAmount))}
                    />
                    {isMultiRoom
                      ? elecLines.map((l) => {
                          const lKwh = l.start != null && l.end != null && l.end > l.start ? l.end - l.start : 0;
                          const lFee = BigInt(lKwh) * effectiveElectricityPrice;
                          const lVat = vatApplicable.has("electricity") ? vatOf(lFee) : 0n;
                          return (
                            <FeeRow
                              key={l.id}
                              label={`Tiền điện ${usageLabelMonth} - ${l.roomLabel}${lKwh ? ` (${lKwh} kWh × ${formatVND(effectiveElectricityPrice)})` : ""}`}
                              base={lFee}
                              vat={lVat}
                            />
                          );
                        })
                      : (
                        <FeeRow
                          label={`Tiền điện ${usageLabelMonth}${kwh ? ` (${kwh} kWh × ${formatVND(BigInt(invoice.electricityPricePerKwh))})` : ""}`}
                          base={elecFee}
                          vat={elecVat}
                        />
                      )
                    }
                    {buildingType === "CHDV" && waterFee > 0n && (
                      <Row label={`Tiền nước (${waterOccupants} người × ${formatVND(parseVNDInput(waterPricePerPerson))})`} value={formatVND(waterFee)} />
                    )}
                    {parkingFee > 0n && (
                      <FeeRow label={`Phí xe (${parkingCount} xe)`} base={parkingFee} vat={parkingVat} />
                    )}
                    {buildingType === "VP" && overtimeBN > 0n && (
                      <FeeRow label="Phí ngoài giờ" base={overtimeBN} vat={overtimeVat} />
                    )}
                    {buildingType === "VP" && repairBN > 0n && (
                      <FeeRow label="Phí sửa chữa" base={repairBN} vat={repairVat} />
                    )}
                    {buildingType === "VP" && extraParkingBN > 0n && (
                      <FeeRow label="Phí xe lẻ" base={extraParkingBN} vat={extraParkingVat} />
                    )}
                    {buildingType === "CHDV" && parseVNDInput(serviceFee) > 0n && (
                      <Row label="Phí dịch vụ" value={formatVND(parseVNDInput(serviceFee))} />
                    )}
                    <hr />
                    <Row label="Tổng phải thu" value={formatVND(totalPreview)} bold />
                    <Row label="Đã thu" value={formatVND(BigInt(invoice.paidAmount))} positive />
                    {remaining > 0n && <Row label="Còn lại" value={formatVND(remaining)} bold danger />}
                  </>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {!invoice.isManual && (
          <Card>
            <CardHeader><CardTitle>Số điện</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {isMultiRoom
                ? elecLines.map((line) => (
                    <div key={line.id}>
                      <p className="text-sm font-medium text-slate-600 mb-2">{line.roomLabel}</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <ElecLinePhotoField
                          invoiceId={invoice.id}
                          lineId={line.id}
                          which="start"
                          label="Số điện đầu kỳ"
                          photoUrl={line.startPhotoUrl}
                          value={line.start?.toString() ?? ""}
                          onChange={(val) => setElecLines((ls) => ls.map((l) => l.id === line.id ? { ...l, start: val === "" ? null : Number(val) } : l))}
                          disabled={!canWrite}
                        />
                        <ElecLinePhotoField
                          invoiceId={invoice.id}
                          lineId={line.id}
                          which="end"
                          label="Số điện cuối kỳ"
                          photoUrl={line.endPhotoUrl}
                          value={line.end?.toString() ?? ""}
                          onChange={(val) => setElecLines((ls) => ls.map((l) => l.id === line.id ? { ...l, end: val === "" ? null : Number(val) } : l))}
                          disabled={!canWrite}
                        />
                      </div>
                    </div>
                  ))
                : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <PhotoUploadField
                      invoiceId={invoice.id}
                      which="start"
                      label="Số điện đầu kỳ"
                      photoUrl={invoice.electricityStartPhoto}
                      value={elecStart}
                      onChange={setElecStart}
                      disabled={!canWrite}
                    />
                    <PhotoUploadField
                      invoiceId={invoice.id}
                      which="end"
                      label="Số điện cuối kỳ"
                      photoUrl={invoice.electricityEndPhoto}
                      value={elecEnd}
                      onChange={setElecEnd}
                      disabled={!canWrite}
                    />
                  </div>
                )
              }
            </CardContent>
          </Card>
        )}

        {!invoice.isManual && (
        <Card>
          <CardHeader><CardTitle>Khác</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {invoice.status === "CANCELLED" && (
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-xs">Tiền thuê (₫) — chỉnh trước khi mở lại</Label>
                  <Input
                    inputMode="numeric"
                    value={formatNumber(parseVNDInput(rentAmountInput))}
                    onChange={(e) => setRentAmountInput(e.target.value)}
                    disabled={!canWrite}
                  />
                </div>
              )}
              <div className="space-y-1">
                <Label className="text-xs">Số xe</Label>
                <Input type="number" min={0} value={parkingCount} onChange={(e) => setParkingCount(Number(e.target.value))} disabled={!canWrite} />
                <p className="text-[10px] text-slate-500">Mặc định lấy từ HĐ. Có thể chỉnh tay tháng này.</p>
              </div>
              {buildingType === "CHDV" ? (
                <>
                  <div className="space-y-1">
                    <Label className="text-xs">Phí dịch vụ (₫)</Label>
                    <Input
                      inputMode="numeric"
                      value={formatNumber(parseVNDInput(serviceFee))}
                      onChange={(e) => setServiceFee(e.target.value)}
                      disabled={!canWrite}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Tiền nước (₫/người)</Label>
                    <Input
                      inputMode="numeric"
                      value={formatNumber(parseVNDInput(waterPricePerPerson))}
                      onChange={(e) => setWaterPricePerPerson(e.target.value)}
                      disabled={!canWrite}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Số người ở</Label>
                    <Input
                      type="number"
                      min={0}
                      value={waterOccupants}
                      onChange={(e) => setWaterOccupants(Number(e.target.value))}
                      disabled={!canWrite}
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-1">
                    <Label className="text-xs">Phí ngoài giờ (₫)</Label>
                    <Input
                      inputMode="numeric"
                      value={formatNumber(parseVNDInput(overtime))}
                      onChange={(e) => setOvertime(e.target.value)}
                      disabled={!canWrite}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Phí sửa chữa (₫)</Label>
                    <Input
                      inputMode="numeric"
                      value={formatNumber(parseVNDInput(repairFee))}
                      onChange={(e) => setRepairFee(e.target.value)}
                      disabled={!canWrite}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Phí xe lẻ (₫)</Label>
                    <Input
                      inputMode="numeric"
                      value={formatNumber(parseVNDInput(extraParkingFee))}
                      onChange={(e) => setExtraParkingFee(e.target.value)}
                      disabled={!canWrite}
                    />
                  </div>
                </>
              )}
              <div className="space-y-1">
                <Label className="text-xs">Hạn thanh toán</Label>
                <DateInput value={dueDate} onChange={(e) => setDueDate(e.target.value)} disabled={!canWrite} />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Ghi chú</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} disabled={!canWrite} />
            </div>
          </CardContent>
        </Card>
        )}

        {invoice.isManual && (
          <Card>
            <CardHeader><CardTitle>Khác</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Hạn thanh toán</Label>
                  <DateInput value={dueDate} onChange={(e) => setDueDate(e.target.value)} disabled={!canWrite} />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Ghi chú</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} disabled={!canWrite} />
              </div>
            </CardContent>
          </Card>
        )}

        {canWrite && (
          <div className="flex justify-end gap-2 flex-wrap">
            {invoice.status !== "CANCELLED" && (
              <Button variant="outline" onClick={cancelInvoice}>
                <XIcon className="h-4 w-4" /> Huỷ HĐ
              </Button>
            )}
            {invoice.status === "CANCELLED" && !invoice.isManual && (
              <Button variant="outline" onClick={reopen} disabled={saving}>
                <RotateCcw className="h-4 w-4" /> Mở lại
              </Button>
            )}
            {invoice.status !== "PAID" && invoice.status !== "CANCELLED" && (
              <Button variant="outline" onClick={() => setPayOpen(true)}>
                <DollarSign className="h-4 w-4" /> Thanh toán
              </Button>
            )}
            <Button variant="gradient" onClick={save} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Lưu thay đổi
            </Button>
          </div>
        )}
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader><CardTitle>Gửi hoá đơn</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {primary?.email ? (
              <p className="text-sm text-slate-600">Email khách: <strong>{primary.email}</strong></p>
            ) : (
              <p className="text-sm text-amber-600">Khách thuê chưa có email — vui lòng cập nhật.</p>
            )}
            {canSend && primary?.email && (
              <Button variant="gradient" className="w-full" onClick={send} disabled={sending}>
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Gửi email
              </Button>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Lịch sử thanh toán</CardTitle></CardHeader>
          <CardContent>
            {invoice.payments.length === 0 ? (
              <p className="text-sm text-slate-500">Chưa có thanh toán</p>
            ) : (
              <div className="space-y-2">
                {invoice.payments.map((p) => (
                  <PaymentRow
                    key={p.id}
                    invoiceId={invoice.id}
                    payment={p}
                    canWrite={canWrite}
                    paymentMethods={paymentMethods}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <InvoiceReceiptDialog
        open={receiptOpen}
        onClose={() => setReceiptOpen(false)}
        data={receiptData}
      />

      <PayDialog
        open={payOpen}
        invoiceId={invoice.id}
        invoiceCode={invoice.code}
        remaining={remaining}
        paymentMethods={paymentMethods}
        onClose={() => setPayOpen(false)}
        onSuccess={() => { setPayOpen(false); router.refresh(); }}
      />
    </div>
  );
}

function PayDialog({
  open, invoiceId, invoiceCode, remaining, paymentMethods, onClose, onSuccess,
}: {
  open: boolean;
  invoiceId: string;
  invoiceCode: string;
  remaining: bigint;
  paymentMethods: PMOption[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [pmId, setPmId] = useState<string>("");
  const [paidAt, setPaidAt] = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);

  async function submit() {
    const a = parseVNDInput(amount);
    if (a <= 0n) return toast.error("Số tiền > 0");
    setLoading(true);
    const res = await fetch(`/api/invoices/${invoiceId}/pay`, {
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
    setAmount("");
    setPmId("");
    onSuccess();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ghi nhận thanh toán — {invoiceCode}</DialogTitle>
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
                {paymentMethods.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}{p.isCash ? " (Tiền mặt)" : ""}
                  </SelectItem>
                ))}
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

function PaymentRow({
  invoiceId, payment, canWrite, paymentMethods,
}: {
  invoiceId: string;
  payment: {
    id: string;
    amount: string;
    paidAt: string;
    transaction: {
      code: string;
      paymentMethodId: string | null;
      paymentMethod: { id: string; name: string } | null;
    };
  };
  canWrite: boolean;
  paymentMethods: PMOption[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draftAmount, setDraftAmount] = useState(payment.amount);
  const [draftPm, setDraftPm] = useState<string>(payment.transaction.paymentMethodId ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    const newAmount = parseVNDInput(draftAmount);
    if (newAmount <= 0n) return toast.error("Số tiền phải > 0");
    const amountChanged = newAmount.toString() !== payment.amount;
    const pmChanged = draftPm !== (payment.transaction.paymentMethodId ?? "");
    if (!amountChanged && !pmChanged) {
      setEditing(false);
      return;
    }
    const body: { amount?: string; paymentMethodId?: string | null } = {};
    if (amountChanged) body.amount = newAmount.toString();
    if (pmChanged) body.paymentMethodId = draftPm || null;
    setSaving(true);
    const res = await fetch(`/api/invoices/${invoiceId}/payments/${payment.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSaving(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return toast.error(err.error || "Lưu thất bại");
    }
    toast.success("Đã cập nhật");
    setEditing(false);
    router.refresh();
  }

  if (editing) {
    return (
      <div className="space-y-2 text-sm">
        <div className="space-y-1">
          <Label className="text-[11px] text-slate-500">Số tiền</Label>
          <Input
            inputMode="numeric"
            value={formatNumber(parseVNDInput(draftAmount))}
            onChange={(e) => setDraftAmount(e.target.value)}
            className="h-8 text-sm"
            autoFocus
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[11px] text-slate-500">Tài khoản TT</Label>
          <select
            value={draftPm}
            onChange={(e) => setDraftPm(e.target.value)}
            className="w-full h-8 rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="">— Chưa chọn —</option>
            {paymentMethods.map((pm) => (
              <option key={pm.id} value={pm.id}>
                {pm.name}{pm.isCash ? " (Tiền mặt)" : ""}
              </option>
            ))}
          </select>
        </div>
        <div className="flex justify-end gap-1">
          <button
            onClick={() => {
              setDraftAmount(payment.amount);
              setDraftPm(payment.transaction.paymentMethodId ?? "");
              setEditing(false);
            }}
            className="text-slate-400 hover:text-slate-600 p-1"
            aria-label="Huỷ"
          >
            <XIcon className="h-4 w-4" />
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="text-emerald-600 hover:text-emerald-800 disabled:opacity-50 p-1"
            aria-label="Lưu"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          </button>
        </div>
      </div>
    );
  }

  const pmName = payment.transaction.paymentMethod?.name;
  return (
    <div className="flex justify-between items-start text-sm gap-2">
      <div className="min-w-0 flex-1">
        <div className="font-medium">{formatVND(BigInt(payment.amount))}</div>
        <div className="text-xs text-slate-500">
          {formatDateVN(payment.paidAt)} · <span className="font-mono">{payment.transaction.code}</span>
        </div>
        {pmName && (
          <div className="text-xs text-slate-500 mt-0.5">{pmName}</div>
        )}
      </div>
      {canWrite && (
        <button
          onClick={() => setEditing(true)}
          className="text-slate-400 hover:text-primary p-1 shrink-0"
          aria-label="Sửa thanh toán"
        >
          <Edit2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

function Row({ label, value, bold, positive, danger }: { label: string; value: string; bold?: boolean; positive?: boolean; danger?: boolean }) {
  return (
    <div className="flex justify-between items-baseline">
      <span className="text-sm text-slate-600">{label}</span>
      <span className={`${bold ? "font-bold text-base" : "text-sm"} ${positive ? "text-emerald-700" : ""} ${danger ? "text-rose-600" : ""}`}>{value}</span>
    </div>
  );
}

// Fee row that shows base + (optional) VAT as a single line. When VAT > 0 the
// value column renders the gross amount and a subtle "+VAT" hint.
function FeeRow({ label, base, vat }: { label: string; base: bigint; vat: bigint }) {
  const gross = base + vat;
  return (
    <div className="flex justify-between items-baseline">
      <span className="text-sm text-slate-600">
        {label}
        {vat > 0n && <span className="text-[10px] text-primary ml-1.5 font-medium">+VAT</span>}
      </span>
      <span className="text-sm">
        {formatVND(gross)}
        {vat > 0n && (
          <span className="text-[10px] text-slate-400 ml-1">
            ({formatVND(base)} + {formatVND(vat)})
          </span>
        )}
      </span>
    </div>
  );
}

// Electricity input + photo upload for a single InvoiceElectricityLine row.
function ElecLinePhotoField({
  invoiceId, lineId, which, label, photoUrl, value, onChange, disabled,
}: {
  invoiceId: string;
  lineId: string;
  which: "start" | "end";
  label: string;
  photoUrl: string | null;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [localPhoto, setLocalPhoto] = useState(photoUrl);
  const [zoom, setZoom] = useState(false);
  const [removing, setRemoving] = useState(false);

  async function saveValue(val: string) {
    const num = val === "" ? null : Number(val);
    await fetch(`/api/invoices/${invoiceId}/electricity-lines/${lineId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(which === "start" ? { start: num } : { end: num }),
    });
    router.refresh();
  }

  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) { toast.error("Ảnh quá lớn (>10MB)."); e.target.value = ""; return; }
    setUploading(true);
    const fd = new FormData();
    fd.append("file", f);
    fd.append("which", which);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/electricity-lines/${lineId}/photo`, { method: "POST", body: fd });
      if (!res.ok) { toast.error("Upload thất bại"); return; }
      const { url, reading } = await res.json();
      setLocalPhoto(url);
      if (reading != null) {
        onChange(String(reading));
        await saveValue(String(reading));
        toast.success(`AI đọc được số: ${reading}`);
      } else {
        toast.success("Đã upload ảnh");
      }
      router.refresh();
    } catch { toast.error("Lỗi mạng. Thử lại."); }
    finally { setUploading(false); e.target.value = ""; }
  }

  async function removePhoto() {
    if (!confirm("Xoá ảnh này?")) return;
    setRemoving(true);
    const res = await fetch(`/api/invoices/${invoiceId}/electricity-lines/${lineId}/photo?which=${which}`, { method: "DELETE" });
    setRemoving(false);
    if (!res.ok) return toast.error("Xoá thất bại");
    setLocalPhoto(null);
    router.refresh();
  }

  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Input
        type="number"
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={(e) => saveValue(e.target.value)}
        disabled={disabled}
        placeholder="0"
      />
      {localPhoto ? (
        <div className="relative rounded-lg overflow-hidden border bg-slate-50 group">
          <button type="button" onClick={() => setZoom(true)} className="block w-full cursor-zoom-in h-[280px] flex items-center justify-center">
            <img src={localPhoto} alt={label} className="w-full h-full object-contain group-hover:opacity-90 transition-opacity" />
          </button>
          {!disabled && (
            <button type="button" onClick={removePhoto} disabled={removing}
              className="absolute top-1.5 right-1.5 h-7 w-7 rounded-full bg-black/60 hover:bg-rose-600 text-white flex items-center justify-center transition-colors disabled:opacity-50"
            >
              {removing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            </button>
          )}
        </div>
      ) : null}
      <ImageLightbox src={zoom ? localPhoto : null} alt={label} onClose={() => setZoom(false)} />
      {!disabled && (
        <label className={"flex items-center justify-center gap-1.5 h-9 px-3 rounded-xl border bg-background text-sm font-medium cursor-pointer hover:bg-accent/10 hover:text-accent transition-colors w-full" + (uploading ? " opacity-50 pointer-events-none" : "")}>
          <input type="file" accept="image/*" className="sr-only" onChange={upload} disabled={uploading} />
          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
          {localPhoto ? "Thay ảnh công tơ" : "Ảnh công tơ"}
        </label>
      )}
    </div>
  );
}

function PhotoUploadField({
  invoiceId, which, label, photoUrl, value, onChange, disabled,
}: {
  invoiceId: string;
  which: "start" | "end";
  label: string;
  photoUrl: string | null;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [localPhoto, setLocalPhoto] = useState(photoUrl);
  const [zoom, setZoom] = useState(false);
  const [removing, setRemoving] = useState(false);

  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) {
      toast.error("Ảnh quá lớn (>10MB). Hãy chọn ảnh nhỏ hơn.");
      e.target.value = "";
      return;
    }
    setUploading(true);
    const fd = new FormData();
    fd.append("file", f);
    fd.append("which", which);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/electricity-photo`, { method: "POST", body: fd });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || `Upload thất bại (${res.status})`);
        return;
      }
      const { url, reading } = await res.json();
      setLocalPhoto(url);
      if (reading != null) {
        onChange(String(reading));
        toast.success(`AI đọc được số: ${reading}`);
      } else {
        toast.success("Đã upload ảnh");
      }
      router.refresh();
    } catch (err) {
      toast.error("Lỗi mạng. Thử lại.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function removePhoto() {
    if (!confirm("Xoá ảnh này?")) return;
    setRemoving(true);
    const res = await fetch(`/api/invoices/${invoiceId}/electricity-photo?which=${which}`, { method: "DELETE" });
    setRemoving(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return toast.error(err.error || "Xoá thất bại");
    }
    setLocalPhoto(null);
    toast.success("Đã xoá ảnh");
    router.refresh();
  }

  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Input type="number" inputMode="numeric" value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} placeholder="0" />
      {localPhoto ? (
        <div className="relative rounded-lg overflow-hidden border bg-slate-50 group">
          <button
            type="button"
            onClick={() => setZoom(true)}
            className="block w-full cursor-zoom-in h-[280px] flex items-center justify-center"
          >
            <img src={localPhoto} alt={label} className="w-full h-full object-contain group-hover:opacity-90 transition-opacity" />
          </button>
          {!disabled && (
            <button
              type="button"
              onClick={removePhoto}
              disabled={removing}
              className="absolute top-1.5 right-1.5 h-7 w-7 rounded-full bg-black/60 hover:bg-rose-600 text-white flex items-center justify-center transition-colors disabled:opacity-50"
              aria-label="Xoá ảnh"
              title="Xoá ảnh"
            >
              {removing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            </button>
          )}
        </div>
      ) : null}
      <ImageLightbox src={zoom ? localPhoto : null} alt={label} onClose={() => setZoom(false)} />
      {!disabled && (
        // Use a <label> wrapping the file input → native click flows through,
        // works reliably on iOS PWA + Android Chrome where programmatic
        // .click() on a hidden input is sometimes blocked.
        <label
          className={
            "flex items-center justify-center gap-1.5 h-9 px-3 rounded-xl border bg-background text-sm font-medium cursor-pointer hover:bg-accent/10 hover:text-accent transition-colors w-full" +
            (uploading ? " opacity-50 pointer-events-none" : "")
          }
        >
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={upload}
            disabled={uploading}
          />
          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
          {localPhoto ? "Thay ảnh công tơ" : "Ảnh công tơ"}
        </label>
      )}
    </div>
  );
}
