export type PaymentMethod = 'cash' | 'monime';
export type DeferredPaymentMethod = 'cash' | 'card' | 'mobile';
export type BillingMode = 'pay_now' | 'open_tab';

type OrderPaymentConfigInput =
  | {
    billingMode: 'open_tab';
  }
  | {
    billingMode: 'pay_now';
    paymentMethod: PaymentMethod;
  };

export function isManualPaymentMethod(value: string | null | undefined): value is DeferredPaymentMethod {
  return value === 'cash' || value === 'card' || value === 'mobile';
}

export function getManualPaymentMethodLabel(method: string | null | undefined) {
  switch (method) {
    case 'card':
      return 'Card';
    case 'mobile':
      return 'Mobile';
    case 'cash':
    default:
      return 'Cash';
  }
}

export function getOrderPaymentConfig(input: OrderPaymentConfigInput) {
  if (input.billingMode === 'pay_now' && input.paymentMethod === 'monime') {
    return {
      paymentMethod: 'monime' as const,
      paymentStatus: 'processing' as const,
      status: 'payment_pending_confirmation' as const,
      deferActivation: true,
    };
  }

  if (input.billingMode === 'pay_now' && input.paymentMethod === 'cash') {
    return {
      paymentMethod: 'cash' as const,
      paymentStatus: 'paid' as const,
      status: 'pending' as const,
    };
  }

  return {
    paymentMethod: null,
    paymentStatus: 'unpaid' as const,
    status: 'pending' as const,
  };
}
