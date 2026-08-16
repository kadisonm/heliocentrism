'use client';

import { Eye, EyeOff, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { RecurrenceValue, RoutineTask } from '../../lib/types';
import AddRoutineTaskModal from './AddRoutineTaskModal';
import RoutineTaskEditorPanel from './RoutineTaskEditorPanel';
import RoutineTaskSection from './RoutineTaskSection';
import { useRoutineTasks } from './useRoutineTasks';

type SingleRoutineWidgetProps = {
  title: string;
  recurrence: RecurrenceValue;
};

export default function SingleRoutineWidget({ title, recurrence }: SingleRoutineWidgetProps) {
  const { tasks, isLoading, updateTaskStage, updateSubtaskStage, updateTask, addTask } =
    useRoutineTasks();
  const [selectedTask, setSelectedTask] = useState<RoutineTask | null>(null);
  const [showCompleted, setShowCompleted] = useState(true);
  const [isAddTaskOpen, setIsAddTaskOpen] = useState(false);

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
                onClick={() => setIsAddTaskOpen(true)}
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
                onEdit={setSelectedTask}
              />
            )}
          </div>
        </div>
      </aside>

      <RoutineTaskEditorPanel
        key={selectedTask?.id ?? 'no-selection'}
        task={selectedTask}
        onClose={() => setSelectedTask(null)}
        onSave={(task) => {
          updateTask(task);
          setSelectedTask(null);
        }}
      />

      <AddRoutineTaskModal
        isOpen={isAddTaskOpen}
        onClose={() => setIsAddTaskOpen(false)}
        onAdd={addTask}
        fixedRecurrence={recurrence}
      />
    </>
  );
}
