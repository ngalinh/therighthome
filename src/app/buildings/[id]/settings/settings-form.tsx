"use client";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Upload, FileText, Eye, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatNumber, parseVNDInput } from "@/lib/utils";
import { PLACEHOLDER_HELP } from "@/lib/contract-template";
import { TemplatePreviewDialog } from "@/components/contract/template-preview-dialog";

type Setting = {
  electricityPricePerKwh: string;
  parkingFeePerVehicle: string;
  serviceFeeAmount: string;
  waterPricePerPerson: string;
  overtimeFeePerHour: string;
  contractTemplateUrl: string | null;
  contractTemplateUrlCompany: string | null;
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
  const [uploadingIndividual, setUploadingIndividual] = useState(false);
  const [uploadingCompany, setUploadingCompany] = useState(false);
  const indivInputRef = useRef<HTMLInputElement>(null);
  const companyInputRef = useRef<HTMLInputElement>(null);

  const [elec, setElec] = useState(setting?.electricityPricePerKwh ?? "3500");
  const [parking, setParking] = useState(setting?.parkingFeePerVehicle ?? "0");
  const [feeAmt, setFeeAmt] = useState(setting?.serviceFeeAmount ?? "0");
  const [waterPerPerson, setWaterPerPerson] = useState(setting?.waterPricePerPerson ?? "0");
  const [overtimePerHour, setOvertimePerHour] = useState(setting?.overtimeFeePerHour ?? "0");
  const [autoDay, setAutoDay] = useState(setting?.autoGenerateInvoiceDay ?? 1);
  const [dueDay, setDueDay] = useState(setting?.defaultDueDay ?? 5);
  const [tplUrl, setTplUrl] = useState(setting?.contractTemplateUrl ?? null);
  const [tplUrlCompany, setTplUrlCompany] = useState(setting?.contractTemplateUrlCompany ?? null);
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

  async function uploadTemplate(e: React.ChangeEvent<HTMLInputElement>, kind: "individual" | "company") {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.name.toLowerCase().endsWith(".docx")) return toast.error("Chỉ nhận file .docx");
    if (kind === "company") setUploadingCompany(true); else setUploadingIndividual(true);
    const fd = new FormData();
    fd.append("file", f);
    fd.append("kind", kind);
    const res = await fetch(`/api/buildings/${buildingId}/settings/template`, { method: "POST", body: fd });
    if (kind === "company") setUploadingCompany(false); else setUploadingIndividual(false);
    if (!res.ok) return toast.error("Upload thất bại");
    const { url } = await res.json();
    if (kind === "company") setTplUrlCompany(url); else setTplUrl(url);
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
        <CardHeader>
          <CardTitle>Mẫu hợp đồng riêng cho toà này (DOCX)</CardTitle>
          <p className="text-[11px] text-slate-500 mt-1">Khi để trống, hệ thống sẽ dùng mẫu mặc định ở Cài đặt chung.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <TemplateSlot
            label={isVP ? "Mẫu HĐ — Khách cá nhân" : "Mẫu HĐ"}
            url={tplUrl}
            uploading={uploadingIndividual}
            inputRef={indivInputRef}
            onChange={(e) => uploadTemplate(e, "individual")}
            onClear={async () => {
              const res = await fetch(`/api/buildings/${buildingId}/settings/template?kind=individual`, { method: "DELETE" });
              if (!res.ok) { toast.error("Xoá thất bại"); return; }
              setTplUrl(null);
              toast.success("Đã xoá mẫu riêng — sẽ dùng mẫu mặc định");
              router.refresh();
            }}
            canWrite={canWrite}
          />
          {isVP && (
            <TemplateSlot
              label="Mẫu HĐ — Khách công ty"
              url={tplUrlCompany}
              uploading={uploadingCompany}
              inputRef={companyInputRef}
              onChange={(e) => uploadTemplate(e, "company")}
              onClear={async () => {
                const res = await fetch(`/api/buildings/${buildingId}/settings/template?kind=company`, { method: "DELETE" });
                if (!res.ok) { toast.error("Xoá thất bại"); return; }
                setTplUrlCompany(null);
                toast.success("Đã xoá mẫu riêng — sẽ dùng mẫu mặc định");
                router.refresh();
              }}
              canWrite={canWrite}
            />
          )}

          <details className="mt-4">
            <summary className="text-xs text-slate-600 cursor-pointer">Các placeholder hỗ trợ trong file mẫu</summary>
            <pre className="text-[11px] bg-slate-50 p-3 rounded-lg mt-2 overflow-auto">{PLACEHOLDER_HELP}</pre>
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

export function TemplateSlot({
  label, url, uploading, inputRef, onChange, onClear, canWrite,
}: {
  label: string;
  url: string | null;
  uploading: boolean;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClear?: () => Promise<void> | void;
  canWrite: boolean;
}) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [clearing, setClearing] = useState(false);
  return (
    <div className="space-y-2">
      <Label className="text-xs">{label}</Label>
      {url ? (
        <div className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-50 border border-emerald-200">
          <span className="flex items-center gap-2 text-sm text-emerald-800"><FileText className="h-4 w-4" /> Đã có mẫu riêng</span>
          <button
            type="button"
            onClick={() => setPreviewOpen(true)}
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <Eye className="h-3.5 w-3.5" /> Xem
          </button>
        </div>
      ) : (
        <p className="text-xs text-slate-500">Chưa có mẫu riêng — sẽ dùng mẫu mặc định.</p>
      )}
      {canWrite && (
        <div className="flex gap-2">
          <input ref={inputRef} type="file" accept=".docx" className="hidden" onChange={onChange} />
          <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {url ? "Thay mẫu" : "Upload mẫu .docx"}
          </Button>
          {url && onClear && (
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                if (!confirm("Xoá mẫu riêng cho toà này? Sẽ quay về dùng mẫu mặc định.")) return;
                setClearing(true);
                try { await onClear(); } finally { setClearing(false); }
              }}
              disabled={clearing}
            >
              {clearing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Xoá
            </Button>
          )}
        </div>
      )}
      <TemplatePreviewDialog open={previewOpen} onClose={() => setPreviewOpen(false)} docxUrl={url} />
    </div>
  );
}
