"use client";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Upload, FileText } from "lucide-react";
import { toast } from "sonner";
import { formatNumber, parseVNDInput } from "@/lib/utils";

type Setting = {
  electricityPricePerKwh: string;
  parkingFeePerVehicle: string;
  serviceFeeAmount: string;
  waterPricePerPerson: string;
  overtimeFeePerHour: string;
  contractTemplateUrl: string | null;
  autoGenerateInvoiceDay: number;
  defaultDueDay: number;
} | null;

export function BuildingSettingsForm({
  buildingId, buildingType, setting, canWrite,
}: {
  buildingId: string;
  buildingType: "CHDV" | "VP";
  setting: Setting;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const [elec, setElec] = useState(setting?.electricityPricePerKwh ?? "3500");
  const [parking, setParking] = useState(setting?.parkingFeePerVehicle ?? "0");
  const [feeAmt, setFeeAmt] = useState(setting?.serviceFeeAmount ?? "0");
  const [waterPerPerson, setWaterPerPerson] = useState(setting?.waterPricePerPerson ?? "0");
  const [overtimePerHour, setOvertimePerHour] = useState(setting?.overtimeFeePerHour ?? "0");
  const [autoDay, setAutoDay] = useState(setting?.autoGenerateInvoiceDay ?? 1);
  const [dueDay, setDueDay] = useState(setting?.defaultDueDay ?? 5);
  const [tplUrl, setTplUrl] = useState(setting?.contractTemplateUrl ?? null);
  const isVP = buildingType === "VP";

  async function save() {
    setSaving(true);
    const res = await fetch(`/api/buildings/${buildingId}/settings`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        electricityPricePerKwh: parseVNDInput(elec).toString(),
        parkingFeePerVehicle: parseVNDInput(parking).toString(),
        serviceFeeAmount: parseVNDInput(feeAmt).toString(),
        waterPricePerPerson: parseVNDInput(waterPerPerson).toString(),
        overtimeFeePerHour: parseVNDInput(overtimePerHour).toString(),
        autoGenerateInvoiceDay: autoDay,
        defaultDueDay: dueDay,
      }),
    });
    setSaving(false);
    if (!res.ok) return toast.error("Lưu thất bại");
    toast.success("Đã lưu cài đặt");
    router.refresh();
  }

  async function uploadTemplate(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.name.toLowerCase().endsWith(".docx")) return toast.error("Chỉ nhận file .docx");
    setUploading(true);
    const fd = new FormData();
    fd.append("file", f);
    const res = await fetch(`/api/buildings/${buildingId}/settings/template`, { method: "POST", body: fd });
    setUploading(false);
    if (!res.ok) return toast.error("Upload thất bại");
    const { url } = await res.json();
    setTplUrl(url);
    toast.success("Đã upload mẫu hợp đồng");
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Phí mặc định</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Đơn giá điện (₫/kWh)">
              <VNDInput value={elec} onChange={setElec} disabled={!canWrite} />
            </Field>
            <Field label="Phí gửi xe (₫/xe/tháng)">
              <VNDInput value={parking} onChange={setParking} disabled={!canWrite} />
            </Field>
            {!isVP && (
              <>
                <Field label="Phí dịch vụ (₫/phòng/tháng)">
                  <VNDInput value={feeAmt} onChange={setFeeAmt} disabled={!canWrite} />
                </Field>
                <Field label="Tiền nước (₫/người/tháng)">
                  <VNDInput value={waterPerPerson} onChange={setWaterPerPerson} disabled={!canWrite} />
                </Field>
              </>
            )}
            {isVP && (
              <Field label="Phí ngoài giờ (₫/giờ)">
                <VNDInput value={overtimePerHour} onChange={setOvertimePerHour} disabled={!canWrite} />
              </Field>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Tự động hoá đơn</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Ngày tạo HĐ tự động (1-28)">
              <Input type="number" min={1} max={28} value={autoDay} onChange={(e) => setAutoDay(Number(e.target.value))} disabled={!canWrite} />
            </Field>
            <Field label="Hạn thanh toán mặc định (ngày)">
              <Input type="number" min={1} max={28} value={dueDay} onChange={(e) => setDueDay(Number(e.target.value))} disabled={!canWrite} />
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Mẫu hợp đồng (DOCX)</CardTitle></CardHeader>
        <CardContent>
          {tplUrl ? (
            <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-50 border border-emerald-200">
              <span className="flex items-center gap-2 text-sm text-emerald-800"><FileText className="h-4 w-4" /> Đã có mẫu hợp đồng</span>
              <a href={tplUrl} target="_blank" rel="noopener" className="text-xs text-primary">Xem</a>
            </div>
          ) : (
            <p className="text-sm text-slate-500">Chưa có mẫu. Khi tạo hợp đồng, file sinh ra sẽ tự động điền các placeholder bên dưới.</p>
          )}

          {canWrite && (
            <>
              <input ref={inputRef} type="file" accept=".docx" className="hidden" onChange={uploadTemplate} />
              <Button variant="outline" size="sm" className="mt-3" onClick={() => inputRef.current?.click()} disabled={uploading}>
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {tplUrl ? "Thay mẫu" : "Upload mẫu .docx"}
              </Button>
            </>
          )}

          <details className="mt-4">
            <summary className="text-xs text-slate-600 cursor-pointer">Các placeholder hỗ trợ trong file mẫu</summary>
            <pre className="text-[11px] bg-slate-50 p-3 rounded-lg mt-2 overflow-auto">
{`{ma_hd}                Mã hợp đồng
{toa_nha}              Tên toà nhà
{dia_chi_toa}          Địa chỉ toà nhà
{so_phong}             Số phòng
{ten_khach}            Tên khách (cá nhân hoặc công ty)
{cccd}                 Số CCCD
{sdt}                  Số điện thoại
{email}                Email
{cong_ty}              Tên công ty (nếu có)
{mst}                  Mã số thuế (nếu có)
{ngay_bat_dau}         Ngày bắt đầu
{ngay_ket_thuc}        Ngày kết thúc
{thoi_han}             Thời hạn hợp đồng
{gia_thue}             Giá thuê / tháng
{tien_coc}             Tiền cọc
{ngay_thanh_toan}      Ngày thanh toán hàng tháng
{ghi_chu}              Ghi chú`}
            </pre>
          </details>
        </CardContent>
      </Card>

      {canWrite && (
        <div className="flex justify-end">
          <Button variant="gradient" onClick={save} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Lưu cài đặt
          </Button>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1"><Label className="text-xs">{label}</Label>{children}</div>;
}

function VNDInput({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const display = value ? formatNumber(parseVNDInput(value)) : "";
  return <Input value={display} inputMode="numeric" onChange={(e) => onChange(e.target.value)} disabled={disabled} />;
}
