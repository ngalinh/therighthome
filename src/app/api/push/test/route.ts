import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isPushConfigured, pushToUser } from "@/lib/push";

export const runtime = "nodejs";

export async function POST() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isPushConfigured()) return NextResponse.json({ error: "VAPID chưa cấu hình" }, { status: 400 });
  await pushToUser(session.user.id, {
    title: "The Right Home",
    body: "Push notification đang hoạt động ✅",
    url: "/",
  });
  return NextResponse.json({ ok: true });
}
