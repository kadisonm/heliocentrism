'use client';

import { goalPace } from '../../../lib/goals/goalPace';
import { goalCurrent, goalTarget, progressOf } from '../../../lib/goals/goalProgress';
import ProgressRing from '../../common/ProgressRing';
import { formatGoalFraction } from '../../shared/goals/goalDisplay';
import GoalPaceBadges from '../../shared/goals/GoalPaceBadges';
import GoalWidgetFrame, { type GoalViewProps } from '../../shared/goals/GoalWidgetFrame';

function GoalRing({ goal, sources, today }: GoalViewProps) {
  const current = goalCurrent(goal, sources, today);
  const target = goalTarget(goal, sources);
  const progress = progressOf(goal, current, target);

  return (
    <>
      <div className="goal-ring__ring">
        <ProgressRing progress={progress} color="var(--item-color)" ariaLabel={`${goal.name} progress`}>
          <span className="goal-ring__percent">{Math.round(progress * 100)}%</span>
          <span className="goal-ring__caption">{formatGoalFraction(goal, sources, current, target)}</span>
        </ProgressRing>
      </div>
      <GoalPaceBadges pace={goalPace(goal, sources, today)} />
    </>
  );
}

// Overall goal progress as a completion wheel.
export default function GoalRingWidget() {
  return (
    <GoalWidgetFrame className="goal-ring">
      {(view) => <GoalRing {...view} />}
    </GoalWidgetFrame>
  );
}
