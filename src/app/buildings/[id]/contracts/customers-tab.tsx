"use client";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty";
import { Button } from "@/components/ui/button";
import { Users, Phone, Mail, Upload, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

type Customer = {
  id: string;
  type: string;
  fullName: string | null;
  companyName: string | null;
  idNumber: string | null;
  phone: string | null;
  email: string | null;
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
  EXPIRED: { label: "Dừng thuê - hết hạn", variant: "secondary" },
  TERMINATED: { label: "Dừng thuê", variant: "secondary" },
  TERMINATED_LOST_DEPOSIT: { label: "Dừng thuê - mất cọc", variant: "destructive" },
};

export function CustomersTab({
  customers, canWrite,
}: {
  customers: Customer[];
  buildingId: string;
  canWrite: boolean;
}) {
  if (customers.length === 0) {
    return <EmptyState icon={Users} title="Chưa có khách hàng" description="Khách hàng sẽ tự động được thêm khi tạo hợp đồng." />;
  }
  return (
    <div className="space-y-3">
      {customers.map((c) => (
        <CustomerCard key={c.id} customer={c} canWrite={canWrite} />
      ))}
    </div>
  );
}

function CustomerCard({ customer, canWrite }: { customer: Customer; canWrite: boolean }) {
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const name = customer.fullName || customer.companyName || "—";
  const latest = customer.contractCustomers[0]?.contract;
  const status = latest ? STATUS_LABEL[latest.status] : null;

  async function uploadContract(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!latest) {
      toast.error("Khách chưa có hợp đồng");
      return;
    }
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`/api/contracts/${latest.id}/upload`, { method: "POST", body: fd });
    setUploading(false);
    if (!res.ok) {
      toast.error("Tải lên thất bại");
      return;
    }
    toast.success("Đã upload hợp đồng");
    router.refresh();
  }

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
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-full bg-gradient-brand flex items-center justify-center text-white font-semibold shrink-0">
            {name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="font-medium">{name}</span>
              <Badge variant="outline" className="text-[10px]">{customer.type === "COMPANY" ? "Công ty" : "Cá nhân"}</Badge>
              {status && <Badge variant={status.variant}>{status.label}</Badge>}
            </div>
            <div className="text-xs text-slate-500 flex flex-wrap gap-x-4 gap-y-0.5">
              {customer.idNumber && <span>CCCD: {customer.idNumber}</span>}
              {customer.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{customer.phone}</span>}
              {customer.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{customer.email}</span>}
              {latest && <span>Phòng {latest.room.number} · {latest.code}</span>}
            </div>
          </div>
          {canWrite && (
            <div className="flex gap-1">
              <input ref={inputRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={uploadContract} />
              <Button size="sm" variant="outline" onClick={() => inputRef.current?.click()} disabled={uploading || !latest}>
                {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                <span className="hidden sm:inline">HĐ</span>
              </Button>
              <Button size="sm" variant="ghost" onClick={deleteCustomer}>
                <Trash2 className="h-3 w-3 text-rose-500" />
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
