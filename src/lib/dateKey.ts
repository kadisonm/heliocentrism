// Local-calendar 'YYYY-MM-DD' keys — sort and compare correctly as plain strings.

export function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function parseDateKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
}

// Whole calendar days from `from` to `to` (negative if `to` is earlier), immune to DST shifts.
export function daysBetween(from: Date, to: Date): number {
  const fromUTC = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const toUTC = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((toUTC - fromUTC) / 86_400_000);
}

export function daysBetweenKeys(from: string, to: string): number {
  return daysBetween(parseDateKey(from), parseDateKey(to));
}

// Calendar-day arithmetic via Date's own overflow handling, so DST shifts can't skip a day.
export function addDaysToKey(key: string, days: number): string {
  const date = parseDateKey(key);
  date.setDate(date.getDate() + days);
  return toDateKey(date);
}
