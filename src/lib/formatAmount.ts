// 10000 -> "10,000", 1.5 -> "1.5".
export function formatAmount(value: number): string {
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}
