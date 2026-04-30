"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Trash2, Loader2, Edit, Shield, Users as UsersIcon } from "lucide-react";
import { toast } from "sonner";

type User = {
  id: string;
  email: string;
  name: string;
  role: "ADMIN" | "STAFF";
  active: boolean;
  permissions: { buildingId: string; permission: string; building: { name: string; type: string } }[];
};

type Building = { id: string; name: string; type: string };

const PERMS = ["OWNER", "MANAGER", "ACCOUNTANT", "VIEWER"] as const;
const PERM_LABEL: Record<string, string> = {
  OWNER: "Chủ", MANAGER: "Quản lý", ACCOUNTANT: "Kế toán", VIEWER: "Xem",
};

export function UsersTab({ users, buildings, currentUserId }: { users: User[]; buildings: Building[]; currentUserId: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState<User | null>(null);
  const [creating, setCreating] = useState(false);

  async function toggleActive(u: User) {
    const res = await fetch(`/api/users/${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !u.active }),
    });
    if (!res.ok) return toast.error("Có lỗi");
    toast.success(u.active ? "Đã vô hiệu hoá" : "Đã kích hoạt");
    router.refresh();
  }

  async function deleteUser(id: string) {
    if (!confirm("Xoá user này?")) return;
    const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return toast.error(err.error || "Có lỗi");
    }
    toast.success("Đã xoá");
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold flex items-center gap-2">
          <UsersIcon className="h-4 w-4" /> {users.length} người dùng
        </h2>
        <Button onClick={() => setCreating(true)} variant="gradient">
          <Plus className="h-4 w-4" /> Thêm user
        </Button>
      </div>

      <div className="space-y-2">
        {users.map((u) => (
          <Card key={u.id}>
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className={`h-10 w-10 rounded-full flex items-center justify-center text-white font-semibold shrink-0 ${
                  u.role === "ADMIN" ? "bg-gradient-brand" : "bg-slate-400"
                }`}>
                  {u.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{u.name}</span>
                    {u.role === "ADMIN" && <Badge variant="default" className="text-[10px]"><Shield className="h-3 w-3 mr-0.5" /> Admin</Badge>}
                    {!u.active && <Badge variant="secondary" className="text-[10px]">Vô hiệu</Badge>}
                  </div>
                  <div className="text-xs text-slate-500">{u.email}</div>
                  {u.role === "STAFF" && u.permissions.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {u.permissions.map((p) => (
                        <Badge key={p.buildingId} variant={p.building.type === "CHDV" ? "chdv" : "vp"} className="text-[10px]">
                          {p.building.name} · {PERM_LABEL[p.permission]}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <Button size="sm" variant="outline" onClick={() => setEditing(u)}>
                    <Edit className="h-3 w-3" />
                  </Button>
                  {u.id !== currentUserId && (
                    <>
                      <Button size="sm" variant="ghost" onClick={() => toggleActive(u)}>
                        {u.active ? "Tắt" : "Bật"}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => deleteUser(u.id)}>
                        <Trash2 className="h-3 w-3 text-rose-500" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <UserDialog
        open={creating}
        onClose={() => setCreating(false)}
        buildings={buildings}
        mode="create"
      />
      <UserDialog
        open={!!editing}
        user={editing}
        onClose={() => setEditing(null)}
        buildings={buildings}
        mode="edit"
      />
    </div>
  );
}

function UserDialog({ open, onClose, buildings, mode, user }: {
  open: boolean;
  onClose: () => void;
  buildings: Building[];
  mode: "create" | "edit";
  user?: User | null;
}) {
  const router = useRouter();
  const [email, setEmail] = useState(user?.email ?? "");
  const [name, setName] = useState(user?.name ?? "");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"ADMIN" | "STAFF">(user?.role ?? "STAFF");
  const [perms, setPerms] = useState<Record<string, string>>(() => {
    if (!user) return {};
    return Object.fromEntries(user.permissions.map((p) => [p.buildingId, p.permission]));
  });
  const [loading, setLoading] = useState(false);

  function togglePerm(bId: string, value: string) {
    setPerms((p) => {
      if (value === "NONE") {
        const { [bId]: _, ...rest } = p;
        return rest;
      }
      return { ...p, [bId]: value };
    });
  }

  async function submit() {
    if (mode === "create" && (!email || !name || !password)) return toast.error("Nhập đủ email, tên, mật khẩu");
    if (password && password.length < 8) return toast.error("Mật khẩu tối thiểu 8 ký tự");

    setLoading(true);
    const permissions = role === "STAFF"
      ? Object.entries(perms).map(([buildingId, permission]) => ({ buildingId, permission }))
      : [];
    const body = mode === "create"
      ? { email, name, password, role, permissions }
      : { name, role, permissions, ...(password ? { password } : {}) };
    const url = mode === "create" ? "/api/users" : `/api/users/${user!.id}`;
    const method = mode === "create" ? "POST" : "PATCH";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setLoading(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return toast.error(err.error || "Có lỗi");
    }
    toast.success(mode === "create" ? "Đã tạo user" : "Đã cập nhật");
    onClose();
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{mode === "create" ? "Thêm người dùng" : "Sửa người dùng"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Email</Label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} disabled={mode === "edit"} type="email" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Tên</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Quyền hệ thống</Label>
              <Select value={role} onValueChange={(v) => setRole(v as never)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADMIN">Admin (full)</SelectItem>
                  <SelectItem value="STAFF">Staff (theo toà)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Mật khẩu {mode === "edit" && "(để trống để giữ nguyên)"}</Label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={mode === "edit" ? "•••••" : ""} />
            </div>
          </div>

          {role === "STAFF" && (
            <div className="space-y-2">
              <Label className="text-xs">Phân quyền theo toà</Label>
              <div className="space-y-2">
                {buildings.map((b) => (
                  <div key={b.id} className="flex items-center justify-between gap-3 p-2 rounded-lg border">
                    <span className="text-sm flex items-center gap-2">
                      <Badge variant={b.type === "CHDV" ? "chdv" : "vp"} className="text-[10px]">{b.type}</Badge>
                      {b.name}
                    </span>
                    <Select value={perms[b.id] ?? "NONE"} onValueChange={(v) => togglePerm(b.id, v)}>
                      <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="NONE">Không có quyền</SelectItem>
                        {PERMS.map((p) => <SelectItem key={p} value={p}>{PERM_LABEL[p]}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Huỷ</Button>
          <Button variant="gradient" onClick={submit} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === "create" ? "Tạo" : "Lưu"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
