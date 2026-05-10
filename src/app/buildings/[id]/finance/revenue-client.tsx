"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowDownCircle, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ExportExcelButton } from "@/components/ui/export-button";
import { formatVND, formatDateVN, formatRoomNumber } from "@/lib/utils";
import { MonthYearFilter } from "./month-year-filter";
import { CreateTransactionDialog } from "./create-transaction-dialog";
import { EditTransactionDialog, type EditableTransaction } from "./edit-transaction-dialog";
import { renderContentWithLinks } from "./render-content";

type PartyKindConfig = { code: string; label: string; forRevenue: boolean; forExpense: boolean };

type Row = {
  key: string;
  date: string;
  roomId: string | null;
  roomNumber: string | null;
  category: string;
  partyKind: string | null;
  partyLabel: string;
  content: string;
  paymentMethod: string;
  opening: string;
  due: string;
  paid: string;
  closing: string;
  tx: EditableTransaction | null;
};

export function RevenueClient({
  buildingId, month, year, rows, rooms, categories, paymentMethods, partyKindConfigs, canWrite,
  contractCodes, invoiceCodes,
}: {
  buildingId: string;
  month: number;
  year: number;
  rows: Row[];
  rooms: { id: string; number: string; primaryCustomerId: string | null }[];
  categories: { id: string; name: string; type: "INCOME" | "EXPENSE" }[];
  paymentMethods: { id: string; name: string; isCash: boolean }[];
  partyKindConfigs: PartyKindConfig[];
  canWrite: boolean;
  contractCodes: { id: string; code: string }[];
  invoiceCodes: { id: string; code: string }[];
}) {
  const router = useRouter();
  const [filterRoom, setFilterRoom] = useState<string>("ALL");
  const [filterParty, setFilterParty] = useState<string>("ALL");
  const [createOpen, setCreateOpen] = useState(false);
  const [editTx, setEditTx] = useState<EditableTransaction | null>(null);

  const contractMap = useMemo(() => new Map(contractCodes.map((c) => [c.code, c.id])), [contractCodes]);
  const invoiceMap = useMemo(() => new Map(invoiceCodes.map((i) => [i.code, i.id])), [invoiceCodes]);

  const filtered = useMemo(() => {
    return rows.filter((r) =>
      (filterRoom === "ALL" || r.roomId === filterRoom) &&
      (filterParty === "ALL" || r.partyKind === filterParty),
    );
  }, [rows, filterRoom, filterParty]);

  const totalOpen = filtered.reduce((s, r) => s + BigInt(r.opening), 0n);
  const totalDue = filtered.reduce((s, r) => s + BigInt(r.due), 0n);
  const totalPaid = filtered.reduce((s, r) => s + BigInt(r.paid), 0n);
  const totalClose = filtered.reduce((s, r) => s + BigInt(r.closing), 0n);

  async function deleteTx(id: string) {
    if (!confirm("Xoá phiếu thu này?")) return;
    const res = await fetch(`/api/transactions/${id}`, { method: "DELETE" });
    if (!res.ok) return toast.error("Có lỗi");
    toast.success("Đã xoá");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <MonthYearFilter buildingId={buildingId} month={month} year={year} tab="revenue" />
        <Select value={filterRoom} onValueChange={setFilterRoom}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Phòng" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Tất cả phòng</SelectItem>
            {rooms.map((r) => <SelectItem key={r.id} value={r.id}>Phòng {r.number}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterParty} onValueChange={setFilterParty}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Đối tượng" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Tất cả đối tượng</SelectItem>
            {partyKindConfigs.filter((p) => p.forRevenue).map((p) => <SelectItem key={p.code} value={p.code}>{p.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="ml-auto flex gap-2">
          <ExportExcelButton
            filename={`so-thu-${month}-${year}.xlsx`}
            sheets={() => [{
              name: `T${month}-${year}`,
              rows: filtered.map((r) => ({
                "Ngày tháng": formatDateVN(r.date),
                "Phòng": r.roomNumber ? formatRoomNumber(r.roomNumber) : "",
                "Loại thu": r.category,
                "Đối tượng": r.partyLabel,
                "Nội dung": r.content,
                "Tài khoản TT": r.paymentMethod,
                "Số dư đầu": Number(r.opening),
                "Phải thu": Number(r.due),
                "Đã thu": Number(r.paid),
                "Số dư cuối": Number(r.closing),
              })),
            }]}
          />
          {canWrite && (
            <Button onClick={() => setCreateOpen(true)} size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white">
              <ArrowDownCircle className="h-4 w-4" /> Phiếu thu
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MiniStat label="Số dư đầu" value={formatVND(totalOpen)} />
        <MiniStat label="Phải thu" value={formatVND(totalDue)} />
        <MiniStat label="Đã thu" value={formatVND(totalPaid)} positive />
        <MiniStat label="Số dư cuối" value={formatVND(totalClose)} bold />
      </div>

      {/* Mobile/PWA: card list */}
      <div className="space-y-2 lg:hidden">
        {filtered.length === 0 && (
          <Card><CardContent className="p-4 text-center text-sm text-slate-500">Chưa có dữ liệu</CardContent></Card>
        )}
        {filtered.map((r) => (
          <RevenueCard
            key={r.key}
            r={r}
            canWrite={canWrite}
            onEdit={() => r.tx && setEditTx(r.tx)}
            onDelete={() => r.tx && deleteTx(r.tx.id)}
            buildingId={buildingId}
            contractMap={contractMap}
            invoiceMap={invoiceMap}
          />
        ))}
      </div>

      {/* Desktop: table */}
      <Card className="hidden lg:block">
        <CardHeader><CardTitle>Sổ Thu T{month}/{year}</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                <th className="px-3 py-2 text-left whitespace-nowrap">Ngày tháng</th>
                <th className="px-3 py-2 text-left whitespace-nowrap">Phòng / Đối tượng</th>
                <th className="px-3 py-2 text-left whitespace-nowrap">Loại thu</th>
                <th className="px-3 py-2 text-left min-w-[210px]">Nội dung</th>
                <th className="px-3 py-2 text-left whitespace-nowrap">Tài khoản TT</th>
                <th className="px-3 py-2 text-right whitespace-nowrap">Số dư đầu</th>
                <th className="px-3 py-2 text-right whitespace-nowrap">Phải thu</th>
                <th className="px-3 py-2 text-right whitespace-nowrap">Đã thu</th>
                <th className="px-3 py-2 text-right whitespace-nowrap">Số dư cuối</th>
                {canWrite && <th className="px-3 py-2 w-16"></th>}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={canWrite ? 10 : 9} className="px-4 py-6 text-center text-slate-500">Chưa có dữ liệu</td></tr>
              )}
              {filtered.map((r) => {
                const closing = BigInt(r.closing);
                return (
                  <tr key={r.key} className="border-t hover:bg-slate-50">
                    <td className="px-3 py-2.5 whitespace-nowrap text-slate-600">{formatDateVN(r.date)}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <div className="font-medium">{r.roomNumber ? formatRoomNumber(r.roomNumber) : <span className="text-slate-400">—</span>}</div>
                      {r.partyLabel && <div className="text-xs text-slate-500">{r.partyLabel}</div>}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">{r.category || <span className="text-slate-400">—</span>}</td>
                    <td className="px-3 py-2.5 min-w-[210px] max-w-[260px]"><div className="line-clamp-2">{renderContentWithLinks({ content: r.content, buildingId, contractMap, invoiceMap })}</div></td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-slate-600">{r.paymentMethod || <span className="text-slate-400">—</span>}</td>
                    <td className="px-3 py-2.5 text-right whitespace-nowrap">{formatVND(BigInt(r.opening))}</td>
                    <td className="px-3 py-2.5 text-right whitespace-nowrap">{formatVND(BigInt(r.due))}</td>
                    <td className="px-3 py-2.5 text-right whitespace-nowrap text-emerald-700">{formatVND(BigInt(r.paid))}</td>
                    <td className={`px-3 py-2.5 text-right whitespace-nowrap font-semibold ${closing > 0n ? "text-rose-600" : ""}`}>
                      {formatVND(closing)}
                    </td>
                    {canWrite && (
                      <td className="px-3 py-2.5 text-right whitespace-nowrap">
                        {r.tx && (
                          <>
                            <button onClick={() => setEditTx(r.tx)} className="text-slate-400 hover:text-primary mr-2" aria-label="Sửa">
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button onClick={() => deleteTx(r.tx!.id)} className="text-slate-400 hover:text-rose-500" aria-label="Xoá">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <CreateTransactionDialog
        type={createOpen ? "INCOME" : null}
        buildingId={buildingId}
        month={month}
        year={year}
        categories={categories}
        paymentMethods={paymentMethods}
        partyKindConfigs={partyKindConfigs}
        rooms={rooms}
        onClose={() => setCreateOpen(false)}
      />
      <EditTransactionDialog
        tx={editTx}
        categories={categories}
        paymentMethods={paymentMethods}
        partyKindConfigs={partyKindConfigs}
        rooms={rooms}
        onClose={() => setEditTx(null)}
      />
    </div>
  );
}

function RevenueCard({ r, canWrite, onEdit, onDelete, buildingId, contractMap, invoiceMap }: {
  r: Row;
  canWrite: boolean;
  onEdit: () => void;
  onDelete: () => void;
  buildingId: string;
  contractMap: Map<string, string>;
  invoiceMap: Map<string, string>;
}) {
  const closing = BigInt(r.closing);
  return (
    <Card>
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap mb-1">
              {r.roomNumber && <Badge variant="outline" className="text-[10px]">{formatRoomNumber(r.roomNumber)}</Badge>}
              {r.category && <Badge variant="outline" className="text-[10px]">{r.category}</Badge>}
            </div>
            <div className="text-sm font-medium truncate">{renderContentWithLinks({ content: r.content, buildingId, contractMap, invoiceMap })}</div>
            <div className="text-xs text-slate-500 truncate mt-1.5">
              {formatDateVN(r.date)}
              {r.partyLabel && ` · ${r.partyLabel}`}
              {r.paymentMethod && ` · ${r.paymentMethod}`}
            </div>
          </div>
          {canWrite && r.tx && (
            <div className="flex gap-1 shrink-0">
              <button onClick={onEdit} className="text-slate-400 hover:text-primary p-1" aria-label="Sửa">
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button onClick={onDelete} className="text-slate-400 hover:text-rose-500 p-1" aria-label="Xoá">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
        <div className="grid grid-cols-4 gap-1.5 text-[11px]">
          <CardStat label="Số dư đầu" value={formatVND(BigInt(r.opening))} />
          <CardStat label="Phải thu" value={formatVND(BigInt(r.due))} />
          <CardStat label="Đã thu" value={formatVND(BigInt(r.paid))} positive />
          <CardStat label="Số dư cuối" value={formatVND(closing)} danger={closing > 0n} bold />
        </div>
      </CardContent>
    </Card>
  );
}

function CardStat({ label, value, positive, danger, bold }: { label: string; value: string; positive?: boolean; danger?: boolean; bold?: boolean }) {
  const color = danger ? "text-rose-600" : positive ? "text-emerald-600" : "";
  return (
    <div>
      <div className="text-[10px] text-slate-400 leading-tight">{label}</div>
      <div className={`${bold ? "font-semibold" : ""} ${color} text-[11px] truncate`}>{value}</div>
    </div>
  );
}

function MiniStat({ label, value, positive, bold }: { label: string; value: string; positive?: boolean; bold?: boolean }) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="text-[11px] text-slate-500">{label}</div>
        <div className={`${bold ? "text-lg" : "text-base"} font-bold mt-0.5 ${positive ? "text-emerald-600" : ""}`}>{value}</div>
      </CardContent>
    </Card>
  );
}
