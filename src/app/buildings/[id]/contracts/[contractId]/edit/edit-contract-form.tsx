"use client";
import { useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save, X, Plus, Trash2, Upload, FileText, UserPlus, XCircle, RefreshCw, Edit } from "lucide-react";
import { toast } from "sonner";
import { addMonths, parseVNDInput, formatNumber, formatVND, customerDisplayName } from "@/lib/utils";
import { ImageLightbox } from "@/components/ui/image-lightbox";

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
  };
};

type Contract = {
  id: string;
  code: string;
  status: string;
  contractFileUrl: string | null;
  startDate: string;
  endDate: string;
  termMonths: number;
  paymentDay: number;
  monthlyRent: string;
  vatRate: number;
  depositAmount: string;
  electricityPricePerKwh: string;
  parkingCount: number;
  parkingFeePerVehicle: string;
  serviceFeeAmount: string;
  waterPricePerPerson: string;
  isOpenEnded: boolean;
  notes: string | null;
  room: { number: string };
  yearlyRents: { yearIndex: number; rent: string }[];
  customers: ContractCustomer[];
};

export function EditContractForm({
  buildingId,
  buildingType,
  contract,
  buildingSetting,
  brokerCategoryId,
  paymentMethods,
}: {
  buildingId: string;
  buildingType: "CHDV" | "VP";
  contract: Contract;
  buildingSetting: { electricityPricePerKwh: string; parkingFeePerVehicle: string } | null;
  brokerCategoryId: string | null;
  paymentMethods: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const [startDate, setStartDate] = useState(contract.startDate.slice(0, 10));
  const [termMonths, setTermMonths] = useState(contract.termMonths);
  const [paymentDay, setPaymentDay] = useState(contract.paymentDay);
  const [monthlyRent, setMonthlyRent] = useState(contract.monthlyRent);
  const [vatRate, setVatRate] = useState(contract.vatRate * 100); // store as percent in UI
  const [deposit, setDeposit] = useState(contract.depositAmount);
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

  const endDate = useMemo(() => {
    if (!startDate) return "";
    return addMonths(new Date(startDate), termMonths).toISOString().slice(0, 10);
  }, [startDate, termMonths]);

  // Upload + view contract file
  const [contractFileUrl, setContractFileUrl] = useState(contract.contractFileUrl);
  const [uploading, setUploading] = useState(false);
  const [removingFile, setRemovingFile] = useState(false);
  const [contractFileZoom, setContractFileZoom] = useState(false);
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
  const [brokerLoading, setBrokerLoading] = useState(false);
  async function recordBrokerFee() {
    const a = parseVNDInput(brokerFee);
    if (a <= 0n) return toast.error("Nhập số tiền > 0");
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
        countInBR: true,
        notes: `Liên quan HĐ ${contract.code}`,
      }),
    });
    setBrokerLoading(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return toast.error(err.error || "Có lỗi");
    }
    toast.success(`Đã ghi nhận phiếu chi ${formatVND(a)} (Phí môi giới)`);
    setBrokerFee("");
    router.refresh();
  }

  // monthlyRent is stored as the AFTER-VAT total (what tenant actually pays).
  // pre-VAT and VAT amount are derived for display per user's convention:
  //   preVAT = rent × (1 - vatRate);  vatAmount = rent × vatRate
  const rentBigInt = parseVNDInput(monthlyRent);
  const vatAmount = (rentBigInt * BigInt(Math.round(vatRate * 100))) / 10000n;
  const preVATAmount = rentBigInt - vatAmount;

  const [addCustomerOpen, setAddCustomerOpen] = useState(false);
  const [terminateOpen, setTerminateOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [extendOpen, setExtendOpen] = useState(false);
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
      termMonths,
      paymentDay,
      monthlyRent: rentBigInt.toString(),
      vatRate: vatRate / 100,
      depositAmount: parseVNDInput(deposit).toString(),
      parkingCount,
      parkingFeePerVehicle: parseVNDInput(parkingFeePerVehicle).toString(),
      serviceFeeAmount: parseVNDInput(serviceFee).toString(),
      waterPricePerPerson: parseVNDInput(waterPerPerson).toString(),
      electricityPricePerKwh: parseVNDInput(electricityPricePerKwh).toString(),
      notes,
      yearlyRents: yearlyRents.map((y) => ({
        yearIndex: y.yearIndex,
        rent: parseVNDInput(y.rent).toString(),
      })),
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
    <div className="grid lg:grid-cols-3 gap-6">
      <div className="lg:col-span-1 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Thông tin chung</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Mã HĐ" value={contract.code} />
            <Row label="Phòng" value={contract.room.number} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>Khách thuê ({contract.customers.length})</CardTitle>
            <Button size="sm" variant="outline" onClick={() => setAddCustomerOpen(true)}>
              <UserPlus className="h-3.5 w-3.5" /> Thêm
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {contract.customers.map((cc) => (
              <CustomerItem
                key={cc.id}
                cc={cc}
                contractId={contract.id}
                canRemove={contract.customers.length > 1}
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
                <button
                  type="button"
                  onClick={removeFile}
                  disabled={removingFile}
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
              disabled={uploading}
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
              Khi click "Ghi nhận" sẽ tự tạo phiếu chi với loại "Phí môi giới" + nội dung kèm mã HĐ.
            </p>
            <div className="space-y-1.5">
              <Label className="text-xs">Số tiền (₫)</Label>
              <Input
                inputMode="numeric"
                value={brokerFee ? formatNumber(parseVNDInput(brokerFee)) : ""}
                onChange={(e) => setBrokerFee(e.target.value)}
                placeholder="0"
              />
            </div>
            <Button
              variant="gradient"
              size="sm"
              onClick={recordBrokerFee}
              disabled={brokerLoading || parseVNDInput(brokerFee) <= 0n}
              className="w-full"
            >
              {brokerLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              Ghi nhận
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="lg:col-span-2 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Thông tin hợp đồng</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Ngày bắt đầu" required>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </Field>
              <Field label="Thời hạn (tháng)">
                <Input
                  type="number"
                  min={1}
                  max={120}
                  value={termMonths}
                  onChange={(e) => setTermMonths(Number(e.target.value))}
                />
              </Field>
              <Field label="Ngày kết thúc (tự động)">
                <Input value={endDate} disabled />
              </Field>
              <Field label="Ngày thanh toán hàng tháng">
                <Input
                  type="number"
                  min={1}
                  max={28}
                  value={paymentDay}
                  onChange={(e) => setPaymentDay(Number(e.target.value))}
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Giá thuê / tháng (sau VAT, đã gồm VAT)" required>
                <VNDInput value={monthlyRent} onChange={setMonthlyRent} />
                {vatRate > 0 && rentBigInt > 0n && (
                  <p className="text-[11px] text-slate-500 mt-1">
                    = {formatVND(preVATAmount)} chưa VAT + {formatVND(vatAmount)} VAT
                  </p>
                )}
              </Field>
              <Field label="VAT (%)">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step="0.1"
                  value={vatRate}
                  onChange={(e) => setVatRate(Number(e.target.value))}
                />
              </Field>
              <Field label="Tiền cọc (₫)">
                <VNDInput value={deposit} onChange={setDeposit} />
              </Field>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Giá thuê theo năm (cho HĐ {">"}1 năm)</span>
              <Button size="sm" variant="outline" onClick={addYearlyRent}>
                <Plus className="h-3.5 w-3.5" /> Thêm năm
              </Button>
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
                            <VNDInput value={y.rent} onChange={(v) => updateYearlyRent(y.yearIndex, v)} />
                          </div>
                          <button
                            onClick={() => removeYearlyRent(y.yearIndex)}
                            className="text-rose-500 hover:text-rose-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
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
                <VNDInput value={electricityPricePerKwh} onChange={setElecPrice} />
              </Field>
              <Field label="Số xe gửi">
                <Input
                  type="number"
                  min={0}
                  value={parkingCount}
                  onChange={(e) => setParkingCount(Number(e.target.value))}
                />
              </Field>
              <Field label="Phí gửi xe (₫/xe/tháng)">
                <VNDInput value={parkingFeePerVehicle} onChange={setParkingFeePerVehicle} />
              </Field>
              <Field label="Phí dịch vụ (₫/tháng)">
                <VNDInput value={serviceFee} onChange={setServiceFee} />
              </Field>
              {buildingType === "CHDV" && (
                <Field label="Tiền nước (₫/người/tháng)">
                  <VNDInput value={waterPerPerson} onChange={setWaterPerPerson} />
                </Field>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ghi chú</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={5} />
          </CardContent>
        </Card>

        <div className="flex flex-wrap justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setExtendOpen(true)}>
              <RefreshCw className="h-4 w-4" /> Gia hạn
            </Button>
            {contract.status === "ACTIVE" && (
              <Button variant="outline" onClick={() => setTerminateOpen(true)} className="text-rose-600 border-rose-200 hover:bg-rose-50">
                <XCircle className="h-4 w-4" /> Kết thúc HĐ
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

function TerminateContractDialog({
  open, onClose, contract, paymentMethods, onDone,
}: {
  open: boolean;
  onClose: () => void;
  contract: { id: string; code: string; depositAmount: string };
  paymentMethods: { id: string; name: string }[];
  onDone: () => void;
}) {
  const [reason, setReason] = useState<"EXPIRED" | "TERMINATED_LOST_DEPOSIT">("EXPIRED");
  const [terminatedAt, setTerminatedAt] = useState(new Date().toISOString().slice(0, 10));
  const [refund, setRefund] = useState("");
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
            <Select value={reason} onValueChange={(v) => setReason(v as "EXPIRED" | "TERMINATED_LOST_DEPOSIT")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="EXPIRED">Hết hạn HĐ (trả cọc)</SelectItem>
                <SelectItem value="TERMINATED_LOST_DEPOSIT">Dừng thuê (mất cọc)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Ngày kết thúc</Label>
            <Input type="date" value={terminatedAt} onChange={(e) => setTerminatedAt(e.target.value)} />
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
                Số tiền này sẽ tự động tạo phiếu Chi "Hoàn tiền cọc" theo PTTT chọn bên dưới.
              </p>
            </div>
          )}
          <div className="space-y-1.5">
            <Label className="text-xs">Phương thức thanh toán <span className="text-rose-500">*</span></Label>
            <Select value={paymentMethodId} onValueChange={setPaymentMethodId}>
              <SelectTrigger><SelectValue placeholder="Chọn PTTT" /></SelectTrigger>
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
  const c = cc.customer;
  const name = customerDisplayName(c);
  const sub: string[] = [];
  // For company customers, surface the contact person on the sub-line.
  if (c.type === "COMPANY" && c.fullName) sub.push(`Đại diện: ${c.fullName}`);
  if (c.idNumber) sub.push(`CCCD ${c.idNumber}`);
  if (c.taxNumber) sub.push(`MST ${c.taxNumber}`);
  if (c.phone) sub.push(c.phone);
  if (c.email) sub.push(c.email);
  if (c.licensePlate) sub.push(c.licensePlate);

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
      <div className="flex items-start justify-between gap-2 p-2 rounded-lg bg-slate-50">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm truncate">{name}</span>
            {cc.isPrimary && <Badge variant="default" className="text-[10px]">Đại diện</Badge>}
          </div>
          {sub.length > 0 && (
            <div className="text-[11px] text-slate-500 truncate">{sub.join(" · ")}</div>
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
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (type === "INDIVIDUAL" && !fullName.trim()) return toast.error("Nhập Họ và tên");
    if (type === "COMPANY" && !companyName.trim()) return toast.error("Nhập Tên công ty");
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
              <div className="space-y-1.5 col-span-2">
                <Label className="text-xs">Người đại diện</Label>
                <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Tên người đại diện" />
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
  const [fullName, setFullName] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [licensePlate, setLicensePlate] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [taxNumber, setTaxNumber] = useState("");
  const [saving, setSaving] = useState(false);

  function reset() {
    setType(defaultType);
    setFullName(""); setIdNumber(""); setPhone(""); setEmail(""); setLicensePlate("");
    setCompanyName(""); setTaxNumber("");
  }

  async function submit() {
    if (type === "INDIVIDUAL" && !fullName.trim()) return toast.error("Nhập Họ và tên");
    if (type === "COMPANY" && !companyName.trim()) return toast.error("Nhập Tên công ty");
    setSaving(true);
    const res = await fetch(`/api/contracts/${contractId}/customers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type,
        // For COMPANY: fullName is the contact person ("Người đại diện").
        fullName: fullName.trim() || undefined,
        idNumber: idNumber.trim() || undefined,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        licensePlate: licensePlate.trim() || undefined,
        companyName: type === "COMPANY" ? companyName.trim() : undefined,
        taxNumber: taxNumber.trim() || undefined,
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
      <DialogContent>
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
          {type === "INDIVIDUAL" ? (
            <>
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
            </>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5 col-span-2">
                <Label className="text-xs">Tên công ty</Label>
                <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label className="text-xs">Người đại diện</Label>
                <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Tên người đại diện" />
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
          <Button variant="ghost" onClick={() => { reset(); onClose(); }}>Huỷ</Button>
          <Button variant="gradient" onClick={submit} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Thêm khách
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
    <div className="flex justify-between items-baseline">
      <span className="text-slate-500">{label}</span>
      <span className={bold ? "font-bold" : ""}>{value}</span>
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
    return addMonths(new Date(restartDate), extensionMonths).toISOString().slice(0, 10);
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
                <Input
                  type="date"
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
                <Input value={newEnd} disabled />
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
