import webpush from 'web-push';
import { prisma } from '@/lib/prisma';

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

let configured = false;
function ensureConfigured() {
  if (configured) return true;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || 'mailto:ops@example.com';
  if (!publicKey || !privateKey) {
    console.warn('Web Push disabled: VAPID keys not configured');
    return false;
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
  return true;
}

async function deliver(
  subs: Array<{ id: string; endpoint: string; p256dh: string; auth: string }>,
  payload: PushPayload,
) {
  if (subs.length === 0) return;
  const serialized = JSON.stringify(payload);

  const results = await Promise.allSettled(
    subs.map((sub) =>
      webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        serialized,
      ),
    ),
  );

  const expiredIds: string[] = [];
  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      const err = result.reason as { statusCode?: number } | undefined;
      if (err?.statusCode === 404 || err?.statusCode === 410) {
        expiredIds.push(subs[index].id);
      } else {
        console.warn('Web Push send failed', { endpoint: subs[index].endpoint, error: err });
      }
    }
  });

  if (expiredIds.length > 0) {
    await prisma.pushSubscription.deleteMany({ where: { id: { in: expiredIds } } });
  }
}

export async function sendToRoles(roles: string[], payload: PushPayload) {
  if (!ensureConfigured() || roles.length === 0) return;
  const subs = await prisma.pushSubscription.findMany({
    where: { user: { role: { in: roles }, isActive: true } },
    select: { id: true, endpoint: true, p256dh: true, auth: true },
  });
  await deliver(subs, payload);
}

export async function sendToUser(userId: string, payload: PushPayload) {
  if (!ensureConfigured()) return;
  const subs = await prisma.pushSubscription.findMany({
    where: { userId },
    select: { id: true, endpoint: true, p256dh: true, auth: true },
  });
  await deliver(subs, payload);
}

export function fireAndForget(promise: Promise<unknown>) {
  promise.catch((err) => console.error('Background push dispatch failed', err));
}
