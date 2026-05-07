"use client";
import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowUpCircle } from "lucide-react";
import { ExportExcelButton } from "@/components/ui/export-button";
import { formatVND, formatDateVN, formatRoomNumber } from "@/lib/utils";
import { MonthYearFilter } from "./month-year-filter";
import { CreateTransactionDialog } from "./create-transaction-dialog";

const PARTY_KINDS = [
  { value: "CUSTOMER", label: "Khách hàng" },
  { value: "THO_SUA_CHUA", label: "Thợ sửa chữa" },
  { value: "THO_XAY", label: "Thợ xây" },
  { value: "DON_VE_SINH", label: "Dọn vệ sinh" },
  { value: "BAO_VE", label: "Bảo vệ" },
  { value: "NHA_NUOC", label: "Nhà nước" },
  { value: "MOI_GIOI", label: "Môi giới" },
  { value: "TOA_NHA", label: "Toà nhà" },
  { value: "NCC_KHAC", label: "NCC khác" },
  { value: "OTHER", label: "Khác" },
];

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
  payable: string;
  paid: string;
  closing: string;
};

export function DebtClient({
  buildingId, month, year, rows, rooms, categories, paymentMethods, canWrite,
}: {
  buildingId: string;
  month: number;
  year: number;
  rows: Row[];
  rooms: { id: string; number: string; primaryCustomerId: string | null }[];
  categories: { id: string; name: string; type: "INCOME" | "EXPENSE" }[];
  paymentMethods: { id: string; name: string; isCash: boolean }[];
  canWrite: boolean;
}) {
  const [filterRoom, setFilterRoom] = useState<string>("ALL");
  const [filterParty, setFilterParty] = useState<string>("ALL");
  const [createOpen, setCreateOpen] = useState(false);

  const filtered = useMemo(() => {
    return rows.filter((r) =>
      (filterRoom === "ALL" || r.roomId === filterRoom) &&
      (filterParty === "ALL" || r.partyKind === filterParty),
    );
  }, [rows, filterRoom, filterParty]);

  const totalOpen = filtered.reduce((s, r) => s + BigInt(r.opening), 0n);
  const totalDue = filtered.reduce((s, r) => s + BigInt(r.payable), 0n);
  const totalPaid = filtered.reduce((s, r) => s + BigInt(r.paid), 0n);
  const totalClose = filtered.reduce((s, r) => s + BigInt(r.closing), 0n);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <MonthYearFilter buildingId={buildingId} month={month} year={year} tab="debt" />
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
            {PARTY_KINDS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="ml-auto flex gap-2">
          <ExportExcelButton
            filename={`so-chi-${month}-${year}.xlsx`}
            sheets={() => [{
              name: `T${month}-${year}`,
              rows: filtered.map((r) => ({
                "Ngày tháng": formatDateVN(r.date),
                "Phòng": r.roomNumber ? formatRoomNumber(r.roomNumber) : "",
                "Loại chi": r.category,
                "Đối tượng": r.partyLabel,
                "Nội dung": r.content,
                "Tài khoản TT": r.paymentMethod,
                "Số dư đầu": Number(r.opening),
                "Phải trả": Number(r.payable),
                "Đã trả": Number(r.paid),
                "Số dư cuối": Number(r.closing),
              })),
            }]}
          />
          {canWrite && (
            <Button onClick={() => setCreateOpen(true)} size="sm" className="bg-rose-600 hover:bg-rose-700 text-white">
              <ArrowUpCircle className="h-4 w-4" /> Phiếu chi
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MiniStat label="Số dư đầu" value={formatVND(totalOpen)} />
        <MiniStat label="Phải trả" value={formatVND(totalDue)} />
        <MiniStat label="Đã trả" value={formatVND(totalPaid)} />
        <MiniStat label="Số dư cuối" value={formatVND(totalClose)} bold />
      </div>

      <Card>
        <CardHeader><CardTitle>Sổ Chi T{month}/{year}</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                <th className="px-3 py-2 text-left whitespace-nowrap">Ngày tháng</th>
                <th className="px-3 py-2 text-left whitespace-nowrap">Phòng</th>
                <th className="px-3 py-2 text-left whitespace-nowrap">Loại chi</th>
                <th className="px-3 py-2 text-left whitespace-nowrap">Đối tượng</th>
                <th className="px-3 py-2 text-left">Nội dung</th>
                <th className="px-3 py-2 text-left whitespace-nowrap">Tài khoản TT</th>
                <th className="px-3 py-2 text-right whitespace-nowrap">Số dư đầu</th>
                <th className="px-3 py-2 text-right whitespace-nowrap">Phải trả</th>
                <th className="px-3 py-2 text-right whitespace-nowrap">Đã trả</th>
                <th className="px-3 py-2 text-right whitespace-nowrap">Số dư cuối</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={10} className="px-4 py-6 text-center text-slate-500">Chưa có dữ liệu</td></tr>
              )}
              {filtered.map((r) => {
                const closing = BigInt(r.closing);
                return (
                  <tr key={r.key} className="border-t hover:bg-slate-50">
                    <td className="px-3 py-2.5 whitespace-nowrap text-slate-600">{formatDateVN(r.date)}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">{r.roomNumber ? formatRoomNumber(r.roomNumber) : <span className="text-slate-400">—</span>}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">{r.category || <span className="text-slate-400">—</span>}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">{r.partyLabel || <span className="text-slate-400">—</span>}</td>
                    <td className="px-3 py-2.5">{r.content}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-slate-600">{r.paymentMethod || <span className="text-slate-400">—</span>}</td>
                    <td className="px-3 py-2.5 text-right whitespace-nowrap">{formatVND(BigInt(r.opening))}</td>
                    <td className="px-3 py-2.5 text-right whitespace-nowrap">{formatVND(BigInt(r.payable))}</td>
                    <td className="px-3 py-2.5 text-right whitespace-nowrap">{formatVND(BigInt(r.paid))}</td>
                    <td className={`px-3 py-2.5 text-right whitespace-nowrap font-semibold ${closing > 0n ? "text-rose-600" : ""}`}>
                      {formatVND(closing)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <CreateTransactionDialog
        type={createOpen ? "EXPENSE" : null}
        buildingId={buildingId}
        month={month}
        year={year}
        categories={categories}
        paymentMethods={paymentMethods}
        rooms={rooms}
        onClose={() => setCreateOpen(false)}
      />
    </div>
  );
}

function MiniStat({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="text-[11px] text-slate-500">{label}</div>
        <div className={`${bold ? "text-lg" : "text-base"} font-bold mt-0.5`}>{value}</div>
      </CardContent>
    </Card>
  );
}
