// Matches the clock's original fixed format, so existing widgets look unchanged.
export const DEFAULT_CLOCK_FORMAT = 'h:mm A';

export const CLOCK_FORMAT_PRESETS: { value: string; label: string }[] = [
  { value: 'h:mm A', label: '9:05 AM' },
  { value: 'HH:mm', label: '09:05' },
  { value: 'HH:mm:ss', label: '09:05:03' },
  { value: 'h:mm A\ndddd, D MMMM', label: 'Time + date' },
  { value: 'HH:mm:ss\nDD/MM/YYYY', label: 'Time + numeric date' },
  { value: 'ddd D MMM', label: 'Date only' },
];
