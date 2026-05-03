"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, FileDown } from "lucide-react";
import { toast } from "sonner";
import { exportToXlsx, type ExportSheet } from "@/lib/export-xlsx";

export function ExportExcelButton({
  filename, sheets, label, size = "sm", variant = "outline", className,
}: {
  filename: string;
  sheets: ExportSheet[] | (() => ExportSheet[]);
  label?: string;
  size?: "sm" | "default";
  variant?: "outline" | "ghost" | "default";
  className?: string;
}) {
  const [busy, setBusy] = useState(false);

  async function onClick() {
    setBusy(true);
    try {
      const data = typeof sheets === "function" ? sheets() : sheets;
      const total = data.reduce((s, x) => s + x.rows.length, 0);
      if (total === 0) {
        toast.info("Không có dữ liệu để xuất");
        return;
      }
      await exportToXlsx(filename, data);
      toast.success("Đã xuất file Excel");
    } catch (e) {
      console.error("[export]", e);
      toast.error("Xuất Excel thất bại");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button onClick={onClick} disabled={busy} size={size} variant={variant} className={className}>
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
      {label ?? "Xuất Excel"}
    </Button>
  );
}
