'use client';

import { goalPace } from '../../../lib/goals/goalPace';
import GoalPaceBadges from '../../shared/goals/GoalPaceBadges';
import GoalWidgetFrame from '../../shared/goals/GoalWidgetFrame';
import GoalChart from './GoalChart';

// Burn-up chart of a goal's progress over time.
export default function GoalChartWidget() {
  return (
    <GoalWidgetFrame className="goal-chart-widget">
      {(view) => (
        <>
          <GoalChart {...view} />
          <GoalPaceBadges pace={goalPace(view.goal, view.sources, view.today)} />
        </>
      )}
    </GoalWidgetFrame>
  );
}
