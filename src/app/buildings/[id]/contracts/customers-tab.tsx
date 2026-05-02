"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Users, Trash2, Loader2, Edit } from "lucide-react";
import { toast } from "sonner";

type Customer = {
  id: string;
  type: string;
  fullName: string | null;
  companyName: string | null;
  idNumber: string | null;
  taxNumber: string | null;
  phone: string | null;
  email: string | null;
  licensePlate: string | null;
  notes: string | null;
  contractCustomers: {
    contract: {
      id: string;
      code: string;
      status: string;
      contractFileUrl: string | null;
      room: { number: string };
    };
  }[];
};

const STATUS_LABEL: Record<string, { label: string; variant: "success" | "secondary" | "destructive" }> = {
  ACTIVE: { label: "Đang thuê", variant: "success" },
  EXPIRED: { label: "Hết hạn", variant: "secondary" },
  TERMINATED: { label: "Dừng thuê", variant: "secondary" },
  TERMINATED_LOST_DEPOSIT: { label: "Mất cọc", variant: "destructive" },
};

export function CustomersTab({
  customers,
  canWrite,
}: {
  customers: Customer[];
  buildingId: string;
  canWrite: boolean;
}) {
  if (customers.length === 0) {
    return <EmptyState icon={Users} title="Chưa có khách hàng" description="Khách hàng sẽ tự động được thêm khi tạo hợp đồng." />;
  }

  const sorted = [...customers].sort((a, b) => {
    const aActive = a.contractCustomers.some((cc) => cc.contract.status === "ACTIVE") ? 0 : 1;
    const bActive = b.contractCustomers.some((cc) => cc.contract.status === "ACTIVE") ? 0 : 1;
    return aActive - bActive;
  });

  return (
    <>
      {/* Mobile: card list */}
      <div className="space-y-2 lg:hidden">
        {sorted.map((c) => (
          <CustomerCardMobile key={c.id} customer={c} canWrite={canWrite} />
        ))}
      </div>

      {/* Desktop: table */}
      <Card className="hidden lg:block">
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                <th className="px-3 py-2.5 text-left">Tên</th>
                <th className="px-3 py-2.5 text-left">Loại</th>
                <th className="px-3 py-2.5 text-left">CCCD/MST</th>
                <th className="px-3 py-2.5 text-left">SĐT</th>
                <th className="px-3 py-2.5 text-left">Email</th>
                <th className="px-3 py-2.5 text-left">Phòng</th>
                <th className="px-3 py-2.5 text-left">Trạng thái</th>
                <th className="px-3 py-2.5 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((c) => (
                <CustomerRow key={c.id} customer={c} canWrite={canWrite} />
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </>
  );
}

