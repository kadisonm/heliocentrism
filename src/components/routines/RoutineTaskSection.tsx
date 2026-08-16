import TaskItem from '../tasks/TaskItem';
import type { RecurrenceValue, RoutineTask } from '../../lib/types';

type RoutineTaskSectionProps = {
  recurrence: RecurrenceValue;
  tasks: RoutineTask[];
  onToggle: (id: string) => void;
  onToggleSubtask: (taskId: string, subtaskId: string) => void;
  onEdit: (task: RoutineTask) => void;
};

export default function RoutineTaskSection({
  recurrence,
  tasks,
  onToggle,
  onToggleSubtask,
  onEdit,
}: RoutineTaskSectionProps) {
  return (
    <div className="routine-section">
      <div className="routine-section__header">
        <h3>{recurrence}</h3>
      </div>

      <div className="routine-list">
        {tasks.length > 0 ? (
          tasks.map((task) => (
            <TaskItem
              key={task.id}
              task={task}
              onToggle={onToggle}
              onToggleSubtask={onToggleSubtask}
              onEdit={onEdit}
            />
          ))
        ) : (
          <p className="routine-empty">No {recurrence} tasks</p>
        )}
      </div>
    </div>
  );
}
