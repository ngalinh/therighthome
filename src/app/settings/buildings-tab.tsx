"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Building2, Edit, Loader2, MapPin, FileSpreadsheet, FileText, Upload, Eye, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ImportClient } from "@/app/import/import-client";
import { TemplatePreviewDialog } from "@/components/contract/template-preview-dialog";

type Building = {
  id: string;
  name: string;
  address: string;
  type: "CHDV" | "VP";
  info: string | null;
};

type AppSettingLite = {
  defaultContractTemplateChdv: string | null;
  defaultContractTemplateVpIndividual: string | null;
  defaultContractTemplateVpCompany: string | null;
} | null;

export function BuildingsTab({ buildings, appSetting }: { buildings: Building[]; appSetting: AppSettingLite }) {
  const [editing, setEditing] = useState<Building | null>(null);

  return (
    <div className="space-y-3">
      <h2 className="text-base font-semibold flex items-center gap-2">
        <Building2 className="h-4 w-4" /> {buildings.length} toà nhà
      </h2>

      <div className="space-y-2">
        {buildings.map((b) => (
          <Card key={b.id}>
            <CardContent className="p-4 flex items-start gap-3">
              <div
                className={`h-11 w-11 rounded-xl flex items-center justify-center text-white shrink-0 ${
                  b.type === "CHDV" ? "bg-gradient-chdv" : "bg-gradient-vp"
                }`}
              >
                <Building2 className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium">{b.name}</span>
                  <Badge variant={b.type === "CHDV" ? "chdv" : "vp"} className="text-[10px]">
                    {b.type === "CHDV" ? "Căn hộ DV" : "Văn phòng"}
                  </Badge>
                </div>
                <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> {b.address}
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={() => setEditing(b)}>
                <Edit className="h-3.5 w-3.5" /> Sửa
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <EditDialog
        key={editing?.id ?? "none"}
        building={editing}
        onClose={() => setEditing(null)}
      />

      <div className="pt-6 mt-2 border-t border-slate-200/70">
        <h2 className="text-base font-semibold flex items-center gap-2 mb-3">
          <FileText className="h-4 w-4" /> Mẫu hợp đồng mặc định
        </h2>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Mẫu áp dụng cho mọi toà chưa upload mẫu riêng</CardTitle>
            <p className="text-[11px] text-slate-500 mt-1">
              Khi tạo HĐ, hệ thống ưu tiên mẫu riêng của toà. Nếu toà chưa có, sẽ dùng mẫu mặc định ở đây theo loại + loại khách (cá nhân / công ty).
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <DefaultTemplateSlot label="Mẫu HĐ — Căn hộ dịch vụ" kind="chdv" url={appSetting?.defaultContractTemplateChdv ?? null} />
            <DefaultTemplateSlot label="Mẫu HĐ — Văn phòng (Khách cá nhân)" kind="vpIndividual" url={appSetting?.defaultContractTemplateVpIndividual ?? null} />
            <DefaultTemplateSlot label="Mẫu HĐ — Văn phòng (Khách công ty)" kind="vpCompany" url={appSetting?.defaultContractTemplateVpCompany ?? null} />
          </CardContent>
        </Card>
      </div>

      <div className="pt-6 mt-2 border-t border-slate-200/70">
        <h2 className="text-base font-semibold flex items-center gap-2 mb-3">
          <FileSpreadsheet className="h-4 w-4" /> Import dữ liệu Excel
        </h2>
        <ImportClient />
      </div>
    </div>
  );
}

function EditDialog({ building, onClose }: { building: Building | null; onClose: () => void }) {
  const router = useRouter();
  const [name, setName] = useState(building?.name ?? "");
  const [address, setAddress] = useState(building?.address ?? "");
  const [type, setType] = useState<"CHDV" | "VP">(building?.type ?? "CHDV");
  const [info, setInfo] = useState(building?.info ?? "");
  const [loading, setLoading] = useState(false);

  if (!building) return null;

  async function submit() {
    if (!name.trim() || !address.trim()) return toast.error("Tên + địa chỉ không được để trống");
    setLoading(true);
    const payload: Record<string, string | null> = { name, address, info: info.trim() || null };
    if (type !== building!.type) payload.type = type;
    const res = await fetch(`/api/buildings/${building!.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setLoading(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return toast.error(err.error || "Có lỗi");
    }
    toast.success("Đã lưu");
    onClose();
    router.refresh();
  }

  return (
    <Dialog
      open={!!building}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sửa toà nhà</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Loại toà nhà</Label>
            <Select value={type} onValueChange={(v) => setType(v as "CHDV" | "VP")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CHDV">Căn hộ dịch vụ (CHDV)</SelectItem>
                <SelectItem value="VP">Văn phòng (VP)</SelectItem>
              </SelectContent>
            </Select>
            {type !== building.type && (
              <p className="text-[11px] text-amber-600">
                ⚠ Đổi loại toà nhà sẽ ảnh hưởng đến danh mục thu/chi và PTTT (lọc theo loại). Nên chỉ đổi khi cần thật.
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Tên toà nhà</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Địa chỉ</Label>
            <Input value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Thông tin chung</Label>
            <Textarea
              value={info}
              onChange={(e) => setInfo(e.target.value)}
              rows={10}
              placeholder="Nhập thông tin chung dùng cho mẫu Thông báo phòng trống (nội thất, điện/nước, cọc, hoa hồng, lưu ý, STK ngân hàng, liên hệ…)"
            />
            <p className="text-[11px] text-slate-500">Mỗi dòng hiện riêng. Bắt đầu dòng bằng <code>**</code>{`<heading>`}<code>**</code> để hiện in đậm trong mẫu Thông báo.</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Huỷ
          </Button>
          <Button variant="gradient" onClick={submit} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Lưu
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DefaultTemplateSlot({
  label, kind, url: initialUrl,
}: {
  label: string;
  kind: "chdv" | "vpIndividual" | "vpCompany";
  url: string | null;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState<string | null>(initialUrl);
  const [uploading, setUploading] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.name.toLowerCase().endsWith(".docx")) return toast.error("Chỉ nhận file .docx");
    setUploading(true);
    const fd = new FormData();
    fd.append("file", f);
    fd.append("kind", kind);
    let res: Response;
    try {
      res = await fetch("/api/app-settings/template", { method: "POST", body: fd });
    } catch (err) {
      setUploading(false);
      return toast.error(err instanceof Error ? `Lỗi mạng: ${err.message}` : "Lỗi mạng");
    }
    setUploading(false);
    if (!res.ok) {
      // If the route returned JSON, show its error field. Non-JSON 4xx/5xx
      // (nginx HTML, proxy timeout, runtime crash before NextResponse) used
      // to swallow into "Upload thất bại"; surface status + a snippet so we
      // can tell whether it's a payload-too-large vs server-side issue.
      const ct = res.headers.get("content-type") ?? "";
      if (ct.includes("application/json")) {
        const errBody = await res.json().catch(() => null);
        return toast.error(errBody?.error || `Upload thất bại (HTTP ${res.status})`);
      }
      const text = await res.text().catch(() => "");
      return toast.error(`Upload thất bại (HTTP ${res.status})${text ? `: ${text.slice(0, 160)}` : ""}`);
    }
    const { url: newUrl } = await res.json();
    setUrl(newUrl);
    toast.success("Đã upload mẫu mặc định");
    router.refresh();
  }

  async function clear() {
    if (!confirm("Xoá mẫu mặc định này?")) return;
    setClearing(true);
    const res = await fetch(`/api/app-settings/template?kind=${kind}`, { method: "DELETE" });
    setClearing(false);
    if (!res.ok) return toast.error("Xoá thất bại");
    setUrl(null);
    toast.success("Đã xoá mẫu mặc định");
    router.refresh();
  }

  return (
    <div className="space-y-2">
      <Label className="text-xs">{label}</Label>
      {url ? (
        <div className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-50 border border-emerald-200">
          <span className="flex items-center gap-2 text-sm text-emerald-800"><FileText className="h-4 w-4" /> Đã có mẫu mặc định</span>
          <button
            type="button"
            onClick={() => setPreviewOpen(true)}
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <Eye className="h-3.5 w-3.5" /> Xem
          </button>
        </div>
      ) : (
        <p className="text-xs text-slate-500">Chưa có mẫu mặc định.</p>
      )}
      <div className="flex gap-2">
        <input ref={inputRef} type="file" accept=".docx" className="hidden" onChange={upload} />
        <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={uploading}>
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {url ? "Thay mẫu" : "Upload mẫu .docx"}
        </Button>
        {url && (
          <Button variant="outline" size="sm" onClick={clear} disabled={clearing}>
            {clearing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Xoá
          </Button>
        )}
      </div>
      <TemplatePreviewDialog open={previewOpen} onClose={() => setPreviewOpen(false)} docxUrl={url} />
    </div>
  );
}
