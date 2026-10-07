'use client';

import { Plus } from 'lucide-react';
import { useState, type CSSProperties, type ReactNode } from 'react';
import type { Habit } from '../../../lib/types';
import ConfirmDialog from '../../common/ConfirmDialog';
import SearchableSwitcher from '../../common/SearchableSwitcher';
import { useWidgetContext } from '../../grid/widgetContext';
import HabitColorDot from './HabitColorDot';
import { habitColorVar } from './habitDisplay';
import HabitModal from './HabitModal';
import { useHabits } from './useHabits';
import { useToday } from './useToday';

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

type HabitModalState = { mode: 'add'; seedName: string } | { mode: 'edit'; habit: Habit };

// Shared shell for every habit widget: habit switcher, create/edit/delete flows, and empty state.
// Exposes the habit's colour as --habit-color so each view can tint itself.
export default function HabitWidgetFrame({ className, children }: HabitWidgetFrameProps) {
  const { habits, isLoading, createHabit, updateHabit, deleteHabit, setHabitValue } = useHabits();
  const { widget, onUpdate } = useWidgetContext();
  const today = useToday();
  const [modalState, setModalState] = useState<HabitModalState | null>(null);
  const [habitPendingDelete, setHabitPendingDelete] = useState<Habit | null>(null);

  const activeHabit = habits.find((habit) => habit.id === widget.selectedHabitId) ?? habits[0] ?? null;
  const colorStyle = activeHabit ? ({ '--habit-color': habitColorVar(activeHabit.color) } as CSSProperties) : undefined;

  return (
    <>
      <aside className="widget-content-shell">
        <div className={`widget-content habit-widget-frame ${className}`} style={colorStyle}>
          <div className="widget-content-header">
            {habits.length > 0 ? (
              <SearchableSwitcher
                items={habits}
                activeItem={activeHabit}
                noun="habit"
                renderPrefix={(habit) => <HabitColorDot color={habit.color} />}
                onSelect={(id) => onUpdate({ selectedHabitId: id })}
                onRequestDelete={setHabitPendingDelete}
                onRequestCreate={(name) => setModalState({ mode: 'add', seedName: name })}
                onRequestEdit={(habit) => setModalState({ mode: 'edit', habit })}
              />
            ) : (
              <h2>Habit</h2>
            )}
          </div>

          {!isLoading &&
            (activeHabit ? (
              <div className="habit-widget-frame__body">
                {children({
                  habit: activeHabit,
                  today,
                  setTodayValue: (value) => setHabitValue(activeHabit.id, today, value),
                })}
              </div>
            ) : (
              <div className="widget-empty-row">
                <p className="widget-empty">No habits yet</p>
                <button
                  type="button"
                  className="widget-add-button"
                  onClick={() => setModalState({ mode: 'add', seedName: '' })}
                  title="Create habit"
                  aria-label="Create habit"
                >
                  <Plus size={14} />
                </button>
              </div>
            ))}
        </div>
      </aside>

      <HabitModal
        key={`habit-${modalState ? (modalState.mode === 'edit' ? modalState.habit.id : `add-${modalState.seedName}`) : 'idle'}`}
        isOpen={modalState !== null}
        habit={modalState?.mode === 'edit' ? modalState.habit : null}
        initialName={modalState?.mode === 'add' ? modalState.seedName : ''}
        onClose={() => setModalState(null)}
        onSubmit={(draft) => {
          if (modalState?.mode === 'edit') updateHabit(modalState.habit.id, draft, today);
          else onUpdate({ selectedHabitId: createHabit(draft) });
          setModalState(null);
        }}
      />

      <ConfirmDialog
        isOpen={habitPendingDelete !== null}
        title="Delete habit?"
        message={`Delete "${habitPendingDelete?.name}" and its entire history? This can't be undone.`}
        confirmLabel="Delete"
        danger
        onConfirm={() => {
          if (habitPendingDelete) deleteHabit(habitPendingDelete.id);
          setHabitPendingDelete(null);
        }}
        onCancel={() => setHabitPendingDelete(null)}
      />
    </>
  );
}
