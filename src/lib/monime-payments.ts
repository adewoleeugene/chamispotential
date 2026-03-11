import { prisma } from '@/lib/prisma';
import { getMonimeCheckoutSession, getMonimePayment } from '@/lib/monime';
import { activateOrderForService } from '@/lib/orders';

type MonimeWebhookObject = {
  id?: string;
  paymentId?: string;
  checkoutSessionId?: string;
  reference?: string;
  status?: string;
};

type MonimeWebhookPayload = {
  id?: string;
  eventId?: string;
  type?: string;
  eventType?: string;
  status?: string;
  paymentId?: string;
  checkoutSessionId?: string;
  reference?: string;
  payment?: MonimeWebhookObject;
  data?: {
    status?: string;
    paymentId?: string;
    checkoutSessionId?: string;
    reference?: string;
    object?: MonimeWebhookObject;
  };
};

export function toMinorUnits(amount: number) {
  return Math.round(amount * 100);
}

export function normalisePaymentStatus(status?: string | null) {
  const value = status?.toLowerCase();

  if (!value) return 'pending';
  if (['completed', 'paid', 'succeeded', 'success', 'settled'].includes(value)) return 'completed';
  if (['failed', 'declined', 'error'].includes(value)) return 'failed';
  if (['cancelled', 'canceled', 'abandoned', 'expired'].includes(value)) return 'cancelled';
  if (['processing', 'pending', 'authorized', 'created'].includes(value)) return 'processing';
  return 'pending';
}

function mapOrderPaymentStatus(attemptStatus: string) {
  switch (attemptStatus) {
    case 'completed':
      return 'paid';
    case 'failed':
      return 'failed';
    case 'processing':
      return 'processing';
    default:
      return 'unpaid';
  }
}

export async function applyAttemptStatusUpdate(params: {
  attemptId: string;
  attemptStatus: string;
  monimePaymentId?: string | null;
  lastWebhookEventId?: string | null;
  failureReason?: string | null;
}) {
  return prisma.$transaction(async (tx) => {
    const updatedAttempt = await tx.paymentAttempt.update({
      where: { id: params.attemptId },
      data: {
        status: params.attemptStatus,
        monimePaymentId: params.monimePaymentId ?? undefined,
        lastWebhookEventId: params.lastWebhookEventId ?? undefined,
        failureReason: params.failureReason ?? undefined,
      },
      include: {
        order: true,
      },
    });

    if (params.attemptStatus === 'completed') {
      await tx.order.update({
        where: { id: updatedAttempt.orderId },
        data: {
          paymentMethod: 'monime',
          paymentStatus: 'paid',
        },
      });
      await activateOrderForService(tx, updatedAttempt.orderId);
    } else {
      await tx.order.update({
        where: { id: updatedAttempt.orderId },
        data: {
          paymentMethod: 'monime',
          paymentStatus: mapOrderPaymentStatus(params.attemptStatus),
          status: params.attemptStatus === 'processing' ? 'payment_pending_confirmation' : params.attemptStatus === 'cancelled' ? 'draft' : undefined,
        },
      });
    }

    return updatedAttempt;
  });
}

export async function refreshAttemptFromMonime(paymentAttemptId: string) {
  const attempt = await prisma.paymentAttempt.findUnique({
    where: { id: paymentAttemptId },
  });

  if (!attempt) {
    return attempt;
  }

  if (attempt.monimePaymentId) {
    const { data } = await getMonimePayment(attempt.monimePaymentId);
    const attemptStatus = normalisePaymentStatus(data.status);

    await applyAttemptStatusUpdate({
      attemptId: attempt.id,
      attemptStatus,
      monimePaymentId: data.id || attempt.monimePaymentId,
    });
  } else if (attempt.monimeCheckoutSessionId) {
    const { data } = await getMonimeCheckoutSession(attempt.monimeCheckoutSessionId);
    const attemptStatus = normalisePaymentStatus(data.status);

    await applyAttemptStatusUpdate({
      attemptId: attempt.id,
      attemptStatus,
    });
  } else {
    return attempt;
  }

  return prisma.paymentAttempt.findUnique({
    where: { id: paymentAttemptId },
    include: { order: true },
  });
}

export function extractPaymentId(payload: MonimeWebhookPayload) {
  return (
    payload?.data?.paymentId ||
    payload?.data?.object?.paymentId ||
    payload?.data?.object?.id ||
    payload?.paymentId ||
    payload?.payment?.id ||
    null
  );
}

export function extractCheckoutSessionId(payload: MonimeWebhookPayload) {
  return (
    payload?.data?.checkoutSessionId ||
    payload?.data?.object?.checkoutSessionId ||
    payload?.data?.object?.id ||
    payload?.checkoutSessionId ||
    null
  );
}

export function extractReference(payload: MonimeWebhookPayload) {
  return (
    payload?.data?.reference ||
    payload?.data?.object?.reference ||
    payload?.reference ||
    payload?.payment?.reference ||
    null
  );
}
