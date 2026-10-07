'use client';

import type { ReactNode } from 'react';
import type { Habit } from '../../../lib/types';
import CollectionWidgetFrame from '../collection-widget/CollectionWidgetFrame';
import { useToday } from '../hooks/useToday';
import HabitModal from './HabitModal';
import { useHabits } from './useHabits';

export type HabitViewProps = {
  habit: Habit;
  today: string;
  setTodayValue: (value: number) => void;
};

type HabitWidgetFrameProps = {
  className: string;
  // Renders the widget-specific view of the selected habit.
  children: (props: HabitViewProps) => ReactNode;
};

// CollectionWidgetFrame wired to the habits store.
export default function HabitWidgetFrame({ className, children }: HabitWidgetFrameProps) {
  const { habits, isLoading, createHabit, updateHabit, deleteHabit, setHabitValue } = useHabits();
  const today = useToday();

  return (
    <CollectionWidgetFrame
      className={className}
      items={habits}
      isLoading={isLoading}
      noun="habit"
      title="Habit"
      selectionKey="selectedHabitId"
      onDelete={(habit) => deleteHabit(habit.id)}
      deleteMessage={(habit) => `Delete "${habit.name}" and its entire history? This can't be undone.`}
      renderModal={({ state, close, select }) => (
        <HabitModal
          isOpen={state !== null}
          habit={state?.mode === 'edit' ? state.item : null}
          initialName={state?.mode === 'add' ? state.seedName : ''}
          onClose={close}
          onSubmit={(draft) => {
            if (state?.mode === 'edit') updateHabit(state.item.id, draft, today);
            else select(createHabit(draft));
            close();
          }}
        />
      )}
    >
      {(habit) => children({ habit, today, setTodayValue: (value) => setHabitValue(habit.id, today, value) })}
    </CollectionWidgetFrame>
  );
}
