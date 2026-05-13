"use client";
import { useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { Loader2 } from "lucide-react";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

export function PdfViewer({ url }: { url: string }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [numPages, setNumPages] = useState(0);
  const [pageWidth, setPageWidth] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const update = () => setPageWidth(Math.min(el.clientWidth - 16, 900));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={scrollRef} className="w-full h-full overflow-y-auto bg-slate-100 px-2 py-2">
      <Document
        file={url}
        onLoadSuccess={({ numPages: n }) => setNumPages(n)}
        onLoadError={(e) => setError(e.message || "Không tải được PDF")}
        loading={
          <div className="flex items-center justify-center py-12 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin mr-2" /> Đang tải PDF...
          </div>
        }
      >
        {error && <p className="text-xs text-rose-600 p-4">{error}</p>}
        {pageWidth > 0 &&
          Array.from({ length: numPages }, (_, i) => (
            <div key={i} className="mb-2 mx-auto shadow-md w-fit">
              <Page
                pageNumber={i + 1}
                width={pageWidth}
                renderAnnotationLayer={false}
                renderTextLayer={false}
              />
            </div>
          ))}
      </Document>
    </div>
  );
}