function CustomerCardMobile({ customer, canWrite }: { customer: Customer; canWrite: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const name = customer.fullName || customer.companyName || "—";
  const latest =
    customer.contractCustomers.find((cc) => cc.contract.status === "ACTIVE")?.contract ??
    customer.contractCustomers[0]?.contract;
  const status = latest ? STATUS_LABEL[latest.status] : null;

  async function deleteCustomer() {
    if (!confirm(`Xoá khách "${name}"?`)) return;
    const res = await fetch(`/api/customers/${customer.id}`, { method: "DELETE" });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toast.error(err.error || "Có lỗi");
      return;
    }
    toast.success("Đã xoá khách");
    router.refresh();
  }

  return (
    <>
      <Card>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-full bg-gradient-brand text-white flex items-center justify-center font-semibold shrink-0">
              {name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-0.5">
                <span className="font-medium">{name}</span>
                <Badge variant="outline" className="text-[10px]">
                  {customer.type === "COMPANY" ? "Công ty" : "Cá nhân"}
                </Badge>
                {status && <Badge variant={status.variant} className="text-[10px]">{status.label}</Badge>}
              </div>
              <div className="text-xs text-slate-500 flex flex-wrap gap-x-3 gap-y-0.5">
                {customer.type === "COMPANY"
                  ? customer.taxNumber && <span>MST: {customer.taxNumber}</span>
                  : customer.idNumber && <span>CCCD: {customer.idNumber}</span>}
                {customer.phone && <span>{customer.phone}</span>}
                {customer.email && <span className="truncate max-w-[160px]">{customer.email}</span>}
                {latest && <span>Phòng {latest.room.number}</span>}
              </div>
            </div>
            {canWrite && (
              <div className="flex gap-1 shrink-0">
                <Button variant="outline" size="sm" className="h-8 px-2" onClick={() => setEditing(true)}>
                  <Edit className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="sm" className="h-8 px-2 text-rose-600" onClick={deleteCustomer}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      {editing && <EditCustomerDialog customer={customer} onClose={() => setEditing(false)} />}
    </>
  );
}

function CustomerRow({ customer, canWrite }: { customer: Customer; canWrite: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const name = customer.fullName || customer.companyName || "—";
  const latest =
    customer.contractCustomers.find((cc) => cc.contract.status === "ACTIVE")?.contract ??
    customer.contractCustomers[0]?.contract;
  const status = latest ? STATUS_LABEL[latest.status] : null;

  async function deleteCustomer() {
    if (!confirm(`Xoá khách "${name}"?`)) return;
    const res = await fetch(`/api/customers/${customer.id}`, { method: "DELETE" });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toast.error(err.error || "Có lỗi");
      return;
    }
    toast.success("Đã xoá khách");
    router.refresh();
  }

  return (
    <>
      <tr className="border-t hover:bg-slate-50/60">
        <td className="px-3 py-2.5 font-medium max-w-[200px] truncate" title={name}>{name}</td>
        <td className="px-3 py-2.5">
          <Badge variant="outline" className="text-[10px]">
            {customer.type === "COMPANY" ? "Công ty" : "Cá nhân"}
          </Badge>
        </td>
        <td className="px-3 py-2.5 text-xs whitespace-nowrap">
          {customer.type === "COMPANY" ? customer.taxNumber || "—" : customer.idNumber || "—"}
        </td>
        <td className="px-3 py-2.5 text-xs whitespace-nowrap">{customer.phone || "—"}</td>
        <td className="px-3 py-2.5 text-xs max-w-[180px] truncate" title={customer.email ?? ""}>{customer.email || "—"}</td>
        <td className="px-3 py-2.5 text-xs whitespace-nowrap">{latest?.room.number ?? "—"}</td>
        <td className="px-3 py-2.5">
          {status ? <Badge variant={status.variant} className="text-[10px] whitespace-nowrap">{status.label}</Badge> : "—"}
        </td>
        <td className="px-3 py-2.5 text-right">
          <div className="flex gap-1 justify-end">
            {canWrite && (
              <>
                <Button variant="outline" size="sm" className="h-7 px-2" onClick={() => setEditing(true)} title="Sửa">
                  <Edit className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="sm" className="h-7 px-2 text-rose-600 hover:bg-rose-50" onClick={deleteCustomer} title="Xoá">
                  <Trash2 className="h-3 w-3" />
                </Button>
              </>
            )}
          </div>
        </td>
      </tr>
      {editing && <EditCustomerDialog customer={customer} onClose={() => setEditing(false)} />}
    </>
  );
}

function EditCustomerDialog({ customer, onClose }: { customer: Customer; onClose: () => void }) {
  const router = useRouter();
  const [type, setType] = useState<"INDIVIDUAL" | "COMPANY">(customer.type as "INDIVIDUAL" | "COMPANY");
  const [fullName, setFullName] = useState(customer.fullName ?? "");
  const [idNumber, setIdNumber] = useState(customer.idNumber ?? "");
  const [companyName, setCompanyName] = useState(customer.companyName ?? "");
  const [taxNumber, setTaxNumber] = useState(customer.taxNumber ?? "");
  const [phone, setPhone] = useState(customer.phone ?? "");
  const [email, setEmail] = useState(customer.email ?? "");
  const [licensePlate, setLicensePlate] = useState(customer.licensePlate ?? "");
  const [notes, setNotes] = useState(customer.notes ?? "");
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    const res = await fetch(`/api/customers/${customer.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type,
        fullName: fullName || null,
        idNumber: idNumber || null,
        companyName: companyName || null,
        taxNumber: taxNumber || null,
        phone: phone || null,
        email: email || null,
        licensePlate: licensePlate || null,
        notes: notes || null,
      }),
    });
    setLoading(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return toast.error(err.error || "Có lỗi");
    }
    toast.success("Đã lưu");
    onClose();
    router.refresh();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sửa khách hàng</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Loại</Label>
            <Select value={type} onValueChange={(v) => setType(v as "INDIVIDUAL" | "COMPANY")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="INDIVIDUAL">Cá nhân</SelectItem>
                <SelectItem value="COMPANY">Công ty</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {type === "INDIVIDUAL" ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Họ tên</Label>
                <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">CCCD</Label>
                <Input value={idNumber} onChange={(e) => setIdNumber(e.target.value)} />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Tên công ty</Label>
                <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">MST</Label>
                <Input value={taxNumber} onChange={(e) => setTaxNumber(e.target.value)} />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label className="text-xs">Người liên hệ</Label>
                <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Tên người đại diện / liên hệ" />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">SĐT</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            {type === "INDIVIDUAL" && (
              <div className="space-y-1.5 col-span-2">
                <Label className="text-xs">Biển số xe</Label>
                <Input value={licensePlate} onChange={(e) => setLicensePlate(e.target.value)} />
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Ghi chú</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Huỷ</Button>
          <Button variant="gradient" onClick={submit} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Lưu
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
