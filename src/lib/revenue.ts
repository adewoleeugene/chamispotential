export function isRecognizedRevenueOrder(order: { status?: string | null; paymentStatus?: string | null }) {
  return order.status === 'completed' || order.paymentStatus === 'paid';
}

export function getRecognizedRevenueWhere<T extends Record<string, unknown>>(extraWhere: T) {
  return {
    ...extraWhere,
    status: extraWhere.status ?? { not: 'cancelled' },
    OR: [
      { paymentStatus: 'paid' },
      { status: 'completed' },
    ],
  };
}
