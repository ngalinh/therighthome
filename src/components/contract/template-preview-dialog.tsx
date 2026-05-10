"use client";
import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Printer, Download, X } from "lucide-react";
import { toast } from "sonner";

export function TemplatePreviewDialog({
  open, onClose, docxUrl,
}: {
  open: boolean;
  onClose: () => void;
  docxUrl: string | null;
}) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (!open || !docxUrl) {
      setPdfUrl(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/template-preview?url=${encodeURIComponent(docxUrl)}`)
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error || `Lỗi ${r.status}`);
        if (!cancelled) setPdfUrl(d.url);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Convert PDF thất bại");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, docxUrl]);

  function print() {
    // Print via the embedded iframe so the PWA itself never navigates away
    // to /api/files/.../pdf, which would leave users stranded with no
    // back button in standalone PWA mode.
    try {
      frameRef.current?.contentWindow?.focus();
      frameRef.current?.contentWindow?.print();
    } catch {
      toast.error("Không in được");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-2.5 border-b bg-white shrink-0">
          <h3 className="text-sm font-semibold">Xem trước mẫu hợp đồng</h3>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={print} disabled={!pdfUrl}>
              <Printer className="h-3.5 w-3.5" /> In
            </Button>
            {docxUrl && (
              <a
                href={docxUrl}
                rel="noopener"
                download
                className="inline-flex h-9 items-center gap-1.5 rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
              >
                <Download className="h-3.5 w-3.5" /> .docx
              </a>
            )}
            <button onClick={onClose} aria-label="Đóng" className="text-slate-400 hover:text-slate-600 ml-1">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="flex-1 bg-slate-100">
          {loading ? (
            <div className="h-full flex items-center justify-center text-sm text-slate-500 gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Đang tạo bản preview...
            </div>
          ) : error ? (
            <div className="h-full flex items-center justify-center text-sm text-rose-600 px-4 text-center">
              {error}
            </div>
          ) : pdfUrl ? (
            <iframe ref={frameRef} src={pdfUrl} className="w-full h-full border-0 bg-white" title="Preview mẫu HĐ" />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
