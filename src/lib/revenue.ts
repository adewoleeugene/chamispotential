export function isRecognizedRevenueOrder(order: { status?: string | null; paymentStatus?: string | null }) {
  return order.paymentStatus === 'paid';
}

export function getRecognizedRevenueWhere<T extends Record<string, unknown>>(extraWhere: T) {
  return {
    ...extraWhere,
    status: extraWhere.status ?? { not: 'cancelled' },
    paymentStatus: 'paid',
  };
}
