import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { saveFile } from "@/lib/storage";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const fd = await req.formData();
  const f = fd.get("file") as File | null;
  if (!f) return NextResponse.json({ error: "Missing file" }, { status: 400 });
  if (f.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "Ảnh quá lớn (>10MB)" }, { status: 400 });
  }
  const url = await saveFile("qr-codes", f);
  return NextResponse.json({ url });
}
