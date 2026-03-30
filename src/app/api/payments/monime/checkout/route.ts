import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getRequestUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createOrderWithItems } from '@/lib/orders';
import { createMonimeCheckoutSession, getMonimeConfig } from '@/lib/monime';
import { toMinorUnits } from '@/lib/monime-payments';

function getPublicAppUrl(req: NextRequest) {
  const configuredUrl = process.env.NEXTAUTH_URL;
  if (configuredUrl) {
    return configuredUrl.replace(/\/$/, '');
  }

  return new URL(req.url).origin;
}

export async function POST(req: NextRequest) {
  const user = await getRequestUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.role !== 'waiter') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json();
  const { tableId, items, type, notes, customerName, customerPhone, discount } = body;

  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: 'No items provided' }, { status: 400 });
  }

  const callbackState = randomUUID();
  const config = getMonimeConfig();
  const publicAppUrl = getPublicAppUrl(req);

  let createdAttemptId: string | null = null;

  try {
    const createdOrder = await createOrderWithItems(prisma, {
      tableId,
      userId: user.id,
      type,
      notes,
      customerName,
      customerPhone,
      discount,
      paymentMethod: 'monime',
      paymentStatus: 'processing',
      status: 'payment_pending_confirmation',
      applySideEffects: false,
      items,
    });

    const attemptCount = await prisma.paymentAttempt.count({
      where: { orderId: createdOrder.id, provider: 'monime' },
    });
    const attemptNumber = attemptCount + 1;
    const reference = `order-${createdOrder.id}`;
    const idempotencyKey = `${reference}:attempt:${attemptNumber}`;

    const paymentAttempt = await prisma.paymentAttempt.create({
      data: {
        orderId: createdOrder.id,
        provider: 'monime',
        attemptNumber,
        reference,
        idempotencyKey,
        callbackState,
        status: 'pending',
        currency: config.currency,
        amountMinor: toMinorUnits(createdOrder.total),
        metadataJson: JSON.stringify({
          orderId: createdOrder.id,
          orderNumber: createdOrder.orderNumber,
        }),
      },
      include: {
        order: {
          include: {
            items: { include: { menuItem: true } },
          },
        },
      },
    });
    createdAttemptId = paymentAttempt.id;

    const { data, requestId } = await createMonimeCheckoutSession({
      reference: paymentAttempt.reference,
      name: `Order #${paymentAttempt.order.orderNumber}`,
      successUrl: `${publicAppUrl}/payments/monime/success?orderId=${paymentAttempt.orderId}&attemptId=${paymentAttempt.id}&callbackState=${paymentAttempt.callbackState}`,
      cancelUrl: `${publicAppUrl}/payments/monime/cancel?orderId=${paymentAttempt.orderId}&attemptId=${paymentAttempt.id}&callbackState=${paymentAttempt.callbackState}`,
      callbackState: paymentAttempt.callbackState,
      lineItems: paymentAttempt.order.items.map((item, index) => ({
        name: item.menuItem.name,
        type: 'custom',
        quantity: item.quantity,
        reference: `${paymentAttempt.orderId}-line-${index + 1}`,
        price: {
          value: toMinorUnits(item.unitPrice),
          currency: config.currency,
        },
        description: item.menuItem.description || undefined,
      })),
      metadata: {
        orderId: paymentAttempt.orderId,
        orderNumber: String(paymentAttempt.order.orderNumber),
        paymentAttemptId: paymentAttempt.id,
      },
    }, paymentAttempt.idempotencyKey);

    await prisma.paymentAttempt.update({
      where: { id: paymentAttempt.id },
      data: {
        status: 'processing',
        monimeCheckoutSessionId: data.id,
        monimePaymentId: data.paymentId || null,
        redirectUrl: data.redirectUrl,
      },
    });

    console.info('Monime checkout session created', {
      paymentAttemptId: paymentAttempt.id,
      monimeRequestId: requestId,
      monimeCheckoutSessionId: data.id,
      publicAppUrl,
    });

    return NextResponse.json({
      orderId: paymentAttempt.orderId,
      paymentAttemptId: paymentAttempt.id,
      checkoutSessionId: data.id,
      redirectUrl: data.redirectUrl,
      reference: paymentAttempt.reference,
    }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to create checkout session';
    if (createdAttemptId) {
      await prisma.$transaction([
        prisma.paymentAttempt.update({
          where: { id: createdAttemptId },
          data: { status: 'failed', failureReason: message },
        }),
        prisma.order.updateMany({
          where: { paymentAttempts: { some: { id: createdAttemptId } } },
          data: {
            paymentMethod: 'monime',
            paymentStatus: 'failed',
            status: 'cancelled',
          },
        }),
      ]);
    }
    console.error('Monime checkout session creation failed', { error: message });
    return NextResponse.json({ error: 'Unable to create checkout session', details: message }, { status: 500 });
  }
}
