import { createHash, createHmac, createVerify, timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getMonimeConfig } from '@/lib/monime';
import { prisma } from '@/lib/prisma';
import {
  applyAttemptStatusUpdateInTx,
  extractCheckoutSessionId,
  extractPaymentId,
  extractReference,
  normalisePaymentStatus,
} from '@/lib/monime-payments';

type MonimeWebhookPayload = {
  apiVersion?: string;
  id?: string;
  eventId?: string;
  type?: string;
  eventType?: string;
  status?: string;
  object?: {
    id?: string;
    type?: string;
    status?: string;
  };
  event?: {
    id?: string;
    name?: string;
    timestamp?: string;
  };
  payment?: {
    status?: string;
  };
  data?: {
    id?: string;
    type?: string;
    status?: string;
    object?: {
      id?: string;
      type?: string;
      status?: string;
    };
  };
};

function getEventId(req: NextRequest, payload: MonimeWebhookPayload, rawBody: string) {
  return (
    req.headers.get('monime-event-id') ||
    req.headers.get('x-monime-event-id') ||
    payload?.event?.id ||
    payload?.id ||
    payload?.eventId ||
    createHash('sha256').update(rawBody).digest('hex')
  );
}

function extractSignature(req: NextRequest) {
  return (
    req.headers.get('monime-signature') ||
    req.headers.get('x-monime-signature') ||
    req.headers.get('monime-webhook-signature') ||
    req.headers.get('x-monime-webhook-signature') ||
    req.headers.get('webhook-signature') ||
    req.headers.get('x-webhook-signature') ||
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

function parseSignatureHeader(signatureHeader: string) {
  const parts = signatureHeader
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

  const signatures = new Set<string>();
  let timestamp: string | null = null;

  for (const part of parts) {
    const separatorIndex = part.indexOf('=');
    if (separatorIndex === -1) {
      signatures.add(normaliseSignature(part));
      continue;
    }

    const key = part.slice(0, separatorIndex).trim().toLowerCase();
    const value = part.slice(separatorIndex + 1).trim();

    if (!value) continue;

    if (['t', 'ts', 'timestamp'].includes(key)) {
      timestamp = value;
      continue;
    }

    if (['v1', 'sig', 'signature', 'sha256', 'hs256'].includes(key)) {
      signatures.add(normaliseSignature(value));
    }
  }

  if (signatures.size === 0) {
    signatures.add(normaliseSignature(signatureHeader));
  }

  return {
    signatures: Array.from(signatures),
    timestamp,
  };
}

function extractTimestamp(req: NextRequest, parsedSignature: { timestamp: string | null }) {
  return (
    req.headers.get('monime-timestamp') ||
    req.headers.get('x-monime-timestamp') ||
    req.headers.get('webhook-timestamp') ||
    req.headers.get('x-webhook-timestamp') ||
    parsedSignature.timestamp ||
    null
  );
}

function validateTimestamp(timestamp: string | null, toleranceSeconds: number) {
  if (!timestamp || toleranceSeconds <= 0) {
    return true;
  }

  const numericTimestamp = Number(timestamp);
  if (!Number.isFinite(numericTimestamp)) {
    return true;
  }

  const timestampMs = numericTimestamp > 1_000_000_000_000 ? numericTimestamp : numericTimestamp * 1000;
  const ageMs = Math.abs(Date.now() - timestampMs);

  return ageMs <= toleranceSeconds * 1000;
}

function verifyHs256Signature(secret: string, message: string, signature: string) {
  const digest = createHmac('sha256', secret).update(message, 'utf8').digest();
  const expectedHex = digest.toString('hex');
  const expectedBase64 = digest.toString('base64');
  const expectedBase64Url = digest.toString('base64url');

  return (
    safeEqual(signature, expectedHex) ||
    safeEqual(signature, expectedBase64) ||
    safeEqual(signature, expectedBase64Url)
  );
}

function verifyEs256Signature(publicKey: string, message: string, signature: string) {
  const candidates = [signature, signature.replace(/-/g, '+').replace(/_/g, '/')];

  for (const candidate of candidates) {
    const paddedCandidate = candidate.padEnd(Math.ceil(candidate.length / 4) * 4, '=');
    const bufferCandidates = [
      Buffer.from(candidate, 'hex'),
      Buffer.from(candidate, 'base64'),
      Buffer.from(paddedCandidate, 'base64'),
    ];

    for (const buffer of bufferCandidates) {
      if (buffer.length === 0) continue;

      try {
        const verifier = createVerify('SHA256');
        verifier.update(message, 'utf8');
        verifier.end();
        if (verifier.verify(publicKey, buffer)) {
          return true;
        }
      } catch {
        continue;
      }
    }
  }

  return false;
}

function validateWebhookSignature(req: NextRequest, rawBody: string) {
  const config = getMonimeConfig();
  const verificationMethod = config.webhookVerificationMethod;

  if (verificationMethod === 'ES256' && !config.webhookPublicKey) {
    throw new Error('MONIME_WEBHOOK_PUBLIC_KEY is not configured for ES256 verification');
  }

  if (verificationMethod !== 'ES256' && !config.webhookSecret) {
    throw new Error('MONIME_WEBHOOK_SECRET is not configured');
  }

  const providedSignature = extractSignature(req);
  if (!providedSignature) {
    return false;
  }

  const parsedSignature = parseSignatureHeader(providedSignature);
  const timestamp = extractTimestamp(req, parsedSignature);

  if (!validateTimestamp(timestamp, config.webhookToleranceSeconds)) {
    return false;
  }

  const messages = timestamp
    ? [rawBody, `${timestamp}.${rawBody}`, `${timestamp}:${rawBody}`]
    : [rawBody];

  for (const signature of parsedSignature.signatures) {
    for (const message of messages) {
      const isValid = verificationMethod === 'ES256'
        ? verifyEs256Signature(config.webhookPublicKey!, message, signature)
        : verifyHs256Signature(config.webhookSecret!, message, signature);

      if (isValid) {
        return true;
      }
    }
  }

  return false;
}

export async function POST(req: NextRequest) {
  let rawBody = '';

  try {
    rawBody = await req.text();
    if (!validateWebhookSignature(req, rawBody)) {
      console.warn('Monime webhook signature validation failed', {
        verificationMethod: getMonimeConfig().webhookVerificationMethod,
        headerNames: Array.from(req.headers.keys()).filter((headerName) => (
          headerName.includes('monime') ||
          headerName.includes('signature') ||
          headerName.includes('timestamp')
        )),
      });
      return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 });
    }

    const payload: MonimeWebhookPayload = rawBody ? JSON.parse(rawBody) : {};
    const eventType = payload?.event?.name || payload?.type || payload?.eventType || 'unknown';
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

    if (!attempt) {
      const delivery = await prisma.webhookDelivery.create({
        data: {
          provider: 'monime',
          eventId,
          eventType,
          paymentAttemptId: null,
        },
      });
      console.warn('Monime webhook received for unknown payment attempt', {
        eventId,
        eventType,
        paymentId,
        checkoutSessionId,
        reference,
      });
      return NextResponse.json({ received: true, matched: false, deliveryId: delivery.id });
    }

    const updatedAttempt = await prisma.$transaction(async (tx) => {
      const duplicateDelivery = await tx.webhookDelivery.findUnique({
        where: { eventId },
      });

      if (duplicateDelivery) {
        return null;
      }

      await tx.webhookDelivery.create({
        data: {
          provider: 'monime',
          eventId,
          eventType,
          paymentAttemptId: attempt.id,
        },
      });

      return applyAttemptStatusUpdateInTx(tx, {
        attemptId: attempt.id,
        attemptStatus: status,
        monimePaymentId: paymentId,
        lastWebhookEventId: eventId,
        failureReason: status === 'failed' ? eventType : null,
      });
    });

    if (!updatedAttempt) {
      return NextResponse.json({ received: true, duplicate: true });
    }

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
