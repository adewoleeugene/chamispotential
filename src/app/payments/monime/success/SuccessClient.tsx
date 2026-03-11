'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { formatLeones } from '@/lib/currency';

type PaymentStatusResponse = {
  paymentAttempt?: {
    id: string;
    status: string;
    order?: {
      orderNumber: number;
      total: number;
    };
  };
  authoritativeSignal?: string;
  error?: string;
};

export function SuccessClient({
  attemptId,
  orderId,
  callbackState,
}: {
  attemptId?: string;
  orderId?: string;
  callbackState?: string;
}) {
  const hasContext = Boolean(attemptId && orderId && callbackState);
  const [data, setData] = useState<PaymentStatusResponse | null>(hasContext ? null : { error: 'Missing payment context.' });
  const [loading, setLoading] = useState(hasContext);

  useEffect(() => {
    if (!hasContext || !attemptId || !orderId || !callbackState) {
      return;
    }

    let cancelled = false;

    const readStatus = async () => {
      const response = await fetch(`/api/payments/monime/status?attemptId=${attemptId}&orderId=${orderId}&callbackState=${callbackState}&refresh=true`, {
        cache: 'no-store',
      });
      const payload = await response.json();
      if (!cancelled) {
        setData(payload);
        setLoading(false);
      }
    };

    readStatus();
    const interval = setInterval(readStatus, 4000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [attemptId, orderId, callbackState, hasContext]);

  const status = data?.paymentAttempt?.status || 'pending';

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: 'linear-gradient(180deg, #07131a 0%, #0f172a 100%)', color: '#f8fafc' }}>
      <div style={{ width: '100%', maxWidth: 640, background: 'rgba(15, 23, 42, 0.82)', border: '1px solid rgba(148, 163, 184, 0.2)', borderRadius: 24, padding: 32, boxShadow: '0 24px 60px rgba(0,0,0,0.35)' }}>
        <div style={{ fontSize: 12, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#38bdf8', marginBottom: 12 }}>Monime Checkout</div>
        <h1 style={{ fontSize: 32, margin: 0 }}>Payment return received</h1>
        <p style={{ color: '#cbd5e1', marginTop: 12, lineHeight: 1.6 }}>
          {loading
            ? 'Checking payment status...'
            : status === 'completed'
              ? 'Payment confirmed.'
              : 'Payment received. Final confirmation is still being reconciled with Monime.'}
        </p>

        <div style={{ marginTop: 24, padding: 20, borderRadius: 18, background: 'rgba(15, 118, 110, 0.12)', border: '1px solid rgba(45, 212, 191, 0.24)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <span>Status</span>
            <strong style={{ textTransform: 'capitalize' }}>{status}</strong>
          </div>
          {data?.paymentAttempt?.order && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
                <span>Order</span>
                <strong>#{data.paymentAttempt.order.orderNumber}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
                <span>Total</span>
                <strong>{formatLeones(data.paymentAttempt.order.total)}</strong>
              </div>
            </>
          )}
        </div>

        {data?.authoritativeSignal && (
          <p style={{ marginTop: 16, color: '#94a3b8', fontSize: 14 }}>
            {status === 'completed'
              ? 'Monime settlement has been reconciled with your local order.'
              : data.authoritativeSignal}
          </p>
        )}
        {data?.error && <p style={{ marginTop: 16, color: '#fca5a5' }}>{data.error}</p>}

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 28 }}>
          <Link href="/orders" style={{ background: '#0ea5e9', color: '#082f49', padding: '12px 16px', borderRadius: 999, textDecoration: 'none', fontWeight: 700 }}>
            Back to orders
          </Link>
          <Link href="/dashboard" style={{ background: 'transparent', color: '#e2e8f0', padding: '12px 16px', borderRadius: 999, textDecoration: 'none', border: '1px solid rgba(148, 163, 184, 0.3)' }}>
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
