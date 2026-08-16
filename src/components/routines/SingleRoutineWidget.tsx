'use client';

import { Eye, EyeOff, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { RecurrenceValue, RoutineTask } from '../../lib/types';
import RoutineTaskModal from './RoutineTaskModal';
import RoutineTaskSection from './RoutineTaskSection';
import { useRoutineTasks } from './useRoutineTasks';

type SingleRoutineWidgetProps = {
  title: string;
  recurrence: RecurrenceValue;
};

type RoutineModalState = { mode: 'add' } | { mode: 'edit'; task: RoutineTask };

export default function SingleRoutineWidget({ title, recurrence }: SingleRoutineWidgetProps) {
  const { tasks, isLoading, updateTaskStage, updateSubtaskStage, updateTask, addTask } =
    useRoutineTasks();
  const [modalState, setModalState] = useState<RoutineModalState | null>(null);
  const [showCompleted, setShowCompleted] = useState(true);

  const sectionTasks = useMemo(
    () =>
      tasks.filter(
        (task) => task.recurrence === recurrence && (showCompleted || task.stage !== 2)
      ),
    [tasks, recurrence, showCompleted]
  );

  return (
    <>
      <aside className="routine-panel-shell">
        <div className="routine-panel">
          <div className="routine-panel-header">
            <h2>{title}</h2>

            <div className="routine-panel-actions">
              <button
                type="button"
                className="routine-show-toggle"
                onClick={() => setShowCompleted((current) => !current)}
                title={showCompleted ? 'Hide completed tasks' : 'Show completed tasks'}
                aria-label={showCompleted ? 'Hide completed tasks' : 'Show completed tasks'}
              >
                {showCompleted ? <Eye size={14} /> : <EyeOff size={14} />}
              </button>

              <button
                type="button"
                className="routine-add-button"
                onClick={() => setModalState({ mode: 'add' })}
                title="Add task"
                aria-label="Add task"
              >
                <Plus size={14} />
              </button>
            </div>
          </div>

          <div className="routine-sections">
            {!isLoading && (
              <RoutineTaskSection
                recurrence={recurrence}
                tasks={sectionTasks}
                onToggle={updateTaskStage}
                onToggleSubtask={updateSubtaskStage}
                onEdit={(task) => setModalState({ mode: 'edit', task })}
              />
            )}
          </div>
        </div>
      </aside>

      <RoutineTaskModal
        key={modalState ? (modalState.mode === 'edit' ? modalState.task.id : 'add') : 'idle'}
        isOpen={modalState !== null}
        task={modalState?.mode === 'edit' ? modalState.task : null}
        fixedRecurrence={recurrence}
        onClose={() => setModalState(null)}
        onSubmit={(task) => {
          if (modalState?.mode === 'edit') {
            updateTask(task);
          } else {
            addTask(task);
          }
          setModalState(null);
        }}
      />
    </>
  );
}
