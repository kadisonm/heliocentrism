'use client';

import { Eye, EyeOff, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { RecurrenceValue, RoutineTask } from '../../../lib/types';
import RoutineTaskModal from '../../routines/RoutineTaskModal';
import RoutineTaskSection from '../../routines/RoutineTaskSection';
import { useRoutineTasks } from '../../routines/useRoutineTasks';

const recurrenceOrder: RecurrenceValue[] = ['daily', 'weekly', 'monthly'];

type RoutineModalState = { mode: 'add' } | { mode: 'edit'; task: RoutineTask };

export default function RoutinesWidget() {
  const { tasks, isLoading, updateTaskStage, updateSubtaskStage, updateTask, addTask } =
    useRoutineTasks();
  const [modalState, setModalState] = useState<RoutineModalState | null>(null);
  const [showCompleted, setShowCompleted] = useState(true);

  const visibleTasks = useMemo(
    () => (showCompleted ? tasks : tasks.filter((task) => task.stage !== 2)),
    [showCompleted, tasks]
  );

  const groupedTasks = useMemo(
    () =>
      recurrenceOrder.reduce(
        (acc, key) => {
          acc[key] = visibleTasks.filter((task) => task.recurrence === key);
          return acc;
        },
        { daily: [], weekly: [], monthly: [] } as Record<RecurrenceValue, RoutineTask[]>
      ),
    [visibleTasks]
  );

  return (
    <>
      <aside className="routine-panel-shell">
        <div className="routine-panel">
          <div className="routine-panel-header">
            <h2>Routines</h2>

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
            {!isLoading &&
              recurrenceOrder.map((recurrence) => (
                <RoutineTaskSection
                  key={recurrence}
                  recurrence={recurrence}
                  tasks={groupedTasks[recurrence]}
                  onToggle={updateTaskStage}
                  onToggleSubtask={updateSubtaskStage}
                  onEdit={(task) => setModalState({ mode: 'edit', task })}
                />
              ))}
          </div>
        </div>
      </aside>

      <RoutineTaskModal
        key={modalState ? (modalState.mode === 'edit' ? modalState.task.id : 'add') : 'idle'}
        isOpen={modalState !== null}
        task={modalState?.mode === 'edit' ? modalState.task : null}
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
