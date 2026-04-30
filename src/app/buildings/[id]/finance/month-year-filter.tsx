"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

export function MonthYearFilter({
  buildingId, month, year, tab,
}: {
  buildingId: string;
  month: number;
  year: number;
  tab: string;
}) {
  const router = useRouter();
  const sp = useSearchParams();

  function go(m: number, y: number) {
    const params = new URLSearchParams(sp);
    params.set("tab", tab);
    params.set("month", String(m));
    params.set("year", String(y));
    router.push(`/buildings/${buildingId}/finance?${params}`);
  }

  return (
    <div className="flex gap-2 items-center">
      <Select value={String(month)} onValueChange={(v) => go(Number(v), year)}>
        <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
        <SelectContent>
          {MONTHS.map((m) => <SelectItem key={m} value={String(m)}>Tháng {m}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={String(year)} onValueChange={(v) => go(month, Number(v))}>
        <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
        <SelectContent>
          {[year - 1, year, year + 1].map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}
