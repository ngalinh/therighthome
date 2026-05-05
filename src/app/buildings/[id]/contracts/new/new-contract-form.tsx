"use client";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Plus, User, Building2 as Office, Trash2, Check, ImagePlus, X } from "lucide-react";
import { toast } from "sonner";
import { CCCDScanner, type CCCDData } from "@/components/contract/cccd-scanner";
import { addMonths, parseVNDInput, formatNumber } from "@/lib/utils";

type Customer = { kind: "INDIVIDUAL"; data: CCCDData & { phone?: string; email?: string; licensePlate?: string } } | { kind: "COMPANY"; data: { companyName: string; taxNumber: string; phone?: string; email?: string; contactName?: string; businessLicenseUrls?: string[] } };

export function NewContractForm({
  buildingId,
  buildingType,
  rooms,
  defaults,
}: {
  buildingId: string;
  buildingType: "CHDV" | "VP";
  rooms: { id: string; number: string }[];
  defaults: { electricityPricePerKwh: string; parkingFeePerVehicle: string; serviceFee: string; waterPricePerPerson: string; paymentDay: number };
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [showAdd, setShowAdd] = useState(true);
  const [newCustKind, setNewCustKind] = useState<"INDIVIDUAL" | "COMPANY">(buildingType === "VP" ? "INDIVIDUAL" : "INDIVIDUAL");

  // Contract fields
  const [roomId, setRoomId] = useState("");
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [termMonths, setTermMonths] = useState<number>(buildingType === "CHDV" ? 12 : 12);
  const [paymentDay, setPaymentDay] = useState<number>(defaults.paymentDay);
  const [monthlyRent, setMonthlyRent] = useState("");
  const [vatRate, setVatRate] = useState<number>(buildingType === "VP" ? 10 : 0);
  const [deposit, setDeposit] = useState("");
  const [parkingCount, setParkingCount] = useState(0);
  const [parkingFeePerVehicle, setParkingFeePerVehicle] = useState(defaults.parkingFeePerVehicle);
  const [serviceFee, setServiceFee] = useState(defaults.serviceFee);
  const [waterPricePerPerson, setWaterPricePerPerson] = useState(defaults.waterPricePerPerson);
  const [electricityPricePerKwh, setElectricityPricePerKwh] = useState(defaults.electricityPricePerKwh);
  const [notes, setNotes] = useState("");
  // VP yearly rents
  const [yearlyRents, setYearlyRents] = useState<{ y2?: string; y3?: string }>({});

  const endDate = startDate ? addMonths(new Date(startDate), termMonths).toISOString().slice(0, 10) : "";

  function addCustomer(c: Customer) {
    if (buildingType === "VP" && customers.length >= 1) {
      toast.error("Văn phòng chỉ có 1 khách thuê (cá nhân hoặc công ty)");
      return;
    }
    if (buildingType === "CHDV" && customers.length >= 2) {
      toast.error("CHDV tối đa 2 khách thuê");
      return;
    }
    setCustomers((cs) => [...cs, c]);
    setShowAdd(false);
  }

  async function submit() {
    if (!roomId) return toast.error("Chọn phòng");
    if (customers.length === 0) return toast.error("Cần ít nhất 1 khách thuê");
    if (!monthlyRent) return toast.error("Nhập giá thuê");
    setSubmitting(true);

    const payload = {
      roomId,
      startDate,
      termMonths,
      paymentDay,
      monthlyRent: parseVNDInput(monthlyRent).toString(),
      vatRate: vatRate / 100,
      depositAmount: parseVNDInput(deposit).toString(),
      parkingCount,
      parkingFeePerVehicle: parseVNDInput(parkingFeePerVehicle).toString(),
      serviceFeeAmount: parseVNDInput(serviceFee).toString(),
      waterPricePerPerson: parseVNDInput(waterPricePerPerson).toString(),
      electricityPricePerKwh: parseVNDInput(electricityPricePerKwh).toString(),
      notes,
      customers,
      yearlyRents:
        buildingType === "VP"
          ? [
              { yearIndex: 1, rent: parseVNDInput(monthlyRent).toString() },
              ...(yearlyRents.y2 ? [{ yearIndex: 2, rent: parseVNDInput(yearlyRents.y2).toString() }] : []),
              ...(yearlyRents.y3 ? [{ yearIndex: 3, rent: parseVNDInput(yearlyRents.y3).toString() }] : []),
            ]
          : [],
    };

    const res = await fetch(`/api/buildings/${buildingId}/contracts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSubmitting(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toast.error(err.error || "Có lỗi xảy ra");
      return;
    }
    toast.success("Đã tạo hợp đồng");
    router.push(`/buildings/${buildingId}/contracts`);
    router.refresh();
  }

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      {/* Left: customers */}
      <div className="lg:col-span-1 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Khách thuê {customers.length > 0 && `(${customers.length})`}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {customers.map((c, i) => (
              <div key={i} className="rounded-xl border p-3 flex items-start gap-2">
                <div className="h-9 w-9 rounded-full bg-gradient-brand text-white flex items-center justify-center shrink-0">
                  {c.kind === "INDIVIDUAL" ? <User className="h-4 w-4" /> : <Office className="h-4 w-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">
                    {c.kind === "INDIVIDUAL" ? c.data.fullName : c.data.companyName}
                  </div>
                  <div className="text-xs text-slate-500 truncate">
                    {c.kind === "INDIVIDUAL" ? c.data.idNumber : `MST: ${c.data.taxNumber}`}
                  </div>
                  {i === 0 && <span className="text-[10px] text-primary font-medium">KHÁCH CHÍNH</span>}
                </div>
                <button onClick={() => setCustomers((cs) => cs.filter((_, j) => j !== i))} className="text-slate-400 hover:text-rose-500">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}

            {showAdd ? (
              <AddCustomerSection
                buildingType={buildingType}
                kind={newCustKind}
                setKind={setNewCustKind}
                onAdd={addCustomer}
                onCancel={() => setShowAdd(false)}
                showCancel={customers.length > 0}
              />
            ) : (
              ((buildingType === "CHDV" && customers.length < 2) || (buildingType === "VP" && customers.length < 1)) && (
                <Button variant="outline" size="sm" className="w-full" onClick={() => setShowAdd(true)}>
                  <Plus className="h-4 w-4" /> Thêm khách thuê {buildingType === "CHDV" && customers.length === 1 && "2"}
                </Button>
              )
            )}
          </CardContent>
        </Card>
      </div>

      {/* Right: contract details */}
      <div className="lg:col-span-2 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Thông tin hợp đồng</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Phòng" required>
                <Select value={roomId} onValueChange={setRoomId}>
                  <SelectTrigger><SelectValue placeholder="Chọn phòng trống" /></SelectTrigger>
                  <SelectContent>
                    {rooms.map((r) => (
                      <SelectItem key={r.id} value={r.id}>Phòng {r.number}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Thời hạn HĐ">
                <Select value={String(termMonths)} onValueChange={(v) => setTermMonths(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(buildingType === "CHDV" ? [3, 6, 12] : [12, 24, 36]).map((m) => (
                      <SelectItem key={m} value={String(m)}>
                        {buildingType === "CHDV" ? `${m} tháng` : `${m / 12} năm`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Ngày bắt đầu" required>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </Field>
              <Field label="Ngày kết thúc (tự động)">
                <Input value={endDate} disabled />
              </Field>
              <Field label="Ngày thanh toán hàng tháng">
                <Input type="number" min={1} max={28} value={paymentDay} onChange={(e) => setPaymentDay(Number(e.target.value))} />
              </Field>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Giá thuê / tháng (sau VAT, đã gồm VAT)" required>
                <VNDInput value={monthlyRent} onChange={setMonthlyRent} />
                {(() => {
                  const r = parseVNDInput(monthlyRent);
                  const v = (r * BigInt(Math.round(vatRate * 100))) / 10000n;
                  return vatRate > 0 && r > 0n ? (
                    <p className="text-[11px] text-slate-500 mt-1">
                      = {formatNumber(r - v)} chưa VAT + {formatNumber(v)} VAT
                    </p>
                  ) : null;
                })()}
              </Field>
              {buildingType === "VP" && (
                <Field label="VAT (%)">
                  <Input type="number" value={vatRate} onChange={(e) => setVatRate(Number(e.target.value))} />
                </Field>
              )}
              <Field label="Tiền cọc">
                <VNDInput value={deposit} onChange={setDeposit} />
              </Field>
              {buildingType === "VP" && termMonths >= 24 && (
                <Field label="Giá năm 2">
                  <VNDInput value={yearlyRents.y2 ?? ""} onChange={(v) => setYearlyRents((y) => ({ ...y, y2: v }))} />
                </Field>
              )}
              {buildingType === "VP" && termMonths >= 36 && (
                <Field label="Giá năm 3">
                  <VNDInput value={yearlyRents.y3 ?? ""} onChange={(v) => setYearlyRents((y) => ({ ...y, y3: v }))} />
                </Field>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Phí điện, xe, dịch vụ</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Đơn giá điện (₫/kWh)">
                <VNDInput value={electricityPricePerKwh} onChange={setElectricityPricePerKwh} />
              </Field>
              <Field label="Số xe gửi">
                <Input type="number" min={0} value={parkingCount} onChange={(e) => setParkingCount(Number(e.target.value))} />
              </Field>
              <Field label="Phí gửi xe (₫/xe/tháng)">
                <VNDInput value={parkingFeePerVehicle} onChange={setParkingFeePerVehicle} />
              </Field>
              <Field label="Phí dịch vụ (₫/tháng)">
                <VNDInput value={serviceFee} onChange={setServiceFee} />
              </Field>
              {buildingType === "CHDV" && (
                <Field label="Tiền nước (₫/người/tháng)">
                  <VNDInput value={waterPricePerPerson} onChange={setWaterPricePerPerson} />
                </Field>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Ghi chú</CardTitle></CardHeader>
          <CardContent>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ghi chú khác..." />
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button variant="gradient" size="lg" onClick={submit} disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            <Check className="h-4 w-4" /> Tạo hợp đồng
          </Button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}{required && <span className="text-rose-500"> *</span>}</Label>
      {children}
    </div>
  );
}

function VNDInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const display = value ? formatNumber(parseVNDInput(value)) : "";
  return (
    <Input
      value={display}
      inputMode="numeric"
      onChange={(e) => onChange(e.target.value)}
      placeholder="0"
    />
  );
}

function AddCustomerSection({
  buildingType, kind, setKind, onAdd, onCancel, showCancel,
}: {
  buildingType: "CHDV" | "VP";
  kind: "INDIVIDUAL" | "COMPANY";
  setKind: (k: "INDIVIDUAL" | "COMPANY") => void;
  onAdd: (c: Customer) => void;
  onCancel: () => void;
  showCancel: boolean;
}) {
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [licensePlate, setLicensePlate] = useState("");

  // Company fields
  const [companyName, setCompanyName] = useState("");
  const [taxNumber, setTaxNumber] = useState("");
  const [contactName, setContactName] = useState("");
  const [bizFiles, setBizFiles] = useState<File[]>([]);
  const [bizUploading, setBizUploading] = useState(false);
  const bizInputRef = useRef<HTMLInputElement>(null);
  const MAX_BIZ_IMAGES = 3;

  function addBizFiles(list: FileList | null) {
    if (!list) return;
    const incoming = Array.from(list);
    const room = MAX_BIZ_IMAGES - bizFiles.length;
    if (room <= 0) {
      toast.error(`Tối đa ${MAX_BIZ_IMAGES} ảnh ĐKKD`);
      return;
    }
    if (incoming.length > room) {
      toast.error(`Chỉ thêm được ${room} ảnh nữa (tối đa ${MAX_BIZ_IMAGES})`);
    }
    setBizFiles((prev) => [...prev, ...incoming.slice(0, room)]);
  }

  async function uploadBizLicense(): Promise<string[]> {
    if (bizFiles.length === 0) return [];
    setBizUploading(true);
    try {
      const fd = new FormData();
      bizFiles.forEach((f) => fd.append("files", f));
      const res = await fetch("/api/upload/id-doc", { method: "POST", body: fd });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Lỗi ${res.status}`);
      }
      const d = await res.json();
      return Array.isArray(d.urls) ? d.urls : [];
    } finally {
      setBizUploading(false);
    }
  }

  return (
    <div className="rounded-xl border-2 border-dashed border-primary/30 p-3 bg-primary/5 space-y-3">
      {buildingType === "VP" && (
        <Tabs value={kind} onValueChange={(v) => setKind(v as "INDIVIDUAL" | "COMPANY")}>
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="INDIVIDUAL">Cá nhân</TabsTrigger>
            <TabsTrigger value="COMPANY">Công ty</TabsTrigger>
          </TabsList>
        </Tabs>
      )}

      {kind === "INDIVIDUAL" ? (
        <CCCDScanner
          onConfirm={(d) => onAdd({ kind: "INDIVIDUAL", data: { ...d, phone, email, licensePlate } })}
        />
      ) : (
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Ảnh ĐKKD (tối đa {MAX_BIZ_IMAGES})</Label>
            <div className="mt-1 grid grid-cols-3 gap-2">
              {bizFiles.map((f, i) => {
                const url = URL.createObjectURL(f);
                return (
                  <div key={i} className="relative aspect-[1.6/1] rounded-lg overflow-hidden border bg-slate-50">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt={`ĐKKD ${i + 1}`} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setBizFiles((prev) => prev.filter((_, j) => j !== i))}
                      className="absolute top-1 right-1 h-5 w-5 rounded-full bg-black/60 text-white flex items-center justify-center"
                      aria-label="Xoá"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                );
              })}
              {bizFiles.length < MAX_BIZ_IMAGES && (
                <button
                  type="button"
                  onClick={() => bizInputRef.current?.click()}
                  className="aspect-[1.6/1] rounded-lg border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400 hover:border-primary hover:text-primary transition-colors"
                >
                  <ImagePlus className="h-5 w-5 mb-0.5" />
                  <span className="text-[10px]">Thêm ảnh</span>
                </button>
              )}
            </div>
            <input
              ref={bizInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                addBizFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </div>
          <Field label="Tên công ty" required>
            <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
          </Field>
          <Field label="Mã số thuế" required>
            <Input value={taxNumber} onChange={(e) => setTaxNumber(e.target.value)} />
          </Field>
          <Field label="Người liên hệ">
            <Input value={contactName} onChange={(e) => setContactName(e.target.value)} />
          </Field>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <Field label="SĐT">
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
        </Field>
        <Field label="Email">
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        {kind === "INDIVIDUAL" && (
          <Field label="Biển số xe (tuỳ chọn)">
            <Input value={licensePlate} onChange={(e) => setLicensePlate(e.target.value)} />
          </Field>
        )}
      </div>

      {kind === "COMPANY" && (
        <Button
          type="button"
          variant="gradient"
          className="w-full"
          disabled={bizUploading}
          onClick={async () => {
            if (!companyName || !taxNumber) {
              toast.error("Cần Tên công ty và Mã số thuế");
              return;
            }
            try {
              const businessLicenseUrls = await uploadBizLicense();
              onAdd({ kind: "COMPANY", data: { companyName, taxNumber, phone, email, contactName, businessLicenseUrls } });
            } catch (e) {
              const msg = e instanceof Error ? e.message : "Upload ĐKKD thất bại";
              toast.error(msg);
            }
          }}
        >
          {bizUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Thêm khách
        </Button>
      )}

      {showCancel && (
        <Button type="button" variant="ghost" size="sm" className="w-full" onClick={onCancel}>Huỷ</Button>
      )}
    </div>
  );
}

