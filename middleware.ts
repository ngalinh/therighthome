import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";
import { NextResponse } from "next/server";

const PUBLIC_PATHS = ["/login", "/api/auth", "/manifest.webmanifest", "/sw.js", "/icons", "/_next"];

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { pathname } = req.nextUrl;
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) return NextResponse.next();
  if (!req.auth) {
    const url = new URL("/login", req.url);
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
