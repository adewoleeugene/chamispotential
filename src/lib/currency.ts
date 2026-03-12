export function formatCurrency(amount: number, symbol = 'Le') {
  const rounded = Number.isInteger(amount) ? amount : Number(amount.toFixed(2));
  return `${symbol} ${rounded.toLocaleString('en-SL', {
    minimumFractionDigits: Number.isInteger(rounded) ? 0 : 2,
    maximumFractionDigits: Number.isInteger(rounded) ? 0 : 2,
  })}`;
}

export const formatLeones = formatCurrency;
