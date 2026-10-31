import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { vietQrUrl } from "@/lib/vn-banks";

// Same-origin proxy for img.vietqr.io so the browser never needs a
// cross-origin image fetch. See vietQrProxyUrl() in @/lib/vn-banks for why:
// html2canvas capturing the invoice receipt (copy/share image, share PDF)
// needs pixels it can always read, which a direct third-party image request
// can't guarantee regardless of useCORS.
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });

  const sp = req.nextUrl.searchParams;
  const template = sp.get("template");
  const url = vietQrUrl({
    bankBin: sp.get("bin"),
    accountNumber: sp.get("acc"),
    accountHolder: sp.get("accountName"),
    amount: sp.get("amount"),
    memo: sp.get("addInfo"),
    template: template === "compact" || template === "compact2" || template === "qr_only" || template === "print"
      ? template
      : undefined,
  });
  if (!url) return new NextResponse("Bad request", { status: 400 });

  const upstream = await fetch(url, { cache: "no-store" });
  if (!upstream.ok || !upstream.body) {
    return new NextResponse("Upstream error", { status: 502 });
  }
  return new NextResponse(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "image/png",
      "Cache-Control": "private, max-age=300",
    },
  });
}
