import webpush from "web-push";
import { prisma } from "@/lib/prisma";

const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT = "mailto:admin@shipus.vn" } = process.env;

let configured = false;
function ensureConfigured() {
  if (configured) return;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) throw new Error("VAPID not configured");
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  configured = true;
}

export function isPushConfigured() {
  return Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);
}

export async function pushToUser(userId: string, payload: { title: string; body: string; url?: string }) {
  if (!isPushConfigured()) return;
  ensureConfigured();
  const subs = await prisma.pushSubscription.findMany({ where: { userId } });
  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify(payload),
      );
    } catch (e) {
      const err = e as { statusCode?: number };
      if (err.statusCode === 404 || err.statusCode === 410) {
        await prisma.pushSubscription.delete({ where: { id: s.id } }).catch(() => {});
      }
    }
  }));
}

export async function pushToAllAdmins(payload: { title: string; body: string; url?: string }) {
  const admins = await prisma.user.findMany({ where: { role: "ADMIN", active: true }, select: { id: true } });
  await Promise.all(admins.map((a) => pushToUser(a.id, payload)));
}
