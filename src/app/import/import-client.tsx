"use client";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, Upload, FileSpreadsheet, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";

type Preview = {
  buildings: { rows: unknown[]; errors: { row: number; message: string }[] };
  rooms: { rows: unknown[]; errors: { row: number; message: string }[] };
  customers: { rows: unknown[]; errors: { row: number; message: string }[] };
  contracts: { rows: unknown[]; errors: { row: number; message: string }[] };
  transactions: { rows: unknown[]; errors: { row: number; message: string }[] };
};

export function ImportClient() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [stats, setStats] = useState<Record<string, number> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  const totalErrors = preview
    ? preview.buildings.errors.length + preview.rooms.errors.length + preview.customers.errors.length + preview.contracts.errors.length + preview.transactions.errors.length
    : 0;

  return (
    <div className="space-y-4 max-w-4xl">
      <Card>
        <CardHeader><CardTitle>1. Tải mẫu Excel</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-slate-600">
            File mẫu có 5 sheet: <strong>Toa_nha</strong>, <strong>Phong</strong>, <strong>Khach_hang</strong>, <strong>Hop_dong</strong>, <strong>Giao_dich</strong>. Điền dữ liệu vào, để trống sheet không cần. Sheet không cần thì có thể xoá.
          </p>
          <Button asChild variant="outline">
            <a href="/api/import/template"><Download className="h-4 w-4" /> Tải file mẫu .xlsx</a>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>2. Upload file đã điền</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={(e) => { setFile(e.target.files?.[0] ?? null); setPreview(null); setStats(null); }}
            className="block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-medium file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
          />
          {file && (
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <FileSpreadsheet className="h-4 w-4" /> {file.name}
            </div>
          )}
          <Button onClick={uploadAndPreview} disabled={!file || previewing} variant="gradient">
            {previewing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Xem trước
          </Button>
        </CardContent>
      </Card>

      {preview && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>3. Kiểm tra dữ liệu</CardTitle>
              {totalErrors > 0 ? (
                <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" />{totalErrors} lỗi</Badge>
              ) : (
                <Badge variant="success"><CheckCircle className="h-3 w-3 mr-1" />Sẵn sàng</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <PreviewRow label="Toà nhà" rows={preview.buildings} />
            <PreviewRow label="Phòng" rows={preview.rooms} />
            <PreviewRow label="Khách hàng" rows={preview.customers} />
            <PreviewRow label="Hợp đồng" rows={preview.contracts} />
            <PreviewRow label="Giao dịch" rows={preview.transactions} />
            <Button onClick={runImport} disabled={totalErrors > 0 || importing} variant="gradient" className="w-full">
              {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
              {totalErrors > 0 ? `Sửa lỗi trước (${totalErrors})` : "Import vào hệ thống"}
            </Button>
          </CardContent>
        </Card>
      )}

      {stats && (
        <Card>
          <CardContent className="py-6">
            <div className="text-center space-y-3">
              <CheckCircle className="h-12 w-12 text-emerald-500 mx-auto" />
              <h3 className="text-lg font-semibold">Import thành công</h3>
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                {Object.entries(stats).map(([k, v]) => (
                  <div key={k} className="rounded-lg bg-slate-50 p-3">
                    <div className="text-xs text-slate-500 capitalize">{k}</div>
                    <div className="text-xl font-bold text-emerald-600">{v}</div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function PreviewRow({ label, rows }: { label: string; rows: { rows: unknown[]; errors: { row: number; message: string }[] } }) {
  return (
    <div className="rounded-xl border p-3">
      <div className="flex items-center justify-between">
        <div className="font-medium text-sm">{label}</div>
        <div className="flex gap-2 text-xs">
          <Badge variant="secondary">{rows.rows.length} dòng OK</Badge>
          {rows.errors.length > 0 && <Badge variant="destructive">{rows.errors.length} lỗi</Badge>}
        </div>
      </div>
      {rows.errors.length > 0 && (
        <ul className="mt-2 space-y-1">
          {rows.errors.slice(0, 5).map((e, i) => (
            <li key={i} className="text-xs text-rose-600">Dòng {e.row}: {e.message}</li>
          ))}
          {rows.errors.length > 5 && <li className="text-xs text-slate-500">…và {rows.errors.length - 5} lỗi khác</li>}
        </ul>
      )}
    </div>
  );
}
