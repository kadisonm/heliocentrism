'use client';

import { Check } from 'lucide-react';
import { goalPace } from '../../../lib/goals/goalPace';
import { goalProgress } from '../../../lib/goals/goalProgress';
import ProgressBar from '../../common/ProgressBar';
import GoalPaceBadges from '../../shared/goals/GoalPaceBadges';
import GoalWidgetFrame, { type GoalViewProps } from '../../shared/goals/GoalWidgetFrame';
import { useGoals } from '../../shared/goals/useGoals';

function MilestoneList({ goal, sources, today }: GoalViewProps) {
  const { toggleMilestone } = useGoals();
  if (goal.measure.type !== 'milestones') return null;
  const { milestones } = goal.measure;
  const doneCount = milestones.filter((m) => m.completedAt).length;

  return (
    <>
      <div className="goal-milestones__summary">
        <span>
          {doneCount} of {milestones.length} steps
        </span>
        <GoalPaceBadges pace={goalPace(goal, sources, today)} />
      </div>
      <ProgressBar progress={goalProgress(goal, sources, today)} color="var(--item-color)" ariaLabel={`${goal.name} progress`} />
      <ul className="goal-milestones__list">
        {milestones.map((milestone) => {
          const done = milestone.completedAt !== null;
          return (
            <li key={milestone.id}>
              <button
                type="button"
                role="checkbox"
                aria-checked={done}
                className={done ? 'goal-milestones__step goal-milestones__step--done' : 'goal-milestones__step'}
                onClick={() => toggleMilestone(goal.id, milestone.id)}
              >
                <span className="goal-milestones__box">{done && <Check size={12} strokeWidth={3} />}</span>
                <span className="goal-milestones__title">{milestone.title}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}

// A step-based goal's checklist; only lists goals measured by steps.
export default function GoalMilestonesWidget() {
  return (
    <GoalWidgetFrame className="goal-milestones" onlyType="milestones">
      {(view) => <MilestoneList {...view} />}
    </GoalWidgetFrame>
  );
}
