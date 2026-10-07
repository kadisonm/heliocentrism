'use client';

import { useEffect, useState } from 'react';
import { DEFAULT_CLOCK_FORMAT } from '../../../lib/clock/clockPresets';
import { formatDateTime, formatShowsSeconds } from '../../../lib/clock/dateTimeFormat';
import { useWidgetContext } from '../../grid/widgetContext';

export default function ClockWidget() {
  const { widget } = useWidgetContext();
  const format = widget.clock?.format || DEFAULT_CLOCK_FORMAT;
  const tickMs = formatShowsSeconds(format) ? 1000 : 60_000;
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    // Re-schedules against the next second/minute boundary rather than a
    // plain setInterval, which drifts from the real clock over time.
    let timeoutId: ReturnType<typeof setTimeout>;
    const scheduleNextTick = () => {
      timeoutId = setTimeout(() => {
        setNow(new Date());
        scheduleNextTick();
      }, tickMs - (Date.now() % tickMs));
    };
    /* eslint-disable-next-line react-hooks/set-state-in-effect -- catch up immediately when the format changes */
    setNow(new Date());
    scheduleNextTick();
    return () => clearTimeout(timeoutId);
  }, [tickMs]);

  const lines = formatDateTime(now, format).split('\n');

  return (
    <div className="clock-widget">
      <time className="clock-widget-time" dateTime={now.toISOString()}>
        {/* First line is the headline; any further lines render smaller beneath it. */}
        {lines.map((line, index) => (
          <span key={index} className={index === 0 ? 'clock-widget-line clock-widget-line--primary' : 'clock-widget-line'}>
            {line || ' '}
          </span>
        ))}
      </time>
    </div>
  );
}
