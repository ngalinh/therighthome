"use client";
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Save, X, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { addMonths, parseVNDInput, formatNumber, formatVND } from "@/lib/utils";

type Contract = {
  id: string;
  code: string;
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
  notes: string | null;
  room: { number: string };
  yearlyRents: { yearIndex: number; rent: string }[];
  customers: { isPrimary: boolean; customer: { fullName: string | null; companyName: string | null } }[];
};

export function EditContractForm({
  buildingId,
  buildingType,
  contract,
}: {
  buildingId: string;
  buildingType: "CHDV" | "VP";
  contract: Contract;
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
  const [parkingFeePerVehicle, setParkingFeePerVehicle] = useState(contract.parkingFeePerVehicle);
  const [serviceFee, setServiceFee] = useState(contract.serviceFeeAmount);
  const [electricityPricePerKwh, setElecPrice] = useState(contract.electricityPricePerKwh);
  const [notes, setNotes] = useState(contract.notes ?? "");
  const [yearlyRents, setYearlyRents] = useState(
    contract.yearlyRents.map((y) => ({ yearIndex: y.yearIndex, rent: y.rent })),
  );

  const endDate = useMemo(() => {
    if (!startDate) return "";
    return addMonths(new Date(startDate), termMonths).toISOString().slice(0, 10);
  }, [startDate, termMonths]);

  const rentBigInt = parseVNDInput(monthlyRent);
  const vatAmount = (rentBigInt * BigInt(Math.round(vatRate * 100))) / 10000n;
  const totalAfterVAT = rentBigInt + vatAmount;

  const primaryCustomer = contract.customers.find((c) => c.isPrimary)?.customer;
  const customerName = primaryCustomer?.fullName || primaryCustomer?.companyName || "—";

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
    router.push(`/buildings/${buildingId}/contracts`);
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
            <Row label="Khách thuê" value={customerName} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tóm tắt giá</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <Row label="Giá thuê (chưa VAT)" value={formatVND(rentBigInt)} />
            {vatRate > 0 && (
              <>
                <Row label={`VAT (${vatRate}%)`} value={formatVND(vatAmount)} />
                <Row label="Tổng sau VAT" value={formatVND(totalAfterVAT)} bold />
              </>
            )}
            <Row label="Tiền cọc" value={formatVND(parseVNDInput(deposit))} />
          </CardContent>
        </Card>
      </div>

      <div className="lg:col-span-2 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Thông tin hợp đồng</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
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

            <div className="grid grid-cols-2 gap-3">
              <Field label="Giá thuê / tháng (chưa VAT)" required>
                <VNDInput value={monthlyRent} onChange={setMonthlyRent} />
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
              <p className="text-xs text-slate-500">Chưa có. Bấm Thêm năm nếu HĐ trên 1 năm có giá thuê khác nhau theo năm.</p>
            ) : (
              <div className="space-y-2">
                {yearlyRents
                  .sort((a, b) => a.yearIndex - b.yearIndex)
                  .map((y) => (
                    <div key={y.yearIndex} className="flex items-center gap-2">
                      <Label className="w-20 text-xs">Năm {y.yearIndex}</Label>
                      <VNDInput value={y.rent} onChange={(v) => updateYearlyRent(y.yearIndex, v)} />
                      <button
                        onClick={() => removeYearlyRent(y.yearIndex)}
                        className="text-rose-500 hover:text-rose-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Phí điện, xe, dịch vụ</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
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

        <div className="flex justify-end gap-2">
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
