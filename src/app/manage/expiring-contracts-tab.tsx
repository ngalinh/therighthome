"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty";
import { Textarea } from "@/components/ui/textarea";
import { FileText, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { formatDateVN, formatVND, customerDisplayName } from "@/lib/utils";

type Contract = {
  id: string;
  code: string;
  startDate: string;
  endDate: string;
  monthlyRent: string;
  expiringNote: string | null;
  building: { id: string; name: string };
  room: { number: string };
  customers: {
    isPrimary: boolean;
    customer: { type: string; fullName: string | null; companyName: string | null };
  }[];
};

export function ExpiringContractsTab({
  kind, contracts, daysThreshold,
}: {
  kind: "CHDV" | "VP";
  contracts: Contract[];
  daysThreshold: number;
}) {
  if (contracts.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title="Không có hợp đồng nào sắp hết hạn"
        description={`Trong ${daysThreshold} ngày tới, các hợp đồng ${kind === "CHDV" ? "căn hộ dịch vụ" : "văn phòng"} đều an toàn.`}
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
        <AlertTriangle className="h-4 w-4" />
        <span>
          {contracts.length} hợp đồng sắp hết hạn trong {daysThreshold} ngày tới.
        </span>
      </div>

      {/* Mobile cards */}
      <div className="space-y-2 lg:hidden">
        {contracts.map((c) => (
          <ContractCard key={c.id} contract={c} />
        ))}
      </div>

      {/* Desktop table */}
      <Card className="hidden lg:block">
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                <th className="px-3 py-2.5 text-left">Toà nhà</th>
                <th className="px-3 py-2.5 text-left">Phòng / Mã HĐ</th>
                <th className="px-3 py-2.5 text-left">Khách thuê</th>
                <th className="px-3 py-2.5 text-center">Hết hạn</th>
                <th className="px-3 py-2.5 text-right">Giá thuê</th>
                <th className="px-3 py-2.5 text-left">Ghi chú</th>
              </tr>
            </thead>
            <tbody>
              {contracts.map((c) => (
                <ContractRow key={c.id} contract={c} />
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

function ContractRow({ contract }: { contract: Contract }) {
  const primary = contract.customers.find((cc) => cc.isPrimary)?.customer;
  const name = customerDisplayName(primary);
  const daysLeft = Math.ceil((new Date(contract.endDate).getTime() - Date.now()) / (24 * 3600 * 1000));
  const rent = BigInt(contract.monthlyRent);

  return (
    <tr className="border-t hover:bg-slate-50/60 align-top">
      <td className="px-3 py-2.5">
        <div className="line-clamp-2 break-words" style={{ maxWidth: 180, minWidth: 140 }} title={contract.building.name}>
          {contract.building.name}
        </div>
      </td>
      <td className="px-3 py-2.5 whitespace-nowrap">
        <Link
          href={`/buildings/${contract.building.id}/contracts/${contract.id}/edit`}
          className="block hover:underline"
        >
          <div className="font-semibold text-sm text-slate-900">{contract.room.number}</div>
          <div className="font-mono text-[11px] text-primary">{contract.code}</div>
        </Link>
      </td>
      <td className="px-3 py-2.5">
        <div className="line-clamp-2 break-words" style={{ maxWidth: 220, minWidth: 160 }} title={name}>{name}</div>
      </td>
      <td className="px-3 py-2.5 text-center whitespace-nowrap">
        <div className="text-sm font-semibold text-slate-800">{formatDateVN(contract.endDate)}</div>
        <Badge variant={daysLeft <= 7 ? "destructive" : "warning"} className="text-[10px] mt-1">
          Còn {daysLeft}d
        </Badge>
      </td>
      <td className="px-3 py-2.5 text-right whitespace-nowrap font-medium text-emerald-700">
        {formatVND(rent)}
      </td>
      <td className="px-3 py-2.5" style={{ minWidth: 240 }}>
        <NotesEditor contractId={contract.id} initial={contract.expiringNote ?? ""} />
      </td>
    </tr>
  );
}

function ContractCard({ contract }: { contract: Contract }) {
  const primary = contract.customers.find((cc) => cc.isPrimary)?.customer;
  const name = customerDisplayName(primary);
  const daysLeft = Math.ceil((new Date(contract.endDate).getTime() - Date.now()) / (24 * 3600 * 1000));

  return (
    <Card>
      <CardContent className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="text-xs text-slate-500">{contract.building.name}</div>
            <Link
              href={`/buildings/${contract.building.id}/contracts/${contract.id}/edit`}
              className="block hover:underline mt-0.5"
            >
              <div className="font-semibold">Phòng {contract.room.number}</div>
              <div className="text-[11px] font-mono text-primary">{contract.code}</div>
            </Link>
            <div className="text-sm mt-1 line-clamp-2 break-words" title={name}>{name}</div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-xs font-semibold text-slate-700">{formatDateVN(contract.endDate)}</div>
            <Badge variant={daysLeft <= 7 ? "destructive" : "warning"} className="text-[10px] mt-1">
              Còn {daysLeft}d
            </Badge>
          </div>
        </div>
        <NotesEditor contractId={contract.id} initial={contract.expiringNote ?? ""} />
      </CardContent>
    </Card>
  );
}

function NotesEditor({ contractId, initial }: { contractId: string; initial: string }) {
  const router = useRouter();
  const [value, setValue] = useState(initial);
  const [saving, setSaving] = useState(false);
  const dirty = value !== initial;

  async function save() {
    setSaving(true);
    const res = await fetch(`/api/contracts/${contractId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expiringNote: value || null }),
    });
    setSaving(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return toast.error(err.error || "Lưu ghi chú thất bại");
    }
    toast.success("Đã lưu ghi chú");
    router.refresh();
  }

  return (
    <div className="space-y-1.5">
      <Textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={2}
        placeholder="Ghi chú nhanh — tự động lưu khi bấm ✓"
        className="min-h-[60px] text-sm"
      />
      {dirty && (
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => setValue(initial)}
            className="text-[11px] text-slate-500 hover:text-slate-700"
            disabled={saving}
          >
            Huỷ
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="text-[11px] font-medium text-primary hover:underline flex items-center gap-1"
          >
            {saving && <Loader2 className="h-3 w-3 animate-spin" />}
            ✓ Lưu
          </button>
        </div>
      )}
    </div>
  );
}
