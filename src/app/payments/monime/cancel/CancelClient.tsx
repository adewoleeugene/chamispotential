'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

export function CancelClient({
  attemptId,
  orderId,
  callbackState,
}: {
  attemptId?: string;
  orderId?: string;
  callbackState?: string;
}) {
  const hasContext = Boolean(attemptId && orderId && callbackState);
  const [message, setMessage] = useState(hasContext ? 'Restoring your checkout context...' : 'Payment was cancelled.');

  useEffect(() => {
    if (!hasContext || !attemptId || !orderId || !callbackState) {
      return;
    }

    fetch('/api/payments/monime/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        attemptId,
        orderId,
        callbackState,
      }),
    })
      .then(() => setMessage('Payment attempt cancelled. The order remains open for a retry.'))
      .catch(() => setMessage('Payment was cancelled.'));
  }, [attemptId, orderId, callbackState, hasContext]);

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: 'linear-gradient(180deg, #1f2937 0%, #111827 100%)', color: '#f9fafb' }}>
      <div style={{ width: '100%', maxWidth: 560, background: 'rgba(17, 24, 39, 0.86)', border: '1px solid rgba(248, 113, 113, 0.18)', borderRadius: 24, padding: 32 }}>
        <div style={{ fontSize: 12, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#fca5a5', marginBottom: 12 }}>Monime Checkout</div>
        <h1 style={{ fontSize: 30, margin: 0 }}>Payment cancelled</h1>
        <p style={{ color: '#d1d5db', lineHeight: 1.6, marginTop: 12 }}>{message}</p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 28 }}>
          <Link href="/orders" style={{ background: '#f97316', color: '#431407', padding: '12px 16px', borderRadius: 999, textDecoration: 'none', fontWeight: 700 }}>
            Return to orders
          </Link>
          <Link href="/dashboard" style={{ background: 'transparent', color: '#e5e7eb', padding: '12px 16px', borderRadius: 999, textDecoration: 'none', border: '1px solid rgba(156, 163, 175, 0.3)' }}>
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
