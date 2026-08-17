import SortableTaskList from '../../shared/tasks/SortableTaskList';
import TaskItem, { TaskItemView } from '../../shared/tasks/TaskItem';
import type { RecurrenceValue, RoutineTask } from '../../../lib/types';

type RoutineTaskSectionProps = {
  recurrence: RecurrenceValue;
  tasks: RoutineTask[];
  onToggle: (id: string) => void;
  onToggleSubtask: (taskId: string, subtaskId: string) => void;
  onEdit: (task: RoutineTask) => void;
  onReorder: (activeId: string, overId: string) => void;
  onReorderSubtasks: (taskId: string, activeId: string, overId: string) => void;
};

export default function RoutineTaskSection({
  recurrence,
  tasks,
  onToggle,
  onToggleSubtask,
  onEdit,
  onReorder,
  onReorderSubtasks,
}: RoutineTaskSectionProps) {
  return (
    <div className="routine-todo-section">
      <div className="routine-todo-section__header">
        <h3>{recurrence}</h3>
      </div>

      {tasks.length > 0 ? (
        <SortableTaskList
          ids={tasks.map((task) => task.id)}
          onReorder={onReorder}
          renderOverlay={(activeId) => {
            const task = tasks.find((t) => t.id === activeId);
            return task ? (
              <TaskItemView
                task={task}
                onToggle={onToggle}
                onEdit={onEdit}
                onToggleSubtask={onToggleSubtask}
                onReorderSubtasks={onReorderSubtasks}
                overlay
              />
            ) : null;
          }}
        >
          <div className="widget-list">
            {tasks.map((task) => (
              <TaskItem
                key={task.id}
                task={task}
                onToggle={onToggle}
                onToggleSubtask={onToggleSubtask}
                onEdit={onEdit}
                onReorderSubtasks={onReorderSubtasks}
              />
            ))}
          </div>
        </SortableTaskList>
      ) : (
        <div className="widget-list">
          <p className="widget-empty">No {recurrence} tasks</p>
        </div>
      )}
    </div>
  );
}
