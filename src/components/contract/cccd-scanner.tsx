"use client";
import { useState, useRef } from "react";
import { Camera, Loader2, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export type CCCDData = {
  idNumber?: string;
  fullName?: string;
  dateOfBirth?: string;
  gender?: string;
  hometown?: string;
  permanentAddress?: string;
  frontUrl?: string;
  backUrl?: string;
};

export function CCCDScanner({
  onConfirm,
  initial,
}: {
  onConfirm: (data: CCCDData) => void;
  initial?: Partial<CCCDData>;
}) {
  const [front, setFront] = useState<File | null>(null);
  const [back, setBack] = useState<File | null>(null);
  const [scanning, setScanning] = useState(false);
  const [data, setData] = useState<CCCDData>(initial ?? {});

  async function scan() {
    if (!front && !back) {
      toast.error("Vui lòng chọn ít nhất 1 ảnh");
      return;
    }
    setScanning(true);
    const fd = new FormData();
    if (front) fd.append("front", front);
    if (back) fd.append("back", back);
    try {
      const res = await fetch("/api/ocr/cccd", { method: "POST", body: fd });
      if (!res.ok) throw new Error();
      const d = await res.json();
      setData((prev) => ({ ...prev, ...d }));
      toast.success("Đã quét CCCD. Vui lòng kiểm tra lại.");
    } catch {
      toast.error("Quét CCCD thất bại. Bạn có thể nhập tay.");
    } finally {
      setScanning(false);
    }
  }

  function update<K extends keyof CCCDData>(key: K, value: CCCDData[K]) {
    setData((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <PhotoPicker label="Ảnh mặt trước" file={front} onChange={setFront} />
        <PhotoPicker label="Ảnh mặt sau" file={back} onChange={setBack} />
      </div>

      <Button type="button" onClick={scan} disabled={scanning} variant="outline" className="w-full">
        {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
        {scanning ? "Đang quét..." : "Quét CCCD bằng AI"}
      </Button>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Họ và tên" value={data.fullName ?? ""} onChange={(v) => update("fullName", v)} />
        <Field label="Số CCCD" value={data.idNumber ?? ""} onChange={(v) => update("idNumber", v)} />
        <Field label="Ngày sinh" type="date" value={data.dateOfBirth ?? ""} onChange={(v) => update("dateOfBirth", v)} />
        <Field label="Giới tính" value={data.gender ?? ""} onChange={(v) => update("gender", v)} />
        <Field label="Quê quán" value={data.hometown ?? ""} onChange={(v) => update("hometown", v)} className="sm:col-span-2" />
        <Field label="Thường trú" value={data.permanentAddress ?? ""} onChange={(v) => update("permanentAddress", v)} className="sm:col-span-2" />
      </div>

      <Button
        type="button"
        variant="gradient"
        className="w-full"
        onClick={() => {
          if (!data.fullName?.trim()) { toast.error("Cần nhập họ tên"); return; }
          if (!data.idNumber?.trim()) { toast.error("Cần nhập số CCCD"); return; }
          onConfirm(data);
        }}
      >
        <Check className="h-4 w-4" /> Xác nhận thông tin
      </Button>
    </div>
  );
}

function PhotoPicker({
  label, file, onChange,
}: {
  label: string; file: File | null; onChange: (f: File | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const url = file ? URL.createObjectURL(file) : null;
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <div className="mt-1 relative">
        {url ? (
          <div className="relative aspect-[1.6/1] rounded-xl overflow-hidden border bg-slate-50">
            <img src={url} alt={label} className="w-full h-full object-cover" />
            <button
              type="button"
              onClick={() => onChange(null)}
              className="absolute top-1 right-1 h-6 w-6 rounded-full bg-black/60 text-white flex items-center justify-center"
              aria-label="Xoá"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="aspect-[1.6/1] w-full rounded-xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400 hover:border-primary hover:text-primary transition-colors"
          >
            <Camera className="h-6 w-6 mb-1" />
            <span className="text-xs">Chụp / Chọn ảnh</span>
          </button>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => onChange(e.target.files?.[0] || null)}
        />
      </div>
    </div>
  );
}

function Field({
  label, value, onChange, type = "text", className,
}: {
  label: string; value: string; onChange: (v: string) => void; type?: string; className?: string;
}) {
  return (
    <div className={`space-y-1 ${className ?? ""}`}>
      <Label className="text-xs">{label}</Label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
