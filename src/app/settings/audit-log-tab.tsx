import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDateVN } from "@/lib/utils";

type Log = {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  buildingId: string | null;
  before: unknown;
  after: unknown;
  createdAt: Date;
  user: { email: string; name: string } | null;
};

const ACTION_VARIANT: Record<string, "default" | "success" | "warning" | "destructive" | "secondary"> = {
  CREATE: "success",
  UPDATE: "default",
  DELETE: "destructive",
  SEND: "default",
  IMPORT: "warning",
  LOGIN: "secondary",
};

export function AuditLogTab({ logs }: { logs: Log[] }) {
  if (logs.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-slate-500">
          Chưa có log nào
        </CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardContent className="p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
              <th className="px-4 py-2 text-left">Thời gian</th>
              <th className="px-4 py-2 text-left">User</th>
              <th className="px-4 py-2 text-left">Hành động</th>
              <th className="px-4 py-2 text-left">Đối tượng</th>
              <th className="px-4 py-2 text-left">Chi tiết</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id} className="border-t hover:bg-slate-50">
                <td className="px-4 py-2 whitespace-nowrap text-xs text-slate-500">
                  {formatDateVN(log.createdAt)} {new Date(log.createdAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
                </td>
                <td className="px-4 py-2 text-xs">{log.user?.name ?? "—"}</td>
                <td className="px-4 py-2"><Badge variant={ACTION_VARIANT[log.action] ?? "secondary"} className="text-[10px]">{log.action}</Badge></td>
                <td className="px-4 py-2 text-xs">{log.entityType}</td>
                <td className="px-4 py-2 text-xs text-slate-500 max-w-md truncate">
                  {log.after ? JSON.stringify(log.after).slice(0, 80) : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-xs text-slate-400 text-center py-2">Hiển thị 100 mục gần nhất</p>
      </CardContent>
    </Card>
  );
}
