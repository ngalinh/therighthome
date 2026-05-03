"use client";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, Upload, FileSpreadsheet, Loader2, CheckCircle, AlertCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type SheetPreview = { rows: unknown[]; errors: { row: number; message: string }[] };
type Preview = { chdv: SheetPreview; vp: SheetPreview };

function StepBadge({ n, active, done }: { n: number; active: boolean; done: boolean }) {
  return (
    <div className={cn(
      "h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all",
      done ? "bg-emerald-500 text-white" : active ? "bg-gradient-brand text-white shadow-[0_4px_12px_-2px_rgba(139,92,246,0.4)]" : "bg-slate-100 text-slate-400"
    )}>
      {done ? <CheckCircle className="h-4 w-4" /> : n}
    </div>
  );
}

export function ImportClient() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [stats, setStats] = useState<Record<string, number> | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f && (f.name.endsWith(".xlsx") || f.name.endsWith(".xls"))) {
      setFile(f); setPreview(null); setStats(null);
    } else {
      toast.error("Chỉ chấp nhận file .xlsx hoặc .xls");
    }
  }

  async function uploadAndPreview() {
    if (!file) return;
    setPreviewing(true);
    setStats(null);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/import/preview", { method: "POST", body: fd });
    setPreviewing(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return toast.error(err.error || "Có lỗi đọc file");
    }
    setPreview(await res.json());
  }

  async function runImport() {
    if (!file) return;
    setImporting(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/import/run", { method: "POST", body: fd });
    setImporting(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return toast.error(err.error || "Import thất bại");
    }
    const { stats } = await res.json();
    setStats(stats);
    setPreview(null);
    setFile(null);
    if (inputRef.current) inputRef.current.value = "";
    toast.success("Import xong");
    router.refresh();
  }

  const totalErrors = preview ? preview.chdv.errors.length + preview.vp.errors.length : 0;

  const step = stats ? 3 : preview ? 2 : file ? 1 : 0;

  return (
    <div className="space-y-4 max-w-2xl">
      {/* Step 1: Download template */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-5">
        <div className="flex items-start gap-3 mb-4">
          <StepBadge n={1} active={step === 0} done={step > 0} />
          <div>
            <h3 className="font-semibold text-slate-900 text-sm">Tải file mẫu Excel</h3>
            <p className="text-xs text-slate-500 mt-0.5">2 sheet: Căn hộ dịch vụ và Văn phòng</p>
          </div>
        </div>
        <Button asChild variant="outline" size="sm" className="ml-10">
          <a href="/api/import/template">
            <Download className="h-4 w-4" /> Tải file mẫu .xlsx
          </a>
        </Button>
      </div>

      {/* Step 2: Upload */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-5">
        <div className="flex items-start gap-3 mb-4">
          <StepBadge n={2} active={step <= 1} done={step > 1} />
          <div>
            <h3 className="font-semibold text-slate-900 text-sm">Upload file đã điền</h3>
            <p className="text-xs text-slate-500 mt-0.5">Kéo thả hoặc bấm chọn file .xlsx</p>
          </div>
        </div>

        <div className="ml-10">
          {!file ? (
            <div
              className={cn(
                "border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all",
                dragging ? "border-primary bg-primary/5" : "border-slate-200 hover:border-primary/50 hover:bg-slate-50"
              )}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => inputRef.current?.click()}
            >
              <div className="h-12 w-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
                <FileSpreadsheet className="h-6 w-6 text-slate-400" />
              </div>
              <p className="text-sm font-medium text-slate-700">Kéo file vào đây hoặc bấm để chọn</p>
              <p className="text-xs text-slate-400 mt-1">Hỗ trợ .xlsx, .xls</p>
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-xl bg-primary/5 border border-primary/20 px-4 py-3">
              <div className="h-9 w-9 rounded-xl bg-gradient-brand flex items-center justify-center shrink-0">
                <FileSpreadsheet className="h-4 w-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900 truncate">{file.name}</p>
                <p className="text-xs text-slate-500">{(file.size / 1024).toFixed(0)} KB</p>
              </div>
              <button onClick={() => { setFile(null); setPreview(null); if (inputRef.current) inputRef.current.value = ""; }}
                className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
          <input ref={inputRef} type="file" accept=".xlsx,.xls" className="hidden"
            onChange={(e) => { setFile(e.target.files?.[0] ?? null); setPreview(null); setStats(null); }} />
          {file && !preview && (
            <Button onClick={uploadAndPreview} disabled={previewing} variant="gradient" size="sm" className="mt-3">
              {previewing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Kiểm tra dữ liệu
            </Button>
          )}
        </div>
      </div>

      {/* Step 3: Preview + import */}
      {preview && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-5">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="flex items-start gap-3">
              <StepBadge n={3} active done={false} />
              <div>
                <h3 className="font-semibold text-slate-900 text-sm">Kiểm tra dữ liệu</h3>
                <p className="text-xs text-slate-500 mt-0.5">Xem lại trước khi import</p>
              </div>
            </div>
            {totalErrors > 0 ? (
              <span className="flex items-center gap-1 text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-100 px-2.5 py-1 rounded-full">
                <AlertCircle className="h-3.5 w-3.5" />{totalErrors} lỗi
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-full">
                <CheckCircle className="h-3.5 w-3.5" />Sẵn sàng
              </span>
            )}
          </div>

          <div className="ml-10 space-y-2 mb-4">
            <PreviewRow label="Căn hộ dịch vụ" rows={preview.chdv} />
            <PreviewRow label="Văn phòng" rows={preview.vp} />
          </div>

          <div className="ml-10">
            <Button onClick={runImport} disabled={totalErrors > 0 || importing} variant="gradient" className="w-full">
              {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
              {totalErrors > 0 ? `Sửa ${totalErrors} lỗi trước khi import` : "Xác nhận import vào hệ thống"}
            </Button>
          </div>
        </div>
      )}

      {/* Success */}
      {stats && (
        <div className="bg-white rounded-2xl border border-emerald-200 shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-6 text-center">
          <div className="h-14 w-14 rounded-2xl bg-emerald-500 flex items-center justify-center mx-auto mb-3">
            <CheckCircle className="h-7 w-7 text-white" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-1">Import thành công!</h3>
          <p className="text-sm text-slate-500 mb-4">Dữ liệu đã được thêm vào hệ thống</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Object.entries(stats).map(([k, v]) => (
              <div key={k} className="rounded-xl bg-slate-50 border border-slate-100 p-3">
                <div className="text-xs text-slate-500 capitalize mb-1">{k}</div>
                <div className="text-2xl font-bold text-emerald-600">{v}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PreviewRow({ label, rows }: { label: string; rows: SheetPreview }) {
  const hasErrors = rows.errors.length > 0;
  return (
    <div className={cn(
      "rounded-xl border p-3 transition-colors",
      hasErrors ? "border-rose-200 bg-rose-50/50" : "border-slate-100 bg-slate-50/50"
    )}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-700">{label}</span>
        <div className="flex gap-1.5">
          <Badge variant="secondary" className="text-[11px] py-0">{rows.rows.length} dòng</Badge>
          {hasErrors && <Badge variant="destructive" className="text-[11px] py-0">{rows.errors.length} lỗi</Badge>}
        </div>
      </div>
      {hasErrors && (
        <ul className="mt-2 space-y-1">
          {rows.errors.slice(0, 5).map((e, i) => (
            <li key={i} className="text-xs text-rose-600 flex gap-1.5">
              <span className="font-mono font-semibold shrink-0">R{e.row}</span>
              <span>{e.message}</span>
            </li>
          ))}
          {rows.errors.length > 5 && <li className="text-xs text-slate-400">…và {rows.errors.length - 5} lỗi khác</li>}
        </ul>
      )}
    </div>
  );
}
