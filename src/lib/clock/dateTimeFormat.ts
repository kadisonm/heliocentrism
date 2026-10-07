// Token-based date/time formatting, e.g. "HH:mm:ss\nDD/MM/YYYY".
// Tokens are case-sensitive (MM = month, mm = minutes); text in [brackets] is printed as-is.

const pad = (value: number) => String(value).padStart(2, '0');
const hours12 = (date: Date) => date.getHours() % 12 || 12;
const localeName = (date: Date, options: Intl.DateTimeFormatOptions) => date.toLocaleString(undefined, options);

type TokenDef = { token: string; description: string; format: (date: Date) => string };

// Longest variants first so e.g. "YYYY" isn't read as two "YY"s.
export const DATE_TIME_TOKENS: TokenDef[] = [
  { token: 'YYYY', description: 'Year', format: (d) => String(d.getFullYear()) },
  { token: 'YY', description: 'Year, 2-digit', format: (d) => pad(d.getFullYear() % 100) },
  { token: 'MMMM', description: 'Month name', format: (d) => localeName(d, { month: 'long' }) },
  { token: 'MMM', description: 'Month, short', format: (d) => localeName(d, { month: 'short' }) },
  { token: 'MM', description: 'Month, 2-digit', format: (d) => pad(d.getMonth() + 1) },
  { token: 'M', description: 'Month', format: (d) => String(d.getMonth() + 1) },
  { token: 'DD', description: 'Day, 2-digit', format: (d) => pad(d.getDate()) },
  { token: 'D', description: 'Day', format: (d) => String(d.getDate()) },
  { token: 'dddd', description: 'Weekday', format: (d) => localeName(d, { weekday: 'long' }) },
  { token: 'ddd', description: 'Weekday, short', format: (d) => localeName(d, { weekday: 'short' }) },
  { token: 'HH', description: 'Hour 0–23, 2-digit', format: (d) => pad(d.getHours()) },
  { token: 'H', description: 'Hour 0–23', format: (d) => String(d.getHours()) },
  { token: 'hh', description: 'Hour 1–12, 2-digit', format: (d) => pad(hours12(d)) },
  { token: 'h', description: 'Hour 1–12', format: (d) => String(hours12(d)) },
  { token: 'mm', description: 'Minute, 2-digit', format: (d) => pad(d.getMinutes()) },
  { token: 'm', description: 'Minute', format: (d) => String(d.getMinutes()) },
  { token: 'ss', description: 'Second, 2-digit', format: (d) => pad(d.getSeconds()) },
  { token: 's', description: 'Second', format: (d) => String(d.getSeconds()) },
  { token: 'A', description: 'AM / PM', format: (d) => (d.getHours() < 12 ? 'AM' : 'PM') },
  { token: 'a', description: 'am / pm', format: (d) => (d.getHours() < 12 ? 'am' : 'pm') },
];

const TOKEN_BY_NAME = new Map(DATE_TIME_TOKENS.map((def) => [def.token, def]));
const TOKEN_PATTERN = new RegExp(`\\[([^\\]]*)\\]|${DATE_TIME_TOKENS.map((def) => def.token).join('|')}`, 'g');

export function formatDateTime(date: Date, format: string): string {
  return format.replace(TOKEN_PATTERN, (match, literal: string | undefined) =>
    literal ?? TOKEN_BY_NAME.get(match)!.format(date)
  );
}

// Whether the output changes every second — lets the clock tick per minute when it doesn't.
export function formatShowsSeconds(format: string): boolean {
  return /s/.test(format.replace(/\[[^\]]*\]/g, ''));
}
