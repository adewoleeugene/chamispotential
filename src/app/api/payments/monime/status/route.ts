import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { refreshAttemptFromMonime } from '@/lib/monime-payments';

export async function GET(req: NextRequest) {
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

  const attempt = refresh ? await refreshAttemptFromMonime(existingAttempt.id) : existingAttempt;

  return NextResponse.json({
    paymentAttempt: attempt,
    authoritativeSignal: 'Webhook delivery is authoritative for final settlement. Success redirects only provide user experience state.',
  });
}
