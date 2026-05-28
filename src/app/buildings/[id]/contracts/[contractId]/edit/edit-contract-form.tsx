"use client";
import { useState, useMemo, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save, X, Plus, Trash2, Upload, FileText, UserPlus, XCircle, RefreshCw, Edit, Sparkles, Download, Printer, Share2, Maximize2, Receipt, Check, ArrowRightLeft } from "lucide-react";
import { toast } from "sonner";
import { contractEndDate, parseVNDInput, formatNumber, formatVND, customerDisplayName } from "@/lib/utils";
import { ImageLightbox } from "@/components/ui/image-lightbox";
import { CCCDScanner, type CCCDData } from "@/components/contract/cccd-scanner";
import { PdfViewer } from "@/components/contract/pdf-viewer";

type VatFeeKey = "electricity" | "parking" | "overtime" | "repair" | "extraParking";

type ContractCustomer = {
  id: string;
  isPrimary: boolean;
  orderIdx: number;
  customer: {
    id: string;
    type: "INDIVIDUAL" | "COMPANY";
    fullName: string | null;
    companyName: string | null;
    idNumber: string | null;
    taxNumber: string | null;
    phone: string | null;
    email: string | null;
    licensePlate: string | null;
    idCardFrontUrl: string | null;
    idCardBackUrl: string | null;
    businessLicenseUrls: string[];
    representativeName: string | null;
    representativeTitle: string | null;
  };
};

type Contract = {
  id: string;
  code: string;
  status: string;
  contractFileUrl: string | null;
  generatedDocxUrl: string | null;
  startDate: string;
  endDate: string;
  termMonths: number;
  paymentDay: number;
  rentPaymentCycleMonths: number;
  monthlyRent: string;
  vatRate: number;
  vatApplicableFees: string[];
  depositAmount: string;
  electricityPricePerKwh: string;
  parkingCount: number;
  parkingFeePerVehicle: string;
  serviceFeeAmount: string;
  waterPricePerPerson: string;
  isOpenEnded: boolean;
  notes: string | null;
  roomId: string;
  room: { number: string };
  secondaryRooms: { room: { number: string } }[];
  yearlyRents: { yearIndex: number; rent: string }[];
  customers: ContractCustomer[];
  temporaryResidenceStatus: "NOT_REGISTERED" | "SUBMITTED" | "REGISTERED";
  temporaryResidenceExpiresAt: string | null;
  temporaryResidenceIsIndefinite: boolean;
};

type BrokerFee = {
  id: string;
  code: string;
  date: string;
  amount: string;
  content: string;
  paymentMethodId: string | null;
  paymentMethod: { name: string } | null;
};

