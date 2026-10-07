'use client';

import { useEffect, useState } from 'react';

// The current time, refreshed on each `tickMs` boundary (e.g. every whole minute).
// Re-schedules against the boundary rather than a plain setInterval, which drifts from the real clock.
export function useNow(tickMs: number): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    const scheduleNextTick = () => {
      timeoutId = setTimeout(() => {
        setNow(new Date());
        scheduleNextTick();
      }, tickMs - (Date.now() % tickMs));
    };
    /* eslint-disable-next-line react-hooks/set-state-in-effect -- catch up immediately when the tick rate changes */
    setNow(new Date());
    scheduleNextTick();
    return () => clearTimeout(timeoutId);
  }, [tickMs]);

  return now;
}
