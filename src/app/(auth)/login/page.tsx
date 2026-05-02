"use client";
import { signIn } from "next-auth/react";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, ArrowRight, Mail, Lock, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  const [showPass, setShowPass] = useState(false);

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
    <div className="min-h-dvh">
      {/* Mobile: full-screen gradient background */}
      <div className="lg:hidden relative min-h-dvh bg-gradient-brand overflow-hidden flex flex-col">
        {/* Decorative blurs */}
        <div
          className="absolute pointer-events-none"
          style={{ top: -80, right: -60, width: 280, height: 280, borderRadius: "50%", background: "rgba(255,255,255,0.15)", filter: "blur(40px)" }}
        />
        <div
          className="absolute pointer-events-none"
          style={{ bottom: 180, left: -100, width: 320, height: 320, borderRadius: "50%", background: "rgba(255,255,255,0.12)", filter: "blur(50px)" }}
        />

        {/* Hero text */}
        <div className="relative px-7 pt-16 pb-8 text-white">
          <div
            className="flex items-center justify-center mb-5"
            style={{ width: 56, height: 56, borderRadius: 18, background: "rgba(255,255,255,0.18)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.3)" }}
          >
            <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round">
              <path d="M5 11 L12 6 L19 11 L19 19 L14 19 L14 14 L10 14 L10 19 L5 19 Z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold leading-tight tracking-tight mb-2">The Right Home</h1>
          <p className="text-base text-white/85">Quản lý CHDV và văn phòng cho thuê</p>
        </div>

        {/* Glass card at bottom */}
        <div className="relative flex-1 flex items-end px-4 pb-8">
          <div
            className="glass-strong w-full rounded-[28px] p-6"
          >
            <h2 className="text-xl font-bold text-slate-900 mb-1">Đăng nhập</h2>
            <p className="text-sm text-slate-500 mb-5">Chào mừng bạn quay lại 👋</p>

            <LoginForm loading={loading} showPass={showPass} setShowPass={setShowPass} onSubmit={onSubmit} />
          </div>
        </div>
      </div>

      {/* Desktop: two-column layout */}
      <div className="hidden lg:grid lg:grid-cols-2 min-h-dvh">
        <div className="relative bg-gradient-brand flex items-center justify-center p-12 overflow-hidden">
          <div
            className="absolute inset-0 opacity-20 pointer-events-none"
            style={{ background: "radial-gradient(circle at 30% 20%, rgba(255,255,255,0.4) 0%, transparent 50%), radial-gradient(circle at 70% 80%, rgba(255,255,255,0.3) 0%, transparent 50%)" }}
          />
          <div className="relative text-white max-w-md">
            <div className="h-14 w-14 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center mb-6 border border-white/25">
              <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round">
                <path d="M5 11 L12 6 L19 11 L19 19 L14 19 L14 14 L10 14 L10 19 L5 19 Z" />
              </svg>
            </div>
            <h1 className="text-4xl font-bold leading-tight mb-3 tracking-tight">The Right Home</h1>
            <p className="text-lg text-white/90 leading-relaxed">
              Quản lý căn hộ dịch vụ & văn phòng cho thuê hiện đại, đơn giản, tự động hoá.
            </p>
            <ul className="mt-8 space-y-2.5 text-white/85 text-sm">
              {["Hợp đồng, hoá đơn tự động", "OCR CCCD bằng AI", "Báo cáo tài chính realtime"].map((f) => (
                <li key={f} className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-white/90 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="flex items-center justify-center p-12 bg-slate-50">
          <div className="w-full max-w-sm">
            <h2 className="text-2xl font-bold mb-1 tracking-tight">Đăng nhập</h2>
            <p className="text-sm text-slate-500 mb-8">Vui lòng nhập email và mật khẩu</p>
            <LoginForm loading={loading} showPass={showPass} setShowPass={setShowPass} onSubmit={onSubmit} />
          </div>
        </div>
      </div>
    </div>
  );
}

function LoginForm({
  loading, showPass, setShowPass, onSubmit,
}: {
  loading: boolean;
  showPass: boolean;
  setShowPass: (v: boolean) => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-slate-700 block">Email</label>
        <div className="flex items-center gap-2.5 px-3.5 py-3 bg-white border-[1.5px] border-slate-200 rounded-[14px] focus-within:border-indigo-500 focus-within:shadow-[0_0_0_4px_rgba(99,102,241,0.12)] transition-all">
          <Mail className="h-4 w-4 text-slate-400 shrink-0" />
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="ban@therighthome.vn"
            className="flex-1 text-sm outline-none bg-transparent text-slate-900 placeholder:text-slate-400"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-slate-700 block">Mật khẩu</label>
        <div className="flex items-center gap-2.5 px-3.5 py-3 bg-white border-[1.5px] border-slate-200 rounded-[14px] focus-within:border-indigo-500 focus-within:shadow-[0_0_0_4px_rgba(99,102,241,0.12)] transition-all">
          <Lock className="h-4 w-4 text-slate-400 shrink-0" />
          <input
            name="password"
            type={showPass ? "text" : "password"}
            autoComplete="current-password"
            required
            className="flex-1 text-sm outline-none bg-transparent text-slate-900"
          />
          <button type="button" onClick={() => setShowPass(!showPass)} className="text-slate-400">
            {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <Button
        type="submit"
        disabled={loading}
        className="w-full h-12 bg-gradient-brand border-0 text-white font-semibold text-[15px] rounded-[14px] shadow-[0_10px_24px_-8px_rgba(139,92,246,0.55)] hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Đăng nhập <ArrowRight className="h-4 w-4" /></>}
      </Button>

      <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input type="checkbox" defaultChecked className="rounded" />
          <span>Ghi nhớ đăng nhập</span>
        </label>
        <button type="button" className="text-indigo-600 font-semibold hover:underline">Quên mật khẩu?</button>
      </div>
    </form>
  );
}
