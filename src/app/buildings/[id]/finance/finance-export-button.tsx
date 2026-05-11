"use client";
import { ExportExcelButton } from "@/components/ui/export-button";
import type { ExportSheet } from "@/lib/export-xlsx";

// Server tabs (cashbook, pnl) are server components so they can't render the
// client-only ExportExcelButton directly with a sheets-builder function. They
// pre-compute the sheets server-side and hand them as JSON-safe props.
export function FinanceExportButton({
  filename, sheets,
}: {
  filename: string;
  sheets: ExportSheet[];
}) {
  return <ExportExcelButton filename={filename} sheets={sheets} />;
}
