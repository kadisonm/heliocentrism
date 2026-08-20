function daysBetween(from: Date, to: Date): number {
  const fromUTC = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const toUTC = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((toUTC - fromUTC) / 86_400_000);
}

function formatTimeOfDay(date: Date): string {
  const hours24 = date.getHours();
  const minutes = date.getMinutes();
  const period = hours24 < 12 ? 'am' : 'pm';
  const hours12 = hours24 % 12 || 12;
  const minutePart = minutes === 0 ? '' : `:${String(minutes).padStart(2, '0')}`;
  return `${hours12}${minutePart} ${period}`;
}

// Relative day/time label for a date near `now` — "Yesterday"/"Today"/
// "Tomorrow"/"In N days" out to a week, then falls back to an absolute
// short date (day-month order, independent of locale, to match "19 Sep"
// rather than a locale-dependent "Sep 19"). Shared by the due-date and
// repeat badges so both read the same way.
export function formatRelativeDateTime(date: Date, now: Date = new Date()): string {
  const time = formatTimeOfDay(date);
  const dayDiff = daysBetween(now, date);

  if (dayDiff === -1) return `Yesterday, ${time}`;
  if (dayDiff === 0) return `Today, ${time}`;
  if (dayDiff === 1) return `Tomorrow, ${time}`;
  if (dayDiff >= 2 && dayDiff <= 7) return `In ${dayDiff} days, ${time}`;

  const month = date.toLocaleString(undefined, { month: 'short' });
  return `${date.getDate()} ${month}, ${time}`;
}
