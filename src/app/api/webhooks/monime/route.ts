import { createHash, createHmac, timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getMonimeConfig } from '@/lib/monime';
import { prisma } from '@/lib/prisma';
import {
  applyAttemptStatusUpdate,
  extractCheckoutSessionId,
  extractPaymentId,
  extractReference,
  normalisePaymentStatus,
} from '@/lib/monime-payments';

type MonimeWebhookPayload = {
  id?: string;
  eventId?: string;
  type?: string;
  eventType?: string;
  status?: string;
  payment?: {
    status?: string;
  };
  data?: {
    status?: string;
    object?: {
      status?: string;
    };
  };
};

function getEventId(req: NextRequest, payload: MonimeWebhookPayload, rawBody: string) {
  return (
    req.headers.get('monime-event-id') ||
    req.headers.get('x-monime-event-id') ||
    payload?.id ||
    payload?.eventId ||
    createHash('sha256').update(rawBody).digest('hex')
  );
}

function extractSignature(req: NextRequest) {
  return (
    req.headers.get('x-monime-signature') ||
    req.headers.get('monime-signature') ||
    req.headers.get('x-signature') ||
    req.headers.get('signature') ||
    null
  );
}

function normaliseSignature(signature: string) {
  return signature
    .trim()
    .replace(/^sha256=/i, '')
    .replace(/^hs256=/i, '');
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

function validateWebhookSignature(req: NextRequest, rawBody: string) {
  const config = getMonimeConfig();
  if (!config.webhookSecret) {
    throw new Error('MONIME_WEBHOOK_SECRET is not configured');
  }

  const providedSignature = extractSignature(req);
  if (!providedSignature) {
    return false;
  }

  const normalisedProvidedSignature = normaliseSignature(providedSignature);
  const digest = createHmac('sha256', config.webhookSecret).update(rawBody, 'utf8').digest();
  const expectedHex = digest.toString('hex');
  const expectedBase64 = digest.toString('base64');

  return safeEqual(normalisedProvidedSignature, expectedHex) || safeEqual(normalisedProvidedSignature, expectedBase64);
}

export async function POST(req: NextRequest) {
  let rawBody = '';

  try {
    rawBody = await req.text();
    if (!validateWebhookSignature(req, rawBody)) {
      return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 });
    }

    const payload: MonimeWebhookPayload = rawBody ? JSON.parse(rawBody) : {};
    const eventType = payload?.type || payload?.eventType || 'unknown';
    const eventId = getEventId(req, payload, rawBody);
    const paymentId = extractPaymentId(payload);
    const checkoutSessionId = extractCheckoutSessionId(payload);
    const reference = extractReference(payload);
    const status = normalisePaymentStatus(
      payload?.data?.status ||
      payload?.data?.object?.status ||
      payload?.payment?.status ||
      payload?.status
    );

    const existingDelivery = await prisma.webhookDelivery.findUnique({
      where: { eventId },
    });

    if (existingDelivery) {
      return NextResponse.json({ received: true, duplicate: true });
    }

    const paymentAttemptFilters: Array<
      | { monimePaymentId: string }
      | { monimeCheckoutSessionId: string }
      | { reference: string }
    > = [];

    if (paymentId) paymentAttemptFilters.push({ monimePaymentId: paymentId });
    if (checkoutSessionId) paymentAttemptFilters.push({ monimeCheckoutSessionId: checkoutSessionId });
    if (reference) paymentAttemptFilters.push({ reference });

    const attempt = paymentAttemptFilters.length > 0
      ? await prisma.paymentAttempt.findFirst({
        where: {
          OR: paymentAttemptFilters,
        },
      })
      : null;

    const delivery = await prisma.webhookDelivery.create({
      data: {
        provider: 'monime',
        eventId,
        eventType,
        paymentAttemptId: attempt?.id,
      },
    });

    if (!attempt) {
      console.warn('Monime webhook received for unknown payment attempt', {
        eventId,
        eventType,
        paymentId,
        checkoutSessionId,
        reference,
      });
      return NextResponse.json({ received: true, matched: false, deliveryId: delivery.id });
    }

    const updatedAttempt = await applyAttemptStatusUpdate({
      attemptId: attempt.id,
      attemptStatus: status,
      monimePaymentId: paymentId,
      lastWebhookEventId: eventId,
      failureReason: status === 'failed' ? eventType : null,
    });

    return NextResponse.json({
      received: true,
      matched: true,
      paymentAttemptId: updatedAttempt.id,
      status: updatedAttempt.status,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Webhook processing failed';
    console.error('Monime webhook processing failed', { error: message, rawBody });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
