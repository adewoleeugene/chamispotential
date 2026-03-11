import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { applyAttemptStatusUpdate } from '@/lib/monime-payments';

export async function POST(req: NextRequest) {
  const { attemptId, orderId, callbackState } = await req.json();

  if (!attemptId || !orderId || !callbackState) {
    return NextResponse.json({ error: 'Missing payment attempt context' }, { status: 400 });
  }

  const attempt = await prisma.paymentAttempt.findFirst({
    where: {
      id: attemptId,
      orderId,
      callbackState,
    },
  });

  if (!attempt) {
    return NextResponse.json({ error: 'Payment attempt not found' }, { status: 404 });
  }

  const updatedAttempt = await applyAttemptStatusUpdate({
    attemptId: attempt.id,
    attemptStatus: 'cancelled',
  });

  return NextResponse.json({ paymentAttempt: updatedAttempt });
}
