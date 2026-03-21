export type PaymentChannel = 'manual' | 'monime';
export type ManualPaymentMethod = 'cash' | 'card' | 'mobile';
export type ManualPaymentFlow = 'settle_now' | 'open_tab';

type OrderPaymentConfigInput = {
  paymentChannel: PaymentChannel;
  manualPaymentMethod: ManualPaymentMethod;
  manualPaymentFlow: ManualPaymentFlow;
};

export function isManualPaymentMethod(value: string | null | undefined): value is ManualPaymentMethod {
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
  if (input.paymentChannel === 'monime') {
    return {
      paymentMethod: 'monime' as const,
      paymentStatus: 'processing' as const,
      status: 'payment_pending_confirmation' as const,
      deferActivation: true,
    };
  }

  if (input.manualPaymentFlow === 'settle_now') {
    return {
      paymentMethod: input.manualPaymentMethod,
      paymentStatus: 'pending' as const,
      status: 'draft' as const,
      deferActivation: true,
    };
  }

  return {
    paymentMethod: input.manualPaymentMethod,
    paymentStatus: 'unpaid' as const,
    status: 'draft' as const,
    deferActivation: true,
  };
}
