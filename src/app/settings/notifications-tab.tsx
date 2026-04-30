"use client";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bell, BellOff, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) out[i] = raw.charCodeAt(i);
  return out;
}

export function NotificationsTab() {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [vapidKey, setVapidKey] = useState<string | null>(null);

  useEffect(() => {
    setSupported("serviceWorker" in navigator && "PushManager" in window);
    if (typeof Notification !== "undefined") setPermission(Notification.permission);
    fetch("/api/push/vapid-key").then((r) => r.json()).then((d) => setVapidKey(d.publicKey));
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.ready.then((reg) => reg.pushManager.getSubscription())
        .then((sub) => setSubscribed(!!sub))
        .catch(() => {});
    }
  }, []);

  async function subscribe() {
    if (!vapidKey) return toast.error("VAPID chưa được cấu hình trên server");
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey).buffer as ArrayBuffer,
      });
      const json = sub.toJSON();
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
      });
      if (!res.ok) throw new Error();
      setSubscribed(true);
      toast.success("Đã bật thông báo");
    } catch (e) {
      toast.error("Không bật được thông báo");
    } finally {
      setLoading(false);
    }
  }

  async function unsubscribe() {
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setSubscribed(false);
      toast.success("Đã tắt thông báo");
    } finally {
      setLoading(false);
    }
  }

  async function test() {
    setLoading(true);
    const res = await fetch("/api/push/test", { method: "POST" });
    setLoading(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return toast.error(err.error || "Gửi thử thất bại");
    }
    toast.success("Đã gửi push thử — kiểm tra notification");
  }

  if (supported === false) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <AlertCircle className="h-8 w-8 text-amber-500 mx-auto mb-3" />
          <p className="text-sm">Trình duyệt không hỗ trợ Push Notification</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" /> Thông báo (PWA)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-slate-600">
          Bật thông báo để nhận cảnh báo: hoá đơn quá hạn, hợp đồng sắp hết hạn, có người gửi tiền.
        </p>

        <div className="flex items-center gap-3 text-sm">
          <span className="text-slate-500">Trạng thái:</span>
          {subscribed ? (
            <span className="flex items-center gap-1 text-emerald-600 font-medium">
              <CheckCircle className="h-4 w-4" /> Đã bật
            </span>
          ) : (
            <span className="flex items-center gap-1 text-slate-500">
              <BellOff className="h-4 w-4" /> Chưa bật
            </span>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {!subscribed ? (
            <Button onClick={subscribe} disabled={loading || !vapidKey} variant="gradient">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}
              Bật thông báo
            </Button>
          ) : (
            <>
              <Button onClick={test} disabled={loading} variant="outline">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}
                Gửi thử
              </Button>
              <Button onClick={unsubscribe} disabled={loading} variant="ghost">
                <BellOff className="h-4 w-4" /> Tắt
              </Button>
            </>
          )}
        </div>

        {!vapidKey && (
          <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
            VAPID chưa được cấu hình trên server. Admin chạy <code className="font-mono">npx web-push generate-vapid-keys</code> rồi điền vào .env và restart app.
          </div>
        )}

        <details className="text-xs text-slate-500">
          <summary className="cursor-pointer">Cài app lên điện thoại (PWA)</summary>
          <div className="mt-2 space-y-1">
            <p><strong>iOS Safari</strong>: Bấm nút Chia sẻ → "Thêm vào Màn hình chính"</p>
            <p><strong>Android Chrome</strong>: Menu (3 chấm) → "Cài đặt ứng dụng" / "Add to Home screen"</p>
            <p>Sau khi cài, app sẽ chạy giống native, có icon riêng.</p>
          </div>
        </details>
      </CardContent>
    </Card>
  );
}
