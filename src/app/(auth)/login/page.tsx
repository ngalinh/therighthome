"use client";
import { signIn } from "next-auth/react";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl") || "/";
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const res = await signIn("credentials", {
      email: fd.get("email"),
      password: fd.get("password"),
      redirect: false,
    });
    setLoading(false);
    if (res?.error) {
      toast.error("Email hoặc mật khẩu không đúng");
      return;
    }
    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <div className="min-h-dvh grid lg:grid-cols-2">
      <div className="hidden lg:flex relative bg-gradient-brand items-center justify-center p-12 overflow-hidden">
        <div className="absolute inset-0 opacity-20" style={{ background: "radial-gradient(circle at 30% 20%, rgba(255,255,255,0.4) 0%, transparent 50%), radial-gradient(circle at 70% 80%, rgba(255,255,255,0.3) 0%, transparent 50%)" }} />
        <div className="relative text-white max-w-md">
          <div className="h-14 w-14 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center mb-6">
            <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round">
              <path d="M5 11 L12 6 L19 11 L19 19 L14 19 L14 14 L10 14 L10 19 L5 19 Z" />
            </svg>
          </div>
          <h1 className="text-4xl font-bold leading-tight mb-3">The Right Home</h1>
          <p className="text-lg text-white/90 leading-relaxed">
            Quản lý căn hộ dịch vụ & văn phòng cho thuê hiện đại, đơn giản, tự động hoá.
          </p>
          <ul className="mt-8 space-y-2 text-white/85 text-sm">
            <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-white" />Hợp đồng, hoá đơn tự động</li>
            <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-white" />OCR CCCD bằng AI</li>
            <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-white" />Báo cáo tài chính realtime</li>
          </ul>
        </div>
      </div>

      <div className="flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-sm">
          <div className="lg:hidden mb-8 text-center">
            <h1 className="text-2xl font-bold gradient-text">The Right Home</h1>
            <p className="text-sm text-slate-500 mt-1">Đăng nhập để tiếp tục</p>
          </div>
          <h2 className="hidden lg:block text-2xl font-bold mb-1">Đăng nhập</h2>
          <p className="hidden lg:block text-sm text-slate-500 mb-8">Vui lòng nhập email và mật khẩu</p>

          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" autoComplete="email" required placeholder="ban@therighthome.vn" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Mật khẩu</Label>
              <Input id="password" name="password" type="password" autoComplete="current-password" required />
            </div>
            <Button type="submit" variant="gradient" size="lg" className="w-full" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Đăng nhập
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
