'use client';

import { useMemo, type ReactNode } from 'react';
import type { GoalSources } from '../../../lib/goals/goalProgress';
import type { Goal } from '../../../lib/types';
import CollectionWidgetFrame from '../collection-widget/CollectionWidgetFrame';
import { useToday } from '../hooks/useToday';
import GoalModal, { type MeasureType } from './GoalModal';
import { useGoals } from './useGoals';

export type GoalViewProps = {
  goal: Goal;
  sources: GoalSources;
  today: string;
};

type GoalWidgetFrameProps = {
  className: string;
  // Limits the switcher to goals of one type, and starts new goals on that type.
  onlyType?: MeasureType;
  // Renders the widget-specific view of the selected goal.
  children: (props: GoalViewProps) => ReactNode;
};

// CollectionWidgetFrame wired to the goals store.
export default function GoalWidgetFrame({ className, onlyType, children }: GoalWidgetFrameProps) {
  const { goals, isLoading, sources, createGoal, updateGoal, deleteGoal } = useGoals();
  const today = useToday();
  const items = useMemo(() => (onlyType ? goals.filter((goal) => goal.measure.type === onlyType) : goals), [goals, onlyType]);

  return (
    <CollectionWidgetFrame
      className={className}
      items={items}
      isLoading={isLoading}
      noun="goal"
      title="Goal"
      selectionKey="selectedGoalId"
      onDelete={(goal) => deleteGoal(goal.id)}
      deleteMessage={(goal) => `Delete "${goal.name}" and its progress? Linked habits and tasks are kept. This can't be undone.`}
      renderModal={({ state, close, select }) => (
        <GoalModal
          isOpen={state !== null}
          goal={state?.mode === 'edit' ? state.item : null}
          initialName={state?.mode === 'add' ? state.seedName : ''}
          initialType={onlyType}
          onClose={close}
          onSubmit={(draft) => {
            if (state?.mode === 'edit') updateGoal(state.item.id, draft);
            else select(createGoal(draft));
            close();
          }}
        />
      )}
    >
      {(goal) => children({ goal, sources, today })}
    </CollectionWidgetFrame>
  );
}