export function EditContractForm({
  buildingId,
  buildingType,
  contract,
  buildingSetting,
  brokerCategoryId,
  paymentMethods,
  brokerFees,
  availableRooms,
}: {
  buildingId: string;
  buildingType: "CHDV" | "VP";
  contract: Contract;
  buildingSetting: { electricityPricePerKwh: string; parkingFeePerVehicle: string } | null;
  brokerCategoryId: string | null;
  paymentMethods: { id: string; name: string }[];
  brokerFees: BrokerFee[];
  availableRooms?: { id: string; number: string }[];
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const [startDate, setStartDate] = useState(contract.startDate.slice(0, 10));
  const [termMonths, setTermMonths] = useState(contract.termMonths);
  const [endDate, setEndDate] = useState(contract.endDate.slice(0, 10));

  // Auto-recompute endDate only when termMonths changes, not when startDate
  // changes alone — preserves fixed end dates (e.g. room-transfer contracts).
  const prevTermMonths = useRef(contract.termMonths);
  useEffect(() => {
    if (termMonths !== prevTermMonths.current) {
      prevTermMonths.current = termMonths;
      if (startDate) setEndDate(contractEndDate(new Date(startDate), termMonths).toISOString().slice(0, 10));
    }
  }, [termMonths, startDate]);
  const [paymentDay, setPaymentDay] = useState(contract.paymentDay);
  const [rentPaymentCycleMonths, setRentPaymentCycleMonths] = useState(contract.rentPaymentCycleMonths ?? 1);
  const [monthlyRent, setMonthlyRent] = useState(contract.monthlyRent);
  const [vatRate, setVatRate] = useState(contract.vatRate * 100); // store as percent in UI
  const [deposit, setDeposit] = useState(contract.depositAmount);
  const [vatApplicableFees, setVatApplicableFees] = useState<VatFeeKey[]>(
    (contract.vatApplicableFees ?? []) as VatFeeKey[],
  );
  const [parkingCount, setParkingCount] = useState(contract.parkingCount);
  // Default elec/parking from building setting (shows current toà values).
  // If contract has its own override (non-zero), keep that; else use building setting.
  const [parkingFeePerVehicle, setParkingFeePerVehicle] = useState(
    contract.parkingFeePerVehicle === "0" && buildingSetting?.parkingFeePerVehicle
      ? buildingSetting.parkingFeePerVehicle
      : contract.parkingFeePerVehicle,
  );
  const [serviceFee, setServiceFee] = useState(contract.serviceFeeAmount);
  const [waterPerPerson, setWaterPerPerson] = useState(contract.waterPricePerPerson);
  const [electricityPricePerKwh, setElecPrice] = useState(
    contract.electricityPricePerKwh === "0" && buildingSetting?.electricityPricePerKwh
      ? buildingSetting.electricityPricePerKwh
      : contract.electricityPricePerKwh,
  );
  const [notes, setNotes] = useState(contract.notes ?? "");
  const [yearlyRents, setYearlyRents] = useState(
    contract.yearlyRents.map((y) => ({ yearIndex: y.yearIndex, rent: y.rent })),
  );
  // Tạm trú (CHDV only)
  const [trStatus, setTrStatus] = useState<"NOT_REGISTERED" | "SUBMITTED" | "REGISTERED">(
    contract.temporaryResidenceStatus ?? "NOT_REGISTERED",
  );
  const [trExpiresAt, setTrExpiresAt] = useState(
    contract.temporaryResidenceExpiresAt ? contract.temporaryResidenceExpiresAt.slice(0, 10) : "",
  );
  const [trIndefinite, setTrIndefinite] = useState(contract.temporaryResidenceIsIndefinite ?? false);

  const isTerminated = ["TERMINATED", "TERMINATED_LOST_DEPOSIT"].includes(contract.status);

  // Upload + view contract file
  const [contractFileUrl, setContractFileUrl] = useState(contract.contractFileUrl);
  const [uploading, setUploading] = useState(false);
  const [removingFile, setRemovingFile] = useState(false);
  const [contractFileZoom, setContractFileZoom] = useState(false);
  const [contractFileFullscreen, setContractFileFullscreen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  async function uploadFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("file", f);
    const res = await fetch(`/api/contracts/${contract.id}/upload`, { method: "POST", body: fd });
    setUploading(false);
    if (!res.ok) return toast.error("Upload thất bại");
    const { url } = await res.json();
    setContractFileUrl(url);
    toast.success("Đã upload");
  }
  async function removeFile() {
    if (!confirm("Xoá file hợp đồng đã upload?")) return;
    setRemovingFile(true);
    const res = await fetch(`/api/contracts/${contract.id}/upload`, { method: "DELETE" });
    setRemovingFile(false);
    if (!res.ok) return toast.error("Xoá thất bại");
    setContractFileUrl(null);
    toast.success("Đã xoá file");
  }
  const fileExt = contractFileUrl ? contractFileUrl.split(".").pop()?.toLowerCase() : null;
  const isPdf = fileExt === "pdf";
  const isImage = fileExt && ["png", "jpg", "jpeg", "webp"].includes(fileExt);

  // Broker fee → tự tạo phiếu chi
  const [brokerFee, setBrokerFee] = useState("");
  const [brokerPmId, setBrokerPmId] = useState("");
  const [brokerLoading, setBrokerLoading] = useState(false);
  async function recordBrokerFee() {
    const a = parseVNDInput(brokerFee);
    if (a <= 0n) return toast.error("Nhập số tiền > 0");
    if (!brokerPmId) return toast.error("Chọn Tài khoản TT");
    setBrokerLoading(true);
    const res = await fetch(`/api/buildings/${buildingId}/transactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: new Date().toISOString(),
        type: "EXPENSE",
        amount: a.toString(),
        content: `Phí môi giới HĐ ${contract.code}`,
        categoryId: brokerCategoryId ?? undefined,
        partyKind: "MOI_GIOI",
        roomId: contract.roomId,
        paymentMethodId: brokerPmId,
        countInBR: true,
        notes: `Liên quan HĐ ${contract.code}`,
      }),
    });
    setBrokerLoading(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const msg = err.error || `Lỗi ${res.status}`;
      return toast.error(`Ghi nhận phí môi giới thất bại: ${msg}`, { duration: 8000 });
    }
    toast.success(`Đã ghi nhận phiếu chi ${formatVND(a)} (Phí môi giới)`);
    setBrokerFee("");
    setBrokerPmId("");
    router.refresh();
  }

  const rentBigInt = parseVNDInput(monthlyRent);
  const preVATAmount = vatRate > 0 ? (rentBigInt * 100n) / BigInt(100 + Math.round(vatRate)) : rentBigInt;
  const vatAmount = rentBigInt - preVATAmount;

  const [addCustomerOpen, setAddCustomerOpen] = useState(false);
  const [terminateOpen, setTerminateOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [extendOpen, setExtendOpen] = useState(false);
  const [genInvoiceOpen, setGenInvoiceOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);

  async function handleDelete() {
    setActionBusy(true);
    const res = await fetch(`/api/contracts/${contract.id}`, { method: "DELETE" });
    setActionBusy(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return toast.error(err.error || "Có lỗi");
    }
    toast.success(`Đã xoá HĐ ${contract.code}`);
    router.push(`/buildings/${buildingId}/contracts`);
    router.refresh();
  }

  function addYearlyRent() {
    const nextIdx = (yearlyRents.length > 0 ? Math.max(...yearlyRents.map((y) => y.yearIndex)) : 0) + 1;
    setYearlyRents([...yearlyRents, { yearIndex: nextIdx, rent: monthlyRent }]);
  }
  function removeYearlyRent(idx: number) {
    setYearlyRents(yearlyRents.filter((y) => y.yearIndex !== idx));
  }
  function updateYearlyRent(idx: number, value: string) {
    setYearlyRents(yearlyRents.map((y) => (y.yearIndex === idx ? { ...y, rent: parseVNDInput(value).toString() } : y)));
  }

  async function submit() {
    if (!startDate) return toast.error("Chọn ngày bắt đầu");
    if (rentBigInt <= 0n) return toast.error("Nhập giá thuê");

    setSubmitting(true);
    const payload = {
      startDate,
      endDate,
      termMonths,
      paymentDay,
      monthlyRent: rentBigInt.toString(),
      vatRate: vatRate / 100,
      vatApplicableFees,
      depositAmount: parseVNDInput(deposit).toString(),
      parkingCount,
      parkingFeePerVehicle: parseVNDInput(parkingFeePerVehicle).toString(),
      serviceFeeAmount: parseVNDInput(serviceFee).toString(),
      waterPricePerPerson: parseVNDInput(waterPerPerson).toString(),
      electricityPricePerKwh: parseVNDInput(electricityPricePerKwh).toString(),
      notes,
      rentPaymentCycleMonths,
      yearlyRents: yearlyRents.map((y) => ({
        yearIndex: y.yearIndex,
        rent: parseVNDInput(y.rent).toString(),
      })),
      ...(buildingType === "CHDV"
        ? {
            temporaryResidenceStatus: trStatus,
            temporaryResidenceIsIndefinite: trStatus === "REGISTERED" ? trIndefinite : false,
            temporaryResidenceExpiresAt:
              trStatus === "REGISTERED" && !trIndefinite && trExpiresAt ? trExpiresAt : null,
          }
        : {}),
    };

    const res = await fetch(`/api/contracts/${contract.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSubmitting(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return toast.error(err.error || "Lưu thất bại");
    }
    toast.success("Đã lưu thay đổi");
    // Stay on the detail page so the user can keep editing without
    // bouncing back to the list.
    router.refresh();
  }

  return (
    <div className="grid lg:grid-cols-3 gap-4 lg:gap-6 w-full max-w-full">
      <div className="lg:col-span-1 space-y-4 min-w-0">
        <Card>
          <CardHeader>
            <CardTitle>Thông tin chung</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Mã HĐ" value={contract.code} />
            <Row label="Phòng" value={[contract.room.number, ...contract.secondaryRooms.map((sr) => sr.room.number)].join(", ")} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>Khách thuê ({contract.customers.length})</CardTitle>
            {!isTerminated && (
              <Button size="sm" variant="outline" onClick={() => setAddCustomerOpen(true)}>
                <UserPlus className="h-3.5 w-3.5" /> Thêm
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-2">
            {contract.customers.map((cc) => (
              <CustomerItem
                key={cc.id}
                cc={cc}
                contractId={contract.id}
                canRemove={!isTerminated && contract.customers.length > 1}
                onChanged={() => router.refresh()}
              />
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tóm tắt giá</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <Row label="Giá thuê sau VAT" value={formatVND(rentBigInt)} bold />
            {vatRate > 0 && (
              <>
                <Row label="Giá thuê chưa VAT" value={formatVND(preVATAmount)} />
                <Row label={`VAT (${vatRate}%)`} value={formatVND(vatAmount)} />
              </>
            )}
            <Row label="Tiền cọc" value={formatVND(parseVNDInput(deposit))} />
          </CardContent>
        </Card>

        <GeneratedContractCard
          contractId={contract.id}
          generatedDocxUrl={contract.generatedDocxUrl}
        />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-4 w-4" /> File hợp đồng
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {contractFileUrl ? (
              <div className="relative">
                {isPdf ? (
                  <iframe
                    src={contractFileUrl}
                    className="w-full h-72 rounded-lg border bg-slate-50"
                    title="Hợp đồng PDF"
                  />
                ) : isImage ? (
                  <button
                    type="button"
                    onClick={() => setContractFileZoom(true)}
                    className="block w-full cursor-zoom-in"
                  >
                    <img src={contractFileUrl} alt="HĐ" className="w-full rounded-lg border" />
                  </button>
                ) : (
                  <a
                    href={contractFileUrl}
                    target="_blank"
                    rel="noopener"
                    className="text-sm text-primary underline flex items-center gap-1"
                  >
                    <FileText className="h-4 w-4" /> Mở file
                  </a>
                )}
                {isImage && (
                  <button
                    type="button"
                    onClick={() => setContractFileZoom(true)}
                    className="absolute top-2 right-10 inline-flex items-center gap-1 h-7 px-2 rounded-md bg-black/60 hover:bg-black/75 text-white text-[11px] font-medium"
                    aria-label="Mở rộng"
                  >
                    <Maximize2 className="h-3 w-3" /> Mở rộng
                  </button>
                )}
                {isPdf && (
                  <button
                    type="button"
                    onClick={() => setContractFileFullscreen(true)}
                    className="absolute top-2 right-10 inline-flex items-center gap-1 h-7 px-2 rounded-md bg-black/60 hover:bg-black/75 text-white text-[11px] font-medium"
                    aria-label="Mở rộng"
                  >
                    <Maximize2 className="h-3 w-3" /> Mở rộng
                  </button>
                )}
                <button
                  type="button"
                  onClick={removeFile}
                  disabled={removingFile || isTerminated}
                  className="absolute top-1.5 right-1.5 h-7 w-7 rounded-full bg-black/60 hover:bg-rose-600 text-white flex items-center justify-center transition-colors disabled:opacity-50"
                  aria-label="Xoá file"
                  title="Xoá file"
                >
                  {removingFile ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                </button>
              </div>
            ) : (
              <p className="text-xs text-slate-500">Chưa có file. Upload PDF hoặc ảnh HĐ đã ký.</p>
            )}
            <ImageLightbox src={contractFileZoom && isImage ? contractFileUrl : null} alt="Hợp đồng" onClose={() => setContractFileZoom(false)} />
            <Dialog open={contractFileFullscreen} onOpenChange={(o) => !o && setContractFileFullscreen(false)}>
              <DialogContent className="max-w-4xl p-0 overflow-hidden h-[90vh] flex flex-col">
                <div className="flex items-center pl-4 pr-12 py-2.5 border-b bg-white shrink-0">
                  <h3 className="text-sm font-semibold">File hợp đồng</h3>
                </div>
                <div className="flex-1 min-h-0">
                  {contractFileUrl && isPdf && <PdfViewer url={contractFileUrl} />}
                </div>
              </DialogContent>
            </Dialog>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              className="hidden"
              onChange={uploadFile}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || isTerminated}
              className="w-full"
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {contractFileUrl ? "Thay file" : "Upload HĐ"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Phí môi giới</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-[11px] text-slate-500">
              Khi click &ldquo;Ghi nhận&rdquo; sẽ tự tạo phiếu chi với loại &ldquo;Phí môi giới&rdquo; + nội dung kèm mã HĐ.
            </p>
            {brokerFees.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-xs">Đã ghi nhận</Label>
                <div className="space-y-1">
                  {brokerFees.map((bf) => (
                    <BrokerFeeItem key={bf.id} fee={bf} paymentMethods={paymentMethods} />
                  ))}
                </div>
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs">{brokerFees.length > 0 ? "Ghi nhận thêm (₫)" : "Số tiền (₫)"}</Label>
              <Input
                inputMode="numeric"
                value={brokerFee ? formatNumber(parseVNDInput(brokerFee)) : ""}
                onChange={(e) => setBrokerFee(e.target.value)}
                placeholder="0"
                disabled={isTerminated}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Tài khoản TT <span className="text-rose-500">*</span></Label>
              <Select value={brokerPmId} onValueChange={setBrokerPmId} disabled={isTerminated}>
                <SelectTrigger><SelectValue placeholder="Chọn tài khoản" /></SelectTrigger>
                <SelectContent>
                  {paymentMethods.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="gradient"
              size="sm"
              onClick={recordBrokerFee}
              disabled={isTerminated || brokerLoading || parseVNDInput(brokerFee) <= 0n || !brokerPmId}
              className="w-full"
            >
              {brokerLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              Ghi nhận
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="lg:col-span-2 space-y-4 min-w-0">
        <Card>
          <CardHeader>
            <CardTitle>Thông tin hợp đồng</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Ngày bắt đầu" required>
                <DateInput value={startDate} onChange={(e) => setStartDate(e.target.value)} disabled={isTerminated} />
              </Field>
              <Field label="Thời hạn (tháng)">
                <Input
                  type="number"
                  min={1}
                  max={120}
                  value={termMonths}
                  onChange={(e) => setTermMonths(Number(e.target.value))}
                  disabled={isTerminated}
                />
              </Field>
              <Field label="Ngày kết thúc (tự động)">
                <DateInput value={endDate} disabled />
              </Field>
              <Field label="Ngày thanh toán hàng tháng">
                <Input
                  type="number"
                  min={1}
                  max={28}
                  value={paymentDay}
                  onChange={(e) => setPaymentDay(Number(e.target.value))}
                  disabled={isTerminated}
                />
              </Field>
              {buildingType === "VP" && (
                <Field label="Chu kỳ thanh toán tiền thuê">
                  <Select value={String(rentPaymentCycleMonths)} onValueChange={(v) => setRentPaymentCycleMonths(Number(v))} disabled={isTerminated}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Hàng tháng (1 tháng/lần)</SelectItem>
                      <SelectItem value="2">2 tháng/lần</SelectItem>
                      <SelectItem value="3">3 tháng/lần (quý)</SelectItem>
                      <SelectItem value="6">6 tháng/lần</SelectItem>
                      <SelectItem value="12">12 tháng/lần (năm)</SelectItem>
                    </SelectContent>
                  </Select>
                  {rentPaymentCycleMonths > 1 && (
                    <p className="text-[11px] text-slate-500 mt-1">Phí dịch vụ vẫn tính hàng tháng</p>
                  )}
                </Field>
              )}
              <Field label="Tiền cọc (₫)">
                <VNDInput value={deposit} onChange={setDeposit} disabled={isTerminated} />
              </Field>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label={buildingType === "VP" ? "Giá thuê / tháng (sau VAT, đã gồm VAT)" : "Giá thuê / tháng"} required>
                <VNDInput value={monthlyRent} onChange={setMonthlyRent} disabled={isTerminated} />
                {vatRate > 0 && rentBigInt > 0n && (
                  <p className="text-[11px] text-slate-500 mt-1">
                    = {formatVND(preVATAmount)} chưa VAT + {formatVND(vatAmount)} VAT
                  </p>
                )}
              </Field>
              {buildingType === "VP" && (
                <Field label="VAT (%)">
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    step="0.1"
                    value={vatRate}
                    onChange={(e) => setVatRate(Number(e.target.value))}
                    disabled={isTerminated}
                  />
                </Field>
              )}
            </div>
            {buildingType === "VP" && (
              <VatFeesPickerField
                value={vatApplicableFees}
                onChange={setVatApplicableFees}
                vatRate={vatRate}
                disabled={isTerminated}
              />
            )}
          </CardContent>
        </Card>

        {buildingType === "VP" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Giá thuê theo năm (cho HĐ {">"}1 năm)</span>
              {!isTerminated && (
                <Button size="sm" variant="outline" onClick={addYearlyRent}>
                  <Plus className="h-3.5 w-3.5" /> Thêm năm
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {yearlyRents.length === 0 ? (
              <p className="text-xs text-slate-500">Chưa có. Bấm Thêm năm nếu HĐ trên 1 năm có giá thuê khác nhau. Khi đến năm, hệ thống tự dùng giá năm đó để xuất hoá đơn.</p>
            ) : (
              <div className="space-y-3">
                {yearlyRents
                  .sort((a, b) => a.yearIndex - b.yearIndex)
                  .map((y) => {
                    const r = parseVNDInput(y.rent);
                    const yVAT = (r * BigInt(Math.round(vatRate * 100))) / 10000n;
                    const yPre = r - yVAT;
                    return (
                      <div key={y.yearIndex} className="rounded-xl border p-3 space-y-2">
                        <div className="flex items-center gap-2">
                          <Label className="w-20 text-xs">Năm {y.yearIndex}</Label>
                          <div className="flex-1">
                            <VNDInput value={y.rent} onChange={(v) => updateYearlyRent(y.yearIndex, v)} disabled={isTerminated} />
                          </div>
                          {!isTerminated && (
                            <button
                              onClick={() => removeYearlyRent(y.yearIndex)}
                              className="text-rose-500 hover:text-rose-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                        {vatRate > 0 && r > 0n && (
                          <p className="text-[11px] text-slate-500 pl-[88px]">
                            Sau VAT: {formatVND(r)} = {formatVND(yPre)} chưa VAT + {formatVND(yVAT)} VAT
                          </p>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}
          </CardContent>
        </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Phí điện, xe, dịch vụ</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {buildingSetting && (
              <p className="text-[11px] text-slate-500">
                Mặc định theo Cài đặt toà nhà:
                {" "}giá điện <strong>{formatNumber(parseVNDInput(buildingSetting.electricityPricePerKwh))}đ/kWh</strong>,
                {" "}phí xe <strong>{formatNumber(parseVNDInput(buildingSetting.parkingFeePerVehicle))}đ/xe</strong>.
                {" "}Có thể chỉnh tay nếu HĐ này khác.
              </p>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Đơn giá điện (₫/kWh)">
                <VNDInput value={electricityPricePerKwh} onChange={setElecPrice} disabled={isTerminated} />
              </Field>
              <Field label="Số xe gửi">
                <Input
                  type="number"
                  min={0}
                  value={parkingCount}
                  onChange={(e) => setParkingCount(Number(e.target.value))}
                  disabled={isTerminated}
                />
              </Field>
              <Field label="Phí gửi xe (₫/xe/tháng)">
                <VNDInput value={parkingFeePerVehicle} onChange={setParkingFeePerVehicle} disabled={isTerminated} />
              </Field>
              <Field label="Phí dịch vụ (₫/tháng)">
                <VNDInput value={serviceFee} onChange={setServiceFee} disabled={isTerminated} />
              </Field>
              {buildingType === "CHDV" && (
                <Field label="Tiền nước (₫/người/tháng)">
                  <VNDInput value={waterPerPerson} onChange={setWaterPerPerson} disabled={isTerminated} />
                </Field>
              )}
            </div>
          </CardContent>
        </Card>

        {buildingType === "CHDV" && (
          <Card>
            <CardHeader>
              <CardTitle>Tạm trú</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Tình trạng">
                  <Select value={trStatus} onValueChange={(v) => setTrStatus(v as typeof trStatus)} disabled={isTerminated}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NOT_REGISTERED">Chưa đăng ký</SelectItem>
                      <SelectItem value="SUBMITTED">Đã gửi hồ sơ</SelectItem>
                      <SelectItem value="REGISTERED">Đã đăng ký</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                {trStatus === "REGISTERED" && (
                  <Field label="Thời hạn">
                    <DateInput
                      value={trExpiresAt}
                      disabled={trIndefinite || isTerminated}
                      onChange={(e) => setTrExpiresAt(e.target.value)}
                    />
                  </Field>
                )}
              </div>
              {trStatus === "REGISTERED" && (
                <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                    checked={trIndefinite}
                    disabled={isTerminated}
                    onChange={(e) => {
                      setTrIndefinite(e.target.checked);
                      if (e.target.checked) setTrExpiresAt("");
                    }}
                  />
                  Vô thời hạn
                </label>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Ghi chú</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={5} disabled={isTerminated} />
          </CardContent>
        </Card>

        {!isTerminated && (
          <div className="flex flex-wrap justify-between gap-2">
            <div className="flex flex-wrap gap-2">
              {contract.status === "ACTIVE" && (
                <Button variant="outline" onClick={() => setGenInvoiceOpen(true)}>
                  <Receipt className="h-4 w-4" /> Tạo hoá đơn
                </Button>
              )}
              <Button variant="outline" onClick={() => setExtendOpen(true)}>
                <RefreshCw className="h-4 w-4" /> Gia hạn
              </Button>
              {buildingType === "CHDV" && contract.status === "ACTIVE" && (
                <Button variant="outline" onClick={() => setTransferOpen(true)}>
                  <ArrowRightLeft className="h-4 w-4" /> Chuyển phòng
                </Button>
              )}
              {(contract.status === "ACTIVE" || contract.status === "EXPIRED") && (
                <Button variant="outline" onClick={() => setTerminateOpen(true)} className="text-rose-600 border-rose-200 hover:bg-rose-50">
                  <XCircle className="h-4 w-4" /> Kết thúc
                </Button>
              )}
              <Button variant="outline" onClick={() => setDeleteOpen(true)} className="text-rose-600 border-rose-200 hover:bg-rose-50">
                <Trash2 className="h-4 w-4" /> Xoá HĐ
              </Button>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => router.push(`/buildings/${buildingId}/contracts`)}>
                <X className="h-4 w-4" /> Huỷ
              </Button>
              <Button variant="gradient" onClick={submit} disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Lưu thay đổi
              </Button>
            </div>
          </div>
        )}
      </div>

      <AddCustomerDialog
        open={addCustomerOpen}
        onClose={() => setAddCustomerOpen(false)}
        contractId={contract.id}
        defaultType={buildingType === "VP" ? "COMPANY" : "INDIVIDUAL"}
        onAdded={() => router.refresh()}
      />

      <TerminateContractDialog
        open={terminateOpen}
        onClose={() => setTerminateOpen(false)}
        contract={contract}
        paymentMethods={paymentMethods}
        onDone={() => { router.push(`/buildings/${buildingId}/contracts`); router.refresh(); }}
      />

      <ExtendContractDialog
        open={extendOpen}
        onClose={() => setExtendOpen(false)}
        contract={contract}
        onDone={() => router.refresh()}
      />

      <GenerateInvoiceDialog
        open={genInvoiceOpen}
        onClose={() => setGenInvoiceOpen(false)}
        contract={contract}
        buildingId={buildingId}
      />

      {buildingType === "CHDV" && (
        <TransferRoomDialog
          open={transferOpen}
          onClose={() => setTransferOpen(false)}
          contract={contract}
          availableRooms={availableRooms ?? []}
          paymentMethods={paymentMethods}
          buildingId={buildingId}
        />
      )}

      <Dialog open={deleteOpen} onOpenChange={(o) => !o && setDeleteOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-rose-600">Xoá hợp đồng</DialogTitle>
          </DialogHeader>
          <div className="text-sm space-y-2">
            <p>Xoá vĩnh viễn hợp đồng <strong className="font-mono">{contract.code}</strong> không?</p>
            <p className="text-xs text-slate-500">
              Sẽ xoá kèm tất cả hoá đơn của HĐ này. Giao dịch liên quan sẽ tự gỡ liên kết invoice (vẫn giữ được record).
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteOpen(false)}>Huỷ</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={actionBusy}>
              {actionBusy && <Loader2 className="h-4 w-4 animate-spin" />}
              Xoá vĩnh viễn
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function GenerateInvoiceDialog({
  open, onClose, contract, buildingId,
}: {
  open: boolean;
  onClose: () => void;
  contract: { id: string; code: string; startDate: string };
  buildingId: string;
}) {
  const router = useRouter();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [loading, setLoading] = useState(false);

  const startYear = new Date(contract.startDate).getFullYear();
  const years: number[] = [];
  for (let y = startYear; y <= now.getFullYear() + 1; y++) years.push(y);

  async function submit() {
    setLoading(true);
    const res = await fetch(`/api/contracts/${contract.id}/generate-invoice`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month, year }),
    });
    setLoading(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return toast.error(err.error || "Tạo hoá đơn thất bại");
    }
    const data = await res.json();
    toast.success(data.reactivated ? "Đã kích hoạt lại HĐ đã huỷ" : "Đã tạo hoá đơn");
    onClose();
    router.push(`/buildings/${buildingId}/invoices/${data.invoiceId}`);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !loading && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tạo hoá đơn cho HĐ {contract.code}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-xs text-slate-500">
            Tạo (hoặc kích hoạt lại nếu đã huỷ) hoá đơn cho kỳ chọn. Đơn giá điện/nước/giữ xe lấy từ cài đặt toà nhà hiện tại.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Tháng</Label>
              <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <SelectItem key={m} value={String(m)}>Tháng {m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Năm</Label>
              <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {years.map((y) => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={loading}>Huỷ</Button>
          <Button variant="gradient" onClick={submit} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Tạo hoá đơn
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TransferRoomDialog({
  open, onClose, contract, availableRooms, paymentMethods, buildingId,
}: {
  open: boolean;
  onClose: () => void;
  contract: { id: string; code: string; monthlyRent: string; depositAmount: string };
  availableRooms: { id: string; number: string }[];
  paymentMethods: { id: string; name: string }[];
  buildingId: string;
}) {
  const router = useRouter();
  const [newRoomId, setNewRoomId] = useState("");
  const [transferDate, setTransferDate] = useState(new Date().toISOString().slice(0, 10));
  const [newRent, setNewRent] = useState(contract.monthlyRent);
  const [newDeposit, setNewDeposit] = useState(contract.depositAmount);
  const [paymentMethodId, setPaymentMethodId] = useState("");
  const [loading, setLoading] = useState(false);

  const depositDiff = parseVNDInput(newDeposit) - BigInt(contract.depositAmount);
  const needsPm = depositDiff !== 0n;

  async function submit() {
    if (!newRoomId) return toast.error("Chọn phòng mới");
    if (!transferDate) return toast.error("Chọn ngày chuyển");
    if (parseVNDInput(newRent) <= 0n) return toast.error("Nhập giá thuê mới");
    if (needsPm && !paymentMethodId) return toast.error("Chọn phương thức thanh toán");
    setLoading(true);
    const res = await fetch(`/api/contracts/${contract.id}/transfer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        newRoomId,
        transferDate,
        newMonthlyRent: parseVNDInput(newRent).toString(),
        newDepositAmount: parseVNDInput(newDeposit).toString(),
        paymentMethodId: paymentMethodId || undefined,
      }),
    });
    setLoading(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return toast.error(err.error || "Chuyển phòng thất bại");
    }
    const data = await res.json();
    toast.success(`Đã chuyển phòng — HĐ mới ${data.code}`);
    onClose();
    router.push(`/buildings/${buildingId}/contracts/${data.id}/edit`);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !loading && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Chuyển phòng — HĐ {contract.code}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-xs text-slate-500">
            HĐ hiện tại sẽ được đóng lại (trạng thái CHUYỂN PHÒNG) và một HĐ mới sẽ được tạo cho phòng mới, giữ nguyên thông tin khách và các phí khác.
          </p>
          <div className="space-y-1.5">
            <Label className="text-xs">Phòng mới <span className="text-rose-500">*</span></Label>
            {availableRooms.length === 0 ? (
              <p className="text-xs text-slate-500 italic">Không có phòng trống</p>
            ) : (
              <Select value={newRoomId} onValueChange={setNewRoomId}>
                <SelectTrigger><SelectValue placeholder="Chọn phòng" /></SelectTrigger>
                <SelectContent>
                  {availableRooms.map((r) => (
                    <SelectItem key={r.id} value={r.id}>Phòng {r.number}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Ngày chuyển <span className="text-rose-500">*</span></Label>
            <DateInput value={transferDate} onChange={(e) => setTransferDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Giá thuê mới (₫/tháng) <span className="text-rose-500">*</span></Label>
            <VNDInput value={newRent} onChange={setNewRent} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Tiền cọc mới (₫)</Label>
            <VNDInput value={newDeposit} onChange={setNewDeposit} />
            {depositDiff !== 0n && (
              <p className="text-[11px] text-slate-500">
                {depositDiff > 0n
                  ? `Thu thêm cọc: ${formatVND(depositDiff)}`
                  : `Hoàn bớt cọc: ${formatVND(-depositDiff)}`}
              </p>
            )}
          </div>
          {needsPm && (
            <div className="space-y-1.5">
              <Label className="text-xs">Phương thức thanh toán <span className="text-rose-500">*</span></Label>
              <Select value={paymentMethodId} onValueChange={setPaymentMethodId}>
                <SelectTrigger><SelectValue placeholder="Chọn tài khoản TT" /></SelectTrigger>
                <SelectContent>
                  {paymentMethods.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={loading}>Huỷ</Button>
          <Button variant="gradient" onClick={submit} disabled={loading || availableRooms.length === 0}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Xác nhận chuyển phòng
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TerminateContractDialog({
  open, onClose, contract, paymentMethods, onDone,
}: {
  open: boolean;
  onClose: () => void;
  contract: { id: string; code: string; depositAmount: string };
  paymentMethods: { id: string; name: string }[];
  onDone: () => void;
}) {
  const [reason, setReason] = useState<"TERMINATED" | "TERMINATED_LOST_DEPOSIT">("TERMINATED");
  const [terminatedAt, setTerminatedAt] = useState(new Date().toISOString().slice(0, 10));
  const [refund, setRefund] = useState(formatNumber(BigInt(contract.depositAmount)));
  const [lost, setLost] = useState(formatNumber(BigInt(contract.depositAmount)));
  const [paymentMethodId, setPaymentMethodId] = useState("");
  const [loading, setLoading] = useState(false);

  const lostDeposit = reason === "TERMINATED_LOST_DEPOSIT";

  async function submit() {
    if (!paymentMethodId) return toast.error("Chọn phương thức thanh toán");
    setLoading(true);
    const res = await fetch(`/api/contracts/${contract.id}/terminate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reason,
        terminatedAt,
        depositRefund: !lostDeposit && refund ? parseVNDInput(refund).toString() : undefined,
        depositLost: lostDeposit && lost ? parseVNDInput(lost).toString() : undefined,
        paymentMethodId,
      }),
    });
    setLoading(false);
    if (!res.ok) return toast.error("Có lỗi");
    toast.success(
      lostDeposit
        ? "Đã kết thúc HĐ — tiền cọc đã hạch toán vào doanh thu"
        : "Đã kết thúc HĐ — đã tạo phiếu chi hoàn cọc",
    );
    onClose();
    onDone();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Kết thúc HĐ {contract.code}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Lý do</Label>
            <Select value={reason} onValueChange={(v) => setReason(v as "TERMINATED" | "TERMINATED_LOST_DEPOSIT")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="TERMINATED">Hết hạn HĐ (trả cọc)</SelectItem>
                <SelectItem value="TERMINATED_LOST_DEPOSIT">Dừng thuê (mất cọc)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Ngày kết thúc</Label>
            <DateInput value={terminatedAt} onChange={(e) => setTerminatedAt(e.target.value)} />
          </div>
          {lostDeposit ? (
            <div className="space-y-1.5">
              <Label className="text-xs">Tiền cọc mất (₫)</Label>
              <Input
                inputMode="numeric"
                value={lost ? formatNumber(parseVNDInput(lost)) : ""}
                onChange={(e) => setLost(e.target.value)}
                placeholder={formatNumber(BigInt(contract.depositAmount))}
              />
              <p className="text-[11px] text-rose-700">
                Số tiền này sẽ tự động hạch toán vào doanh thu (loại "Tiền cọc mất").
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label className="text-xs">Tiền cọc đã trả lại (₫)</Label>
              <Input
                inputMode="numeric"
                value={refund ? formatNumber(parseVNDInput(refund)) : ""}
                onChange={(e) => setRefund(e.target.value)}
                placeholder={formatNumber(BigInt(contract.depositAmount))}
              />
              <p className="text-[11px] text-slate-500">
                Số tiền này sẽ tự động tạo phiếu Chi &ldquo;Hoàn tiền cọc&rdquo; theo Tài khoản TT chọn bên dưới.
              </p>
            </div>
          )}
          <div className="space-y-1.5">
            <Label className="text-xs">Phương thức thanh toán <span className="text-rose-500">*</span></Label>
            <Select value={paymentMethodId} onValueChange={setPaymentMethodId}>
              <SelectTrigger><SelectValue placeholder="Chọn tài khoản TT" /></SelectTrigger>
              <SelectContent>
                {paymentMethods.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Huỷ</Button>
          <Button variant="destructive" onClick={submit} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Xác nhận kết thúc
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CustomerItem({
  cc, contractId, canRemove, onChanged,
}: {
  cc: ContractCustomer;
  contractId: string;
  canRemove: boolean;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [zoomUrl, setZoomUrl] = useState<string | null>(null);
  const c = cc.customer;
  const name = customerDisplayName(c);
  const sub: string[] = [];
  // For company customers, surface the legal representative + role and the
  // contact person on the sub-line.
  if (c.type === "COMPANY" && c.representativeName) {
    sub.push(
      c.representativeTitle
        ? `Đại diện: ${c.representativeName} (${c.representativeTitle})`
        : `Đại diện: ${c.representativeName}`,
    );
  }
  if (c.type === "COMPANY" && c.fullName) sub.push(`Liên hệ: ${c.fullName}`);
  if (c.idNumber) sub.push(`CCCD ${c.idNumber}`);
  if (c.taxNumber) sub.push(`MST ${c.taxNumber}`);
  if (c.phone) sub.push(c.phone);
  if (c.email) sub.push(c.email);
  if (c.licensePlate) sub.push(c.licensePlate);

  const docLabel = c.type === "INDIVIDUAL" ? "CCCD" : "ĐKKD";
  const docImages: { url: string; caption: string }[] = c.type === "INDIVIDUAL"
    ? [
        ...(c.idCardFrontUrl ? [{ url: c.idCardFrontUrl, caption: "CCCD mặt trước" }] : []),
        ...(c.idCardBackUrl ? [{ url: c.idCardBackUrl, caption: "CCCD mặt sau" }] : []),
      ]
    : c.businessLicenseUrls.map((url, i) => ({ url, caption: `ĐKKD ${i + 1}` }));

  async function remove() {
    if (!confirm(`Xoá khách "${name}" khỏi hợp đồng?`)) return;
    setBusy(true);
    const res = await fetch(`/api/contracts/${contractId}/customers/${cc.id}`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return toast.error(err.error || "Xoá thất bại");
    }
    toast.success("Đã xoá khách");
    onChanged();
  }

  return (
    <>
      <div className="p-2 rounded-lg bg-slate-50 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-sm truncate">{name}</span>
              {cc.isPrimary && <Badge variant="default" className="text-[10px]">Đại diện</Badge>}
            </div>
            {sub.length > 0 && (
              <div className="text-[11px] text-slate-500 break-words">{sub.join(" · ")}</div>
            )}
          </div>
          <div className="flex items-center gap-0.5 shrink-0">
            <button
              onClick={() => setEditOpen(true)}
              className="p-1 text-slate-400 hover:text-primary"
              aria-label="Sửa khách"
            >
              <Edit className="h-3.5 w-3.5" />
            </button>
            {canRemove && (
              <button
                onClick={remove}
                disabled={busy}
                className="p-1 text-slate-400 hover:text-rose-500 disabled:opacity-50"
                aria-label="Xoá khách"
              >
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              </button>
            )}
          </div>
        </div>
        {docImages.length > 0 && (
          <div className={`grid gap-2 ${docImages.length === 1 ? "grid-cols-1" : docImages.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
            {docImages.map((img, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setZoomUrl(img.url)}
                className="relative aspect-[1.6/1] rounded-lg overflow-hidden border bg-white cursor-zoom-in"
                aria-label={`Xem ${img.caption}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.url} alt={img.caption} className="w-full h-full object-cover" />
                <span className="absolute bottom-0 inset-x-0 bg-black/50 text-white text-[10px] py-0.5 text-center">
                  {img.caption}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
      <ImageLightbox src={zoomUrl} alt={docLabel} onClose={() => setZoomUrl(null)} />
      {editOpen && (
        <EditCustomerDialog
          customer={c}
          onClose={() => setEditOpen(false)}
          onSaved={() => { setEditOpen(false); onChanged(); }}
        />
      )}
    </>
  );
}

function EditCustomerDialog({
  customer, onClose, onSaved,
}: {
  customer: ContractCustomer["customer"];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [type, setType] = useState<"INDIVIDUAL" | "COMPANY">(customer.type);
  const [fullName, setFullName] = useState(customer.fullName ?? "");
  const [idNumber, setIdNumber] = useState(customer.idNumber ?? "");
  const [companyName, setCompanyName] = useState(customer.companyName ?? "");
  const [taxNumber, setTaxNumber] = useState(customer.taxNumber ?? "");
  const [phone, setPhone] = useState(customer.phone ?? "");
  const [email, setEmail] = useState(customer.email ?? "");
  const [licensePlate, setLicensePlate] = useState(customer.licensePlate ?? "");
  const [representativeName, setRepresentativeName] = useState(customer.representativeName ?? "");
  const [representativeTitle, setRepresentativeTitle] = useState(customer.representativeTitle ?? "");
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (type === "INDIVIDUAL" && !fullName.trim()) return toast.error("Nhập Họ và tên");
    if (type === "COMPANY" && !companyName.trim()) return toast.error("Nhập Tên công ty");
    if (type === "COMPANY" && (!representativeName.trim() || !representativeTitle.trim())) {
      return toast.error("Cần Người đại diện và Chức vụ");
    }
    setSaving(true);
    const res = await fetch(`/api/customers/${customer.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type,
        fullName: fullName.trim() || null,
        idNumber: idNumber.trim() || null,
        companyName: companyName.trim() || null,
        taxNumber: taxNumber.trim() || null,
        representativeName: type === "COMPANY" ? representativeName.trim() || null : null,
        representativeTitle: type === "COMPANY" ? representativeTitle.trim() || null : null,
        phone: phone.trim() || null,
        email: email.trim() || null,
        licensePlate: licensePlate.trim() || null,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return toast.error(err.error || "Lưu thất bại");
    }
    toast.success("Đã lưu");
    onSaved();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Sửa thông tin khách</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Loại khách</Label>
            <Select value={type} onValueChange={(v) => setType(v as "INDIVIDUAL" | "COMPANY")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="INDIVIDUAL">Cá nhân</SelectItem>
                <SelectItem value="COMPANY">Công ty</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {type === "INDIVIDUAL" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5 col-span-2">
                <Label className="text-xs">Họ và tên</Label>
                <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">CCCD</Label>
                <Input value={idNumber} onChange={(e) => setIdNumber(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">SĐT</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Email</Label>
                <Input value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Biển số xe</Label>
                <Input value={licensePlate} onChange={(e) => setLicensePlate(e.target.value)} />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5 col-span-2">
                <Label className="text-xs">Tên công ty</Label>
                <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Người đại diện <span className="text-rose-500">*</span></Label>
                <Input value={representativeName} onChange={(e) => setRepresentativeName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Chức vụ <span className="text-rose-500">*</span></Label>
                <Input value={representativeTitle} onChange={(e) => setRepresentativeTitle(e.target.value)} />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label className="text-xs">Người liên hệ</Label>
                <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Tên người liên hệ" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">MST</Label>
                <Input value={taxNumber} onChange={(e) => setTaxNumber(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">SĐT</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label className="text-xs">Email</Label>
                <Input value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Huỷ</Button>
          <Button variant="gradient" onClick={submit} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Lưu
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddCustomerDialog({
  open, onClose, contractId, defaultType, onAdded,
}: {
  open: boolean;
  onClose: () => void;
  contractId: string;
  defaultType: "INDIVIDUAL" | "COMPANY";
  onAdded: () => void;
}) {
  const [type, setType] = useState<"INDIVIDUAL" | "COMPANY">(defaultType);
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [licensePlate, setLicensePlate] = useState("");
  // Company fields
  const [companyName, setCompanyName] = useState("");
  const [taxNumber, setTaxNumber] = useState("");
  const [contactName, setContactName] = useState("");
  const [representativeName, setRepresentativeName] = useState("");
  const [representativeTitle, setRepresentativeTitle] = useState("");
  const [saving, setSaving] = useState(false);

  function reset() {
    setType(defaultType);
    setPhone(""); setEmail(""); setLicensePlate("");
    setCompanyName(""); setTaxNumber(""); setContactName("");
    setRepresentativeName(""); setRepresentativeTitle("");
  }

  async function submitIndividual(d: CCCDData) {
    setSaving(true);
    const res = await fetch(`/api/contracts/${contractId}/customers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "INDIVIDUAL",
        fullName: d.fullName?.trim() || undefined,
        idNumber: d.idNumber?.trim() || undefined,
        dateOfBirth: d.dateOfBirth || undefined,
        idIssuedDate: d.idIssuedDate || undefined,
        hometown: d.hometown?.trim() || undefined,
        permanentAddress: d.permanentAddress?.trim() || undefined,
        frontUrl: d.frontUrl || undefined,
        backUrl: d.backUrl || undefined,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        licensePlate: licensePlate.trim() || undefined,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return toast.error(err.error || "Lưu thất bại");
    }
    toast.success("Đã thêm khách");
    reset();
    onClose();
    onAdded();
  }

  async function submitCompany() {
    if (!companyName.trim()) return toast.error("Nhập Tên công ty");
    if (!representativeName.trim() || !representativeTitle.trim()) {
      return toast.error("Cần Người đại diện và Chức vụ");
    }
    setSaving(true);
    const res = await fetch(`/api/contracts/${contractId}/customers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "COMPANY",
        companyName: companyName.trim(),
        taxNumber: taxNumber.trim() || undefined,
        // For COMPANY: fullName is the contact person ("Người liên hệ").
        fullName: contactName.trim() || undefined,
        representativeName: representativeName.trim(),
        representativeTitle: representativeTitle.trim(),
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return toast.error(err.error || "Lưu thất bại");
    }
    toast.success("Đã thêm khách");
    reset();
    onClose();
    onAdded();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { reset(); onClose(); } }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Thêm khách thuê</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Loại khách</Label>
            <Select value={type} onValueChange={(v) => setType(v as "INDIVIDUAL" | "COMPANY")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="INDIVIDUAL">Cá nhân</SelectItem>
                <SelectItem value="COMPANY">Công ty</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">SĐT</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Email</Label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            {type === "INDIVIDUAL" && (
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs">Biển số xe</Label>
                <Input value={licensePlate} onChange={(e) => setLicensePlate(e.target.value)} />
              </div>
            )}
          </div>

          {type === "INDIVIDUAL" ? (
            <CCCDScanner onConfirm={submitIndividual} />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5 col-span-2">
                <Label className="text-xs">Tên công ty</Label>
                <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Người đại diện <span className="text-rose-500">*</span></Label>
                <Input value={representativeName} onChange={(e) => setRepresentativeName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Chức vụ <span className="text-rose-500">*</span></Label>
                <Input value={representativeTitle} onChange={(e) => setRepresentativeTitle(e.target.value)} />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label className="text-xs">Người liên hệ</Label>
                <Input value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Tên người liên hệ" />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label className="text-xs">MST</Label>
                <Input value={taxNumber} onChange={(e) => setTaxNumber(e.target.value)} />
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => { reset(); onClose(); }}>Huỷ</Button>
          {type === "COMPANY" && (
            <Button variant="gradient" onClick={submitCompany} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Thêm khách
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function GeneratedContractCard({
  contractId, generatedDocxUrl,
}: {
  contractId: string;
  generatedDocxUrl: string | null;
}) {
  const router = useRouter();
  const [generating, setGenerating] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const inlineFrameRef = useRef<HTMLIFrameElement>(null);

  // Lazily load the converted PDF the first time the card is shown with a
  // generated DOCX. The endpoint caches the conversion on disk so subsequent
  // visits are cheap.
  const docxUrl = generatedDocxUrl;
  useEffect(() => {
    if (!docxUrl) return;
    let cancelled = false;
    setPdfLoading(true);
    setPdfError(null);
    fetch(`/api/contracts/${contractId}/pdf`)
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error || `Lỗi ${r.status}`);
        if (!cancelled) setPdfUrl(d.url);
      })
      .catch((e) => { if (!cancelled) setPdfError(e instanceof Error ? e.message : "Convert PDF thất bại"); })
      .finally(() => { if (!cancelled) setPdfLoading(false); });
    return () => { cancelled = true; };
  }, [docxUrl, contractId]);

  async function generate(force = false) {
    setGenerating(true);
    const url = `/api/contracts/${contractId}/generate-docx${force ? "?force=1" : ""}`;
    const res = await fetch(url, { method: "POST" });
    setGenerating(false);
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return toast.error(d.error || "Tạo HĐ thất bại", { duration: 8000 });
    toast.success(force ? "Đã tạo lại hợp đồng theo mẫu mới" : "Đã tạo hợp đồng");
    router.refresh();
  }

  async function share() {
    if (!pdfUrl && !docxUrl) return;
    const url = new URL(pdfUrl || docxUrl!, window.location.origin).toString();
    if (navigator.share) {
      try {
        await navigator.share({ title: "Hợp đồng", url });
        return;
      } catch {
        // User cancelled — fall through to clipboard copy.
      }
    }
    await navigator.clipboard.writeText(url);
    toast.success("Đã copy link hợp đồng");
  }

  function print() {
    // Print via the inline iframe's contentWindow so we never navigate the
    // PWA itself to a /api/files/*.pdf URL (which leaves users stranded
    // without a back button in standalone PWA mode).
    try {
      inlineFrameRef.current?.contentWindow?.focus();
      inlineFrameRef.current?.contentWindow?.print();
    } catch {
      toast.error("Không in được.");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-4 w-4" /> Hợp đồng đã tạo
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {!docxUrl ? (
          <>
            <p className="text-xs text-slate-500">
              Bấm để tạo hợp đồng từ mẫu của toà nhà (hoặc mẫu mặc định) với toàn bộ thông tin hiện có.
            </p>
            <Button variant="gradient" size="sm" onClick={() => generate(false)} disabled={generating} className="w-full">
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Tạo hợp đồng
            </Button>
          </>
        ) : (
          <>
            {pdfLoading ? (
              <div className="aspect-[3/4] rounded-lg border bg-slate-50 flex items-center justify-center">
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin" /> Đang tạo bản PDF preview...
                </div>
              </div>
            ) : pdfUrl ? (
              <div className="relative">
                <iframe
                  ref={inlineFrameRef}
                  src={pdfUrl}
                  className="w-full h-72 rounded-lg border bg-white"
                  title="Hợp đồng PDF"
                />
                <button
                  type="button"
                  onClick={() => setFullscreen(true)}
                  className="absolute top-2 right-2 inline-flex items-center gap-1 h-7 px-2 rounded-md bg-black/60 hover:bg-black/75 text-white text-[11px] font-medium"
                  aria-label="Mở rộng"
                >
                  <Maximize2 className="h-3 w-3" /> Mở rộng
                </button>
              </div>
            ) : pdfError ? (
              <p className="text-xs text-rose-600 break-words">{pdfError}</p>
            ) : null}
            <div className="grid grid-cols-3 gap-2">
              <Button variant="outline" size="sm" onClick={print} disabled={!pdfUrl}>
                <Printer className="h-3.5 w-3.5" /> Print
              </Button>
              <Button variant="outline" size="sm" onClick={share} disabled={!pdfUrl && !docxUrl}>
                <Share2 className="h-3.5 w-3.5" /> Share
              </Button>
              <a
                href={docxUrl}
                rel="noopener"
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
                download
              >
                <Download className="h-3.5 w-3.5" /> .docx
              </a>
            </div>
            <p className="text-[11px] text-slate-500">
              Edit: tải về .docx để chỉnh sửa rồi upload lại bản đã ký ở khung &ldquo;File hợp đồng&rdquo;.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => generate(true)}
              disabled={generating}
              className="w-full"
            >
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Tạo lại theo mẫu mới
            </Button>
          </>
        )}
      </CardContent>

      <Dialog open={fullscreen} onOpenChange={(o) => !o && setFullscreen(false)}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden h-[90vh] flex flex-col">
          <div className="flex items-center justify-between pl-4 pr-12 py-2.5 border-b bg-white shrink-0">
            <h3 className="text-sm font-semibold">Hợp đồng đã tạo</h3>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={print} disabled={!pdfUrl}>
                <Printer className="h-3.5 w-3.5" /> In
              </Button>
              {docxUrl && (
                <a
                  href={docxUrl}
                  rel="noopener"
                  download
                  className="inline-flex h-8 items-center gap-1.5 rounded-md border border-input bg-background px-2.5 text-xs font-medium hover:bg-accent"
                >
                  <Download className="h-3.5 w-3.5" /> .docx
                </a>
              )}
            </div>
          </div>
          <div className="flex-1 min-h-0">
            {pdfUrl && <PdfViewer url={pdfUrl} />}
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function Field({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">
        {label}
        {required && <span className="text-rose-500"> *</span>}
      </Label>
      {children}
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex justify-between items-baseline gap-2">
      <span className="text-slate-500 shrink-0">{label}</span>
      <span className={`text-right break-words min-w-0 ${bold ? "font-bold" : ""}`}>{value}</span>
    </div>
  );
}

function VNDInput({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const display = value ? formatNumber(parseVNDInput(value)) : "";
  return (
    <Input
      value={display}
      inputMode="numeric"
      onChange={(e) => onChange(e.target.value)}
      placeholder="0"
      disabled={disabled}
    />
  );
}

const VAT_FEE_OPTIONS: { key: VatFeeKey; label: string }[] = [
  { key: "electricity", label: "Tiền điện" },
  { key: "parking", label: "Phí gửi xe" },
  { key: "overtime", label: "Phí ngoài giờ" },
  { key: "repair", label: "Phí sửa chữa" },
  { key: "extraParking", label: "Phí xe lẻ" },
];

// Pill-style toggle picker rendered on its own row. Selected pills have the
// brand primary background; unselected stay as outline chips. When vatRate is
// 0, the whole picker is dimmed with a hint to enable VAT first.
function VatFeesPickerField({
  value, onChange, vatRate, disabled: disabledProp = false,
}: {
  value: VatFeeKey[];
  onChange: (v: VatFeeKey[]) => void;
  vatRate: number;
  disabled?: boolean;
}) {
  const disabled = disabledProp || vatRate <= 0;
  const set = new Set(value);
  function toggle(key: VatFeeKey) {
    if (disabled) return;
    const next = new Set(set);
    if (next.has(key)) next.delete(key); else next.add(key);
    onChange(VAT_FEE_OPTIONS.map((o) => o.key).filter((k) => next.has(k)));
  }
  const count = value.length;
  return (
    <div className="space-y-1.5 pt-1">
      <div className="flex items-baseline justify-between gap-2">
        <Label className="text-xs">
          Chi phí lấy VAT{vatRate > 0 ? ` (${vatRate}%)` : ""}
        </Label>
        <span className="text-[11px] text-slate-500">
          {disabled
            ? "Đặt VAT > 0 để bật"
            : count === 0
              ? "Chưa chọn — không phí nào cộng VAT"
              : `Đã chọn ${count}/${VAT_FEE_OPTIONS.length}`}
        </span>
      </div>
      <div className={`flex flex-wrap gap-1.5 ${disabled ? "opacity-50 pointer-events-none" : ""}`}>
        {VAT_FEE_OPTIONS.map((o) => {
          const active = set.has(o.key);
          return (
            <button
              key={o.key}
              type="button"
              onClick={() => toggle(o.key)}
              aria-pressed={active}
              className={
                "inline-flex items-center gap-1 h-8 px-3 rounded-full border text-xs font-medium transition-colors " +
                (active
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "bg-background text-slate-700 border-slate-200 hover:border-primary/40 hover:bg-primary/5")
              }
            >
              {active && <Check className="h-3 w-3" />}
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ExtendContractDialog({
  open, onClose, contract, onDone,
}: {
  open: boolean;
  onClose: () => void;
  contract: { id: string; code: string; endDate: string; monthlyRent: string; isOpenEnded: boolean };
  onDone: () => void;
}) {
  const [openEnded, setOpenEnded] = useState(contract.isOpenEnded);
  const [restartDate, setRestartDate] = useState(contract.endDate.slice(0, 10));
  const [extensionMonths, setExtensionMonths] = useState(12);
  const [newRent, setNewRent] = useState("");
  const [loading, setLoading] = useState(false);

  const newEnd = useMemo(() => {
    if (openEnded || !restartDate) return "";
    return contractEndDate(new Date(restartDate), extensionMonths).toISOString().slice(0, 10);
  }, [openEnded, restartDate, extensionMonths]);

  async function submit() {
    if (!openEnded && extensionMonths < 1) return toast.error("Số tháng gia hạn phải > 0");
    setLoading(true);
    const body: Record<string, unknown> = {};
    if (openEnded) {
      body.isOpenEnded = true;
    } else {
      body.startDate = restartDate;
      body.extensionMonths = extensionMonths;
    }
    if (newRent.trim()) {
      const v = parseVNDInput(newRent);
      if (v > 0n) body.monthlyRent = v.toString();
    }
    const res = await fetch(`/api/contracts/${contract.id}/extend`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setLoading(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return toast.error(err.error || "Có lỗi");
    }
    toast.success(openEnded ? "Đã chuyển sang HĐ vô thời hạn" : "Đã gia hạn HĐ");
    onClose();
    onDone();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Gia hạn HĐ {contract.code}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm cursor-pointer p-2 rounded-lg bg-slate-50">
            <input
              type="checkbox"
              checked={openEnded}
              onChange={(e) => setOpenEnded(e.target.checked)}
              className="rounded"
            />
            <span>Hợp đồng vô thời hạn (active đến khi kết thúc thủ công)</span>
          </label>

          <div className={openEnded ? "opacity-50 pointer-events-none" : ""}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Ngày bắt đầu gia hạn</Label>
                <DateInput
                  value={restartDate}
                  onChange={(e) => setRestartDate(e.target.value)}
                  disabled={openEnded}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Số tháng gia hạn</Label>
                <Input
                  type="number"
                  min={1}
                  max={120}
                  value={extensionMonths}
                  onChange={(e) => setExtensionMonths(Number(e.target.value))}
                  disabled={openEnded}
                />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label className="text-xs">Ngày kết thúc (tự động)</Label>
                <DateInput value={newEnd} disabled />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Giá thuê mới (₫/tháng) — để trống nếu không đổi</Label>
            <VNDInput value={newRent} onChange={setNewRent} />
            <p className="text-[11px] text-slate-500">
              Đang là {formatVND(BigInt(contract.monthlyRent))}/tháng.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Huỷ</Button>
          <Button variant="gradient" onClick={submit} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Xác nhận
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BrokerFeeItem({ fee, paymentMethods }: {
  fee: BrokerFee;
  paymentMethods: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(fee.amount);
  const [pmId, setPmId] = useState(fee.paymentMethodId ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    const v = parseVNDInput(val);
    if (v <= 0n) return toast.error("Số tiền > 0");
    if (!pmId) return toast.error("Chọn Tài khoản TT");
    setSaving(true);
    const res = await fetch(`/api/transactions/${fee.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: v.toString(), paymentMethodId: pmId }),
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
      <div className="space-y-1.5 p-2 rounded-lg bg-primary/5 border border-primary/20">
        <div className="space-y-1">
          <Label className="text-[10px] text-slate-500">Số tiền</Label>
          <Input
            inputMode="numeric"
            className="h-8 text-sm"
            value={val ? formatNumber(parseVNDInput(val)) : ""}
            onChange={(e) => setVal(e.target.value)}
            autoFocus
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] text-slate-500">Tài khoản TT</Label>
          <Select value={pmId} onValueChange={setPmId}>
            <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Chọn" /></SelectTrigger>
            <SelectContent>
              {paymentMethods.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex justify-end gap-1.5">
          <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setVal(fee.amount); setPmId(fee.paymentMethodId ?? ""); }}>
            <X className="h-3 w-3" />
          </Button>
          <Button size="sm" variant="gradient" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
          </Button>
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-slate-50 text-sm">
      <div className="min-w-0 flex-1">
        <div className="font-mono text-[10px] text-slate-500">{fee.code}</div>
        <div className="font-semibold text-rose-700">{formatVND(BigInt(fee.amount))}</div>
        <div className="text-[11px] text-slate-500">{fee.paymentMethod?.name ?? "—"}</div>
      </div>
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="p-1 text-slate-400 hover:text-primary"
        aria-label="Sửa"
      >
        <Edit className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
