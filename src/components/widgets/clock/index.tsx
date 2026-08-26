'use client';

import { useEffect, useState } from 'react';

// h:mm AM/PM — no leading zero on the hour, minutes always two digits.
function formatClockTime(date: Date): string {
  const hours24 = date.getHours();
  const hours12 = hours24 % 12 || 12;
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const period = hours24 < 12 ? 'AM' : 'PM';
  return `${hours12}:${minutes} ${period}`;
}

export default function ClockWidget() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    // A plain setInterval drifts from the real clock — its cadence is
    // pinned to whenever the widget happened to mount, not to the actual
    // minute boundary. Re-scheduling against the ms remaining in the
    // current minute instead keeps the displayed minute changing right as
    // it rolls over.
    let timeoutId: ReturnType<typeof setTimeout>;
    const scheduleNextTick = () => {
      timeoutId = setTimeout(() => {
        setNow(new Date());
        scheduleNextTick();
      }, 60_000 - (Date.now() % 60_000));
    };
    scheduleNextTick();
    return () => clearTimeout(timeoutId);
  }, []);

  return (
    <div className="clock-widget">
      <time className="clock-widget-time" dateTime={now.toISOString()}>
        {formatClockTime(now)}
      </time>
    </div>
  );
}
