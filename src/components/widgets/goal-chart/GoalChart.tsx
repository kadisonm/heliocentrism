'use client';

import { useState, type PointerEvent } from 'react';
import { addDaysToKey, daysBetweenKeys, parseDateKey } from '../../../lib/dateKey';
import { goalSeries, goalStartValue, goalTarget } from '../../../lib/goals/goalProgress';
import { formatGoalAmount, goalUnit } from '../../shared/goals/goalDisplay';
import type { GoalViewProps } from '../../shared/goals/GoalWidgetFrame';
import { useElementSize } from '../../shared/hooks/useElementSize';

// Room for the target label above the plot and date labels below it.
const PAD = { top: 18, right: 6, bottom: 18, left: 6 };
const DOT_RADIUS = 4;

const formatDay = (key: string) => parseDateKey(key).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

// Burn-up chart: actual progress over time against an even pace to the deadline and the target line.
export default function GoalChart({ goal, sources, today }: GoalViewProps) {
  const [containerRef, { width, height }] = useElementSize<HTMLDivElement>();
  const [hoverKey, setHoverKey] = useState<string | null>(null);

  const series = goalSeries(goal, sources, today);
  const start = goalStartValue(goal);
  const target = goalTarget(goal, sources);
  const unit = goalUnit(goal, sources);

  if (series.length === 0) {
    return (
      <div className="goal-chart" ref={containerRef}>
        <p className="widget-empty">This goal starts on {formatDay(goal.startDate)}.</p>
      </div>
    );
  }

  // X runs from the start date to the deadline (or today, whichever is later); Y spans start, target and every value.
  const endKey = goal.deadline && goal.deadline > today ? goal.deadline : today;
  const totalDays = Math.max(daysBetweenKeys(goal.startDate, endKey), 1);
  const values = [start, target, ...series.map((point) => point.value)];
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const valueSpan = maxValue - minValue || 1;

  const innerWidth = Math.max(width - PAD.left - PAD.right, 1);
  const innerHeight = Math.max(height - PAD.top - PAD.bottom, 1);
  const x = (key: string) => PAD.left + (daysBetweenKeys(goal.startDate, key) / totalDays) * innerWidth;
  const y = (value: number) => PAD.top + (1 - (value - minValue) / valueSpan) * innerHeight;

  // Straight line from the start value to the target on the deadline.
  const paceAt = (key: string) =>
    goal.deadline ? start + (target - start) * Math.min(daysBetweenKeys(goal.startDate, key) / Math.max(daysBetweenKeys(goal.startDate, goal.deadline), 1), 1) : null;

  const linePath = series.map((point, i) => `${i === 0 ? 'M' : 'L'}${x(point.date)},${y(point.value)}`).join(' ');
  const baselineY = y(minValue);
  const areaPath = `${linePath} L${x(series.at(-1)!.date)},${baselineY} L${x(series[0].date)},${baselineY} Z`;
  const last = series.at(-1)!;

  // Crosshair snaps to the nearest day anywhere on the x range.
  const handlePointerMove = (event: PointerEvent<SVGSVGElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientX - bounds.left - PAD.left) / innerWidth;
    const day = Math.min(Math.max(Math.round(ratio * totalDays), 0), totalDays);
    setHoverKey(addDaysToKey(goal.startDate, day));
  };

  const hoverPoint = hoverKey ? series.find((point) => point.date === hoverKey) : undefined;
  const hoverPace = hoverKey ? paceAt(hoverKey) : null;
  const hoverX = hoverKey ? x(hoverKey) : 0;
  const tooltipOnLeft = hoverX > width / 2;

  return (
    <div className="goal-chart" ref={containerRef}>
      {width > 0 && height > 0 && (
        <svg
          className="goal-chart__svg"
          width={width}
          height={height}
          role="img"
          aria-label={`${goal.name}: ${formatGoalAmount(last.value, unit)} of ${formatGoalAmount(target, unit)} so far`}
          onPointerMove={handlePointerMove}
          onPointerLeave={() => setHoverKey(null)}
        >
          <line className="goal-chart__grid" x1={PAD.left} x2={width - PAD.right} y1={baselineY} y2={baselineY} />
          <line className="goal-chart__target" x1={PAD.left} x2={width - PAD.right} y1={y(target)} y2={y(target)} />
          {goal.deadline && (
            <line
              className="goal-chart__pace"
              x1={x(goal.startDate)}
              y1={y(start)}
              x2={x(goal.deadline)}
              y2={y(target)}
            />
          )}
          <path className="goal-chart__area" d={areaPath} />
          <path className="goal-chart__line" d={linePath} />
          <circle className="goal-chart__dot" cx={x(last.date)} cy={y(last.value)} r={DOT_RADIUS} />
          {hoverKey && <line className="goal-chart__crosshair" x1={hoverX} x2={hoverX} y1={PAD.top} y2={height - PAD.bottom} />}

          <text className="goal-chart__label" x={width - PAD.right} y={y(target) - 5} textAnchor="end">
            Target {formatGoalAmount(target, unit)}
          </text>
          <text className="goal-chart__label" x={PAD.left} y={height - 4}>
            {formatDay(goal.startDate)}
          </text>
          <text className="goal-chart__label" x={width - PAD.right} y={height - 4} textAnchor="end">
            {goal.deadline ? `Due ${formatDay(goal.deadline)}` : 'Today'}
          </text>
        </svg>
      )}

      {hoverKey && (
        <div
          className="goal-chart__tooltip"
          style={tooltipOnLeft ? { right: width - hoverX + 8 } : { left: hoverX + 8 }}
          aria-hidden
        >
          <div className="goal-chart__tooltip-date">{formatDay(hoverKey)}</div>
          {hoverPoint && (
            <div className="goal-chart__tooltip-row">
              <span className="goal-chart__key goal-chart__key--actual" />
              {formatGoalAmount(hoverPoint.value, unit)}
            </div>
          )}
          {hoverPace !== null && (
            <div className="goal-chart__tooltip-row">
              <span className="goal-chart__key goal-chart__key--pace" />
              Even pace {formatGoalAmount(Math.round(hoverPace * 10) / 10, unit)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
