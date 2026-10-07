'use client';

import { DEFAULT_CLOCK_FORMAT } from '../../../lib/clock/clockPresets';
import { formatDateTime, formatShowsSeconds } from '../../../lib/clock/dateTimeFormat';
import { useWidgetContext } from '../../grid/widgetContext';
import { useNow } from '../../shared/hooks/useNow';

export default function ClockWidget() {
  const { widget } = useWidgetContext();
  const format = widget.clock?.format || DEFAULT_CLOCK_FORMAT;
  const now = useNow(formatShowsSeconds(format) ? 1000 : 60_000);
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
