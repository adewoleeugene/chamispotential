import type { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getMonimeCheckoutSession, getMonimePayment } from '@/lib/monime';
import {
  activateOrderForService,
  isOperationalOrderStatus,
  moveTableToCleaningIfNoActiveOrders,
  shouldCloseOrderService,
} from '@/lib/orders';

type PrismaTx = Prisma.TransactionClient | PrismaClient;

type MonimeWebhookObject = {
  id?: string;
  type?: string;
  paymentId?: string;
  checkoutSessionId?: string;
  reference?: string;
  status?: string;
};

type MonimeWebhookPayload = {
  apiVersion?: string;
  id?: string;
  eventId?: string;
  type?: string;
  eventType?: string;
  status?: string;
  object?: MonimeWebhookObject;
  event?: {
    id?: string;
    name?: string;
    timestamp?: string;
  };
  paymentId?: string;
  checkoutSessionId?: string;
  reference?: string;
  payment?: MonimeWebhookObject;
  data?: {
    id?: string;
    type?: string;
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

async function applyAttemptStatusUpdateTx(tx: PrismaTx, params: {
  attemptId: string;
  attemptStatus: string;
  monimePaymentId?: string | null;
  lastWebhookEventId?: string | null;
  failureReason?: string | null;
}) {
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
    const shouldCompleteOrder = shouldCloseOrderService(updatedAttempt.order);
    const updatedOrder = await tx.order.update({
      where: { id: updatedAttempt.orderId },
      data: {
        paymentMethod: 'monime',
        paymentStatus: 'paid',
        ...(shouldCompleteOrder
          ? {
            status: 'completed',
            serviceEndedAt: updatedAttempt.order.serviceEndedAt || new Date(),
          }
          : {}),
      },
    });

    if (shouldCompleteOrder) {
      await moveTableToCleaningIfNoActiveOrders(tx, updatedOrder.tableId);
    } else {
      await activateOrderForService(tx, updatedAttempt.orderId);
    }
  } else {
    const orderIsOperational = isOperationalOrderStatus(updatedAttempt.order.status);
    await tx.order.update({
      where: { id: updatedAttempt.orderId },
      data: {
        paymentMethod: params.attemptStatus === 'processing'
          ? 'monime'
          : orderIsOperational
            ? null
            : 'monime',
        paymentStatus: mapOrderPaymentStatus(params.attemptStatus),
        status: orderIsOperational
          ? undefined
          : params.attemptStatus === 'processing'
            ? 'payment_pending_confirmation'
            : params.attemptStatus === 'cancelled'
              ? 'draft'
              : undefined,
      },
    });
  }

  return updatedAttempt;
}

export async function applyAttemptStatusUpdate(params: {
  attemptId: string;
  attemptStatus: string;
  monimePaymentId?: string | null;
  lastWebhookEventId?: string | null;
  failureReason?: string | null;
}) {
  return prisma.$transaction(async (tx) => applyAttemptStatusUpdateTx(tx, params));
}

export async function applyAttemptStatusUpdateInTx(tx: PrismaTx, params: {
  attemptId: string;
  attemptStatus: string;
  monimePaymentId?: string | null;
  lastWebhookEventId?: string | null;
  failureReason?: string | null;
}) {
  return applyAttemptStatusUpdateTx(tx, params);
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
    (payload?.data?.type === 'payment' ? payload?.data?.id ?? null : null) ||
    (payload?.data?.object?.type === 'payment' ? payload?.data?.object?.id ?? null : null) ||
    (payload?.object?.type === 'payment' ? payload?.object?.id ?? null : null) ||
    payload?.paymentId ||
    payload?.payment?.id ||
    null
  );
}

export function extractCheckoutSessionId(payload: MonimeWebhookPayload) {
  return (
    payload?.data?.checkoutSessionId ||
    payload?.data?.object?.checkoutSessionId ||
    (payload?.data?.type === 'checkout_session' ? payload?.data?.id ?? null : null) ||
    (payload?.data?.object?.type === 'checkout_session' ? payload?.data?.object?.id ?? null : null) ||
    (payload?.object?.type === 'checkout_session' ? payload?.object?.id ?? null : null) ||
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
