"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function CashbookFilters({
  buildingId, categories, partyKindConfigs, categoryFilter, partyFilter,
}: {
  buildingId: string;
  categories: { id: string; name: string; type: "INCOME" | "EXPENSE" }[];
  partyKindConfigs: { code: string; label: string }[];
  categoryFilter: string;
  partyFilter: string;
}) {
  const router = useRouter();
  const sp = useSearchParams();

  function go(next: { cbCategory?: string; cbParty?: string }) {
    const params = new URLSearchParams(sp);
    params.set("tab", "cashbook");
    if (next.cbCategory != null) {
      if (next.cbCategory === "ALL") params.delete("cbCategory");
      else params.set("cbCategory", next.cbCategory);
    }
    if (next.cbParty != null) {
      if (next.cbParty === "ALL") params.delete("cbParty");
      else params.set("cbParty", next.cbParty);
    }
    router.push(`/buildings/${buildingId}/finance?${params}`);
  }

  return (
    <>
      <Select value={categoryFilter} onValueChange={(v) => go({ cbCategory: v })}>
        <SelectTrigger className="w-[180px]"><SelectValue placeholder="Loại thu/chi" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">Tất cả loại thu/chi</SelectItem>
          {categories.map((c) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={partyFilter} onValueChange={(v) => go({ cbParty: v })}>
        <SelectTrigger className="w-[160px]"><SelectValue placeholder="Đối tượng" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">Tất cả đối tượng</SelectItem>
          {partyKindConfigs.map((p) => <SelectItem key={p.code} value={p.code}>{p.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </>
  );
}
