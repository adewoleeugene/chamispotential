import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getRequestUser } from '@/lib/auth';
import { refreshAttemptFromMonime } from '@/lib/monime-payments';

export async function GET(req: NextRequest) {
  const user = await getRequestUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(req.url);
  const attemptId = url.searchParams.get('attemptId');
  const orderId = url.searchParams.get('orderId');
  const callbackState = url.searchParams.get('callbackState');
  const refresh = url.searchParams.get('refresh') === 'true';

  if (!attemptId || !orderId || !callbackState) {
    return NextResponse.json({ error: 'Missing required query parameters' }, { status: 400 });
  }

  const existingAttempt = await prisma.paymentAttempt.findFirst({
    where: {
      id: attemptId,
      orderId,
      callbackState,
    },
    include: {
      order: {
        select: {
          id: true,
          userId: true,
          orderNumber: true,
          paymentStatus: true,
          status: true,
          total: true,
        },
      },
    },
  });

  if (!existingAttempt) {
    return NextResponse.json({ error: 'Payment attempt not found' }, { status: 404 });
  }

  const canAccessAttempt = existingAttempt.order.userId === user.id || ['admin', 'manager'].includes(user.role);
  if (!canAccessAttempt) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const attempt = refresh ? await refreshAttemptFromMonime(existingAttempt.id) : existingAttempt;

  return NextResponse.json({
    paymentAttempt: attempt,
    authoritativeSignal: 'Webhook delivery is authoritative for final settlement. Success redirects only provide user experience state.',
  });
}
