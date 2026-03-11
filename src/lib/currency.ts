export function formatLeones(amount: number) {
  const rounded = Number.isInteger(amount) ? amount : Number(amount.toFixed(2));
  return `Le ${rounded.toLocaleString('en-SL', {
    minimumFractionDigits: Number.isInteger(rounded) ? 0 : 2,
    maximumFractionDigits: Number.isInteger(rounded) ? 0 : 2,
  })}`;
}
