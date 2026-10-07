'use client';

import { useEffect, useState } from 'react';
import { toDateKey } from '../../../lib/dateKey';

// Today's local date key, rolling over at midnight and on returning to a backgrounded tab.
export function useToday(): string {
  const [today, setToday] = useState(() => toDateKey(new Date()));

  useEffect(() => {
    const sync = () => setToday(toDateKey(new Date()));
    let timeoutId: ReturnType<typeof setTimeout>;
    const scheduleMidnight = () => {
      const now = new Date();
      const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      timeoutId = setTimeout(() => {
        sync();
        scheduleMidnight();
      }, nextMidnight.getTime() - now.getTime() + 1000);
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') sync();
    };

    scheduleMidnight();
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  return today;
}
