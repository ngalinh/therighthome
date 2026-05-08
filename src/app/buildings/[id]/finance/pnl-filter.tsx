"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

const RANGES = [
  { value: "month", label: "Trong tháng" },
  { value: "6m", label: "6 tháng" },
  { value: "1y", label: "1 năm" },
  { value: "all", label: "Tất cả" },
  { value: "custom", label: "Tuỳ chọn" },
];

export function PnLFilter({
  buildingId, range, from, to,
}: {
  buildingId: string;
  range: string;
  from: string | null;
  to: string | null;
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const [customFrom, setCustomFrom] = useState(from ?? "");
  const [customTo, setCustomTo] = useState(to ?? "");

  function setRange(r: string) {
    const params = new URLSearchParams(sp);
    params.set("tab", "pnl");
    params.set("range", r);
    if (r !== "custom") {
      params.delete("from");
      params.delete("to");
    }
    router.push(`/buildings/${buildingId}/finance?${params}`);
  }

  function applyCustom() {
    if (!customFrom || !customTo) return;
    const params = new URLSearchParams(sp);
    params.set("tab", "pnl");
    params.set("range", "custom");
    params.set("from", customFrom);
    params.set("to", customTo);
    router.push(`/buildings/${buildingId}/finance?${params}`);
  }

  return (
    <div className="flex flex-wrap gap-2 items-end">
      <div className="space-y-1">
        <Label className="text-xs">Khoảng thời gian</Label>
        <Select value={range} onValueChange={setRange}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {RANGES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {range === "custom" && (
        <>
          <div className="space-y-1">
            <Label className="text-xs">Từ ngày</Label>
            <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="w-[160px]" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Đến ngày</Label>
            <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="w-[160px]" />
          </div>
          <Button size="sm" onClick={applyCustom} disabled={!customFrom || !customTo}>Áp dụng</Button>
        </>
      )}
    </div>
  );
}
