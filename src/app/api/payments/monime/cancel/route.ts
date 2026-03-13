import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getRequestUser } from '@/lib/auth';
import { applyAttemptStatusUpdate } from '@/lib/monime-payments';

export async function POST(req: NextRequest) {
  const user = await getRequestUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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
    include: {
      order: {
        select: {
          userId: true,
        },
      },
    },
  });

  if (!attempt) {
    return NextResponse.json({ error: 'Payment attempt not found' }, { status: 404 });
  }

  const canAccessAttempt = attempt.order.userId === user.id || ['admin', 'manager'].includes(user.role);
  if (!canAccessAttempt) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const updatedAttempt = await applyAttemptStatusUpdate({
    attemptId: attempt.id,
    attemptStatus: 'cancelled',
  });

  return NextResponse.json({ paymentAttempt: updatedAttempt });
}
