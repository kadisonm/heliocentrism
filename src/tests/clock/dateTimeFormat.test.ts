import { formatDateTime, formatShowsSeconds } from '../../lib/clock/dateTimeFormat';

// Tue 7 Oct 2026, 09:05:03 local time.
const DATE = new Date(2026, 9, 7, 9, 5, 3);

describe('formatDateTime', () => {
  it('formats numeric time and date tokens', () => {
    expect(formatDateTime(DATE, 'HH:mm:ss DD/MM/YYYY')).toBe('09:05:03 07/10/2026');
    expect(formatDateTime(DATE, 'H:m:s D/M/YY')).toBe('9:5:3 7/10/26');
  });

  it('handles 12-hour clocks', () => {
    expect(formatDateTime(DATE, 'h:mm A')).toBe('9:05 AM');
    expect(formatDateTime(new Date(2026, 0, 1, 0, 0), 'hh:mm a')).toBe('12:00 am');
    expect(formatDateTime(new Date(2026, 0, 1, 15, 0), 'h a')).toBe('3 pm');
  });

  it('keeps line breaks and bracketed literals', () => {
    expect(formatDateTime(DATE, 'HH:mm\n[Day] D')).toBe('09:05\nDay 7');
  });
});

describe('formatShowsSeconds', () => {
  it('ignores an "s" inside literal text', () => {
    expect(formatShowsSeconds('HH:mm:ss')).toBe(true);
    expect(formatShowsSeconds('HH:mm [secs]')).toBe(false);
  });
});
