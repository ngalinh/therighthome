"use client";
// Tiny client-side XLSX exporter. The xlsx library is dynamically imported on
// click so it doesn't inflate every page's bundle.

export type ExportSheet = {
  name: string;
  rows: Record<string, unknown>[];
};

export async function exportToXlsx(filename: string, sheets: ExportSheet[]): Promise<void> {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  for (const s of sheets) {
    // Sanitize sheet name (Excel: ≤31 chars, no special).
    const safeName = s.name.replace(/[\\/?*[\]:]/g, "").slice(0, 31) || "Sheet";
    const ws = XLSX.utils.json_to_sheet(s.rows);
    XLSX.utils.book_append_sheet(wb, ws, safeName);
  }
  const safeFile = filename.toLowerCase().endsWith(".xlsx") ? filename : `${filename}.xlsx`;
  XLSX.writeFile(wb, safeFile);
}

// Helper: format date YYYY-MM-DD for filenames.
export function todayStamp(): string {
  const d = new Date();
  const z = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${z(d.getMonth() + 1)}${z(d.getDate())}`;
}
