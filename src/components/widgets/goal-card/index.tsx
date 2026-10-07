'use client';

import { goalPace } from '../../../lib/goals/goalPace';
import { goalCurrent, goalTarget, progressOf } from '../../../lib/goals/goalProgress';
import ProgressBar from '../../common/ProgressBar';
import { formatGoalAmount, formatGoalFraction, goalUnit } from '../../shared/goals/goalDisplay';
import GoalPaceBadges from '../../shared/goals/GoalPaceBadges';
import GoalQuickLog from '../../shared/goals/GoalQuickLog';
import GoalWidgetFrame, { type GoalViewProps } from '../../shared/goals/GoalWidgetFrame';

function GoalCard(view: GoalViewProps) {
  const { goal, sources, today } = view;
  const current = goalCurrent(goal, sources, today);
  const target = goalTarget(goal, sources);
  const progress = progressOf(goal, current, target);
  const pace = goalPace(goal, sources, today);
  // Rounded up to one decimal so the suggestion never undershoots.
  const perWeek = pace.requiredPerWeek !== null ? Math.ceil(pace.requiredPerWeek * 10) / 10 : null;

  return (
    <>
      <div className="goal-card__summary">
        <span className="goal-card__fraction">{formatGoalFraction(goal, sources, current, target)}</span>
        <span className="goal-card__percent">{Math.round(progress * 100)}%</span>
      </div>
      <ProgressBar progress={progress} color="var(--item-color)" marker={pace.expected} ariaLabel={`${goal.name} progress`} />
      <GoalPaceBadges pace={pace} />
      {perWeek !== null && perWeek > 0 && (
        <p className="goal-card__rate">~{formatGoalAmount(perWeek, goalUnit(goal, sources))} a week to finish on time</p>
      )}
      {goal.note && <p className="goal-card__note">{goal.note}</p>}
      <GoalQuickLog {...view} />
    </>
  );
}

// Progress bar summary with pace, required rate, and quick logging.
export default function GoalCardWidget() {
  return (
    <GoalWidgetFrame className="goal-card">
      {(view) => <GoalCard {...view} />}
    </GoalWidgetFrame>
  );
}
