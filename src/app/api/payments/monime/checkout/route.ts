import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getRequestUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createOrderWithItems } from '@/lib/orders';
import { createMonimeCheckoutSession, getMonimeConfig } from '@/lib/monime';
import { toMinorUnits } from '@/lib/monime-payments';
import { normalizeCustomizationInputs } from '@/lib/order-customization';
import { isWaiterRole } from '@/lib/roleRoutes';

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
  if (!isWaiterRole(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json();
  const { orderId, tableId, items, type, notes, customerName, customerPhone, discount } = body;
  const hasExistingOrder = typeof orderId === 'string' && orderId.length > 0;

  if (!hasExistingOrder) {
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'No items provided' }, { status: 400 });
    }
  }
  const normalizedItems = Array.isArray(items) ? items.map(normalizeCustomizationInputs) : [];

  const callbackState = randomUUID();
  const config = getMonimeConfig();
  const publicAppUrl = getPublicAppUrl(req);

  let createdAttemptId: string | null = null;
  let existingOrderSnapshot: { id: string; status: string; paymentStatus: string; paymentMethod: string | null } | null = null;
  let existingOrderMode = false;

  try {
    const paymentAttempt = await prisma.$transaction(async (tx) => {
      let targetOrder;

      if (hasExistingOrder) {
        existingOrderMode = true;
        const order = await tx.order.findUnique({
          where: { id: orderId },
          include: {
            items: {
              include: {
                menuItem: true,
                removals: true,
                additions: true,
              },
            },
          },
        });

        if (!order) {
          throw new Error('ORDER_NOT_FOUND');
        }

        if (order.paymentStatus === 'paid') {
          throw new Error('ORDER_ALREADY_PAID');
        }

        if (order.paymentStatus === 'processing') {
          throw new Error('ORDER_PAYMENT_IN_PROGRESS');
        }

        existingOrderSnapshot = {
          id: order.id,
          status: order.status,
          paymentStatus: order.paymentStatus,
          paymentMethod: order.paymentMethod,
        };

        targetOrder = await tx.order.update({
          where: { id: order.id },
          data: {
            paymentMethod: 'monime',
            paymentStatus: 'processing',
          },
          include: {
            items: {
              include: {
                menuItem: true,
                removals: true,
                additions: true,
              },
            },
          },
        });
      } else {
        targetOrder = await createOrderWithItems(tx, {
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
          items: normalizedItems,
        });
      }

      const attemptCount = await tx.paymentAttempt.count({
        where: { orderId: targetOrder.id, provider: 'monime' },
      });
      const attemptNumber = attemptCount + 1;
      const reference = `order-${targetOrder.id}-attempt-${attemptNumber}`;
      const idempotencyKey = `${reference}:attempt:${attemptNumber}`;

      return tx.paymentAttempt.create({
        data: {
          orderId: targetOrder.id,
          provider: 'monime',
          attemptNumber,
          reference,
          idempotencyKey,
          callbackState,
          status: 'pending',
          currency: config.currency,
          amountMinor: toMinorUnits(targetOrder.total),
          metadataJson: JSON.stringify({
            orderId: targetOrder.id,
            orderNumber: targetOrder.orderNumber,
            existingOrderMode,
          }),
        },
        include: {
          order: { include: { items: { include: { menuItem: true, removals: true, additions: true } } } },
        },
      });
    }, { timeout: 20000 });
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
    if (message === 'ORDER_NOT_FOUND') {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }
    if (message === 'ORDER_ALREADY_PAID') {
      return NextResponse.json({ error: 'Order is already settled' }, { status: 400 });
    }
    if (message === 'ORDER_PAYMENT_IN_PROGRESS') {
      return NextResponse.json({ error: 'A Monime payment is already in progress for this order' }, { status: 400 });
    }
    if (createdAttemptId) {
      if (existingOrderMode && existingOrderSnapshot !== null) {
        const snapshot = existingOrderSnapshot as { id: string; status: string; paymentStatus: string; paymentMethod: string | null };
        await prisma.$transaction([
          prisma.paymentAttempt.update({
            where: { id: createdAttemptId },
            data: { status: 'failed', failureReason: message },
          }),
          prisma.order.update({
            where: { id: snapshot.id },
            data: {
              status: snapshot.status,
              paymentStatus: snapshot.paymentStatus,
              paymentMethod: snapshot.paymentMethod,
            },
          }),
        ]);
      } else {
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
    }
    console.error('Monime checkout session creation failed', { error: message });
    return NextResponse.json({ error: 'Unable to create checkout session', details: message }, { status: 500 });
  }
}
