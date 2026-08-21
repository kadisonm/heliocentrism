import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Pilcrow } from 'lucide-react';
import { createElement, useEffect, useRef, useState } from 'react';
import type { CSSProperties, HTMLAttributes, MouseEvent, ReactNode } from 'react';
import { getNextStageIndex, isTaskDone } from '../../../lib/taskCascade';
import { getTaskStageIcon } from '../../../lib/taskStageIcons';
import type { Subtask, Task, TaskStageDef } from '../../../lib/types';
import Badge from '../../common/Badge';
import type { FloatingToolbarPosition } from './FloatingToolbar';
import SortableTaskList from './SortableTaskList';

// Click-to-edit text used for both task/subtask title and description —
// `value`'s own display className is passed in (already carrying e.g.
// `is-done`) so the trigger/input inherit it, rather than this component
// owning any title/description-specific styling itself. Always edits via
// a <textarea> (not <input>), for two reasons: it can actually show
// wrapped multi-line text while typing (unlike an <input>, which never
// wraps regardless of width), and Shift+Enter needs somewhere to put a
// real newline character, which a single-line <input> can't hold at all.
type InlineEditableFieldProps = {
  value: string;
  // Shown (in place of an empty value) when not editing; also what makes
  // an empty field clickable to start editing at all, since a genuinely
  // empty <button> would have nothing to click on.
  placeholder?: string;
  className: string;
  ariaLabel: string;
  // Title can't be blanked (there's nothing sensible to fall back to
  // mid-list); description can, since that's exactly what brings the
  // placeholder back.
  allowEmpty?: boolean;
  // Description-only: the Pilcrow icon shown before the placeholder.
  // Only ever appears alongside the placeholder itself (empty value, not
  // editing) — never once there's real content, and never while editing
  // (see the isPlaceholder check below, which the editing branch doesn't
  // have access to at all).
  showPlaceholderIcon?: boolean;
  onCommit: (value: string) => void;
};

function InlineEditableField({
  value,
  placeholder,
  className,
  ariaLabel,
  allowEmpty = false,
  showPlaceholderIcon = false,
  onCommit,
}: InlineEditableFieldProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const commit = () => {
    setIsEditing(false);
    const trimmed = draft.trim();
    if (!trimmed && !allowEmpty) return; // silently keep the old value rather than blank it
    if (trimmed !== value) onCommit(trimmed);
  };

  // A <textarea> never resizes itself — this re-measures its content
  // height (collapsing to 'auto' first so shrinking a line back out
  // actually registers, not just growth) on every keystroke and right
  // when edit mode opens, so all of the text is visible while typing
  // instead of scrolling inside a fixed one-line box.
  useEffect(() => {
    if (!isEditing) return;
    const node = textareaRef.current;
    if (!node) return;
    node.style.height = 'auto';
    node.style.height = `${node.scrollHeight}px`;
  }, [isEditing, draft]);

  if (isEditing) {
    return (
      <textarea
        ref={textareaRef}
        className={`${className} task-item__editable-input`}
        value={draft}
        aria-label={ariaLabel}
        rows={1}
        autoFocus
        onFocus={(event) => event.target.select()}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            commit();
          } else if (event.key === 'Escape') {
            event.preventDefault();
            setDraft(value);
            setIsEditing(false);
          }
          // Shift+Enter falls through to the textarea's own default
          // behavior and inserts a real newline.
        }}
      />
    );
  }

  const isPlaceholder = !value && placeholder !== undefined;
  const showIcon = isPlaceholder && showPlaceholderIcon;

  const trigger = (
    <button
      type="button"
      className={`${className} task-item__editable-trigger ${isPlaceholder ? 'task-item__editable-trigger--placeholder' : ''} ${showIcon ? 'task-item__editable-trigger--with-icon' : ''}`}
      onClick={(event) => {
        event.stopPropagation();
        setDraft(value);
        setIsEditing(true);
      }}
    >
      {/* Part of the button itself (not a separate sibling) so clicking
          the icon starts editing too, same as clicking the text does. */}
      {showIcon && <Pilcrow size={12} className="task-item__description-icon" />}
      {isPlaceholder ? placeholder : value}
    </button>
  );

  if (!showIcon) return trigger;

  // Appears and disappears together with the rest of the trigger, using
  // the same grid-template-rows height-collapse the due/repeat ghost
  // badges use (see .task-item__hover-reveal) — nothing here the rest of
  // the time, rather than reserving space for a placeholder that isn't
  // shown.
  return (
    <div className="task-item__description-reveal">
      <div className="task-item__description-reveal-inner">{trigger}</div>
    </div>
  );
}

function stageAriaLabel(stageDef: TaskStageDef, index: number): string {
  return stageDef.name || `stage ${index + 1}`;
}

function isBlankStage(stageDef: TaskStageDef): boolean {
  return stageDef.name === '' && stageDef.color === 'none' && !stageDef.icon;
}

// Purely presentational classification (drives CSS only) — kept local
// rather than in taskCascade.ts, unlike isTaskDone/the cascade functions,
// which non-UI modules also consume.
function getStagePosition(stage: number, stagesLength: number): 'start' | 'middle' | 'done' {
  if (stage === stagesLength - 1) return 'done';
  if (stage === 0) return 'start';
  return 'middle';
}

function clickPosition(event: MouseEvent): FloatingToolbarPosition {
  return { x: event.clientX, y: event.clientY };
}

type TaskItemHandlers = {
  onToggle: (id: string) => void;
  onToggleSubtask?: (taskId: string, subtaskId: string) => void;
  onReorderSubtasks?: (taskId: string, activeId: string, overId: string) => void;
  // Whether THIS task's own toolbar should be shown — click-driven (not
  // hover). The caller (index.tsx) owns the actual toolbar UI, rendered as
  // a floating popup anchored to the click position this reports, not
  // inside this component.
  isActive?: boolean;
  onRowClick?: (position: FloatingToolbarPosition) => void;
  // Which one of this task's subtasks (if any) has its own toolbar shown.
  activeSubtaskId?: string | null;
  onSubtaskRowClick?: (subtaskId: string, position: FloatingToolbarPosition) => void;
  // Opens the quick-edit modal for this task's Stage list. Task-only —
  // subtasks share their parent's `stages` array rather than having their
  // own, so there's nothing for a subtask-level equivalent to edit.
  onEditStages?: (task: Task) => void;
  // Commits an inline title/description edit — takes the whole task since
  // the caller's updateTask replaces it wholesale (there's no patch-based
  // task updater, unlike updateSubtask below).
  onUpdateTask?: (task: Task) => void;
  onUpdateSubtask?: (taskId: string, subtaskId: string, patch: Partial<Pick<Subtask, 'title' | 'description'>>) => void;
  // Slot for an extra bit of UI rendered next to the title (e.g. the due
  // date badge).
  extra?: ReactNode;
  // Per-subtask counterpart to `extra` — called once per subtask (not once
  // per Task) since each subtask's badges depend on its own due/repeat.
  renderSubtaskExtra?: (subtask: Subtask) => ReactNode;
  // "Set due date"/"Set repeat" placeholder badges — built by the caller
  // (which owns due/repeat formatting). Always in the DOM; visibility is
  // driven purely by the .task-item__hover-reveal CSS (see task-item.scss)
  // reacting to :hover on the row, rather than by mounting/unmounting them
  // from JS — a JS-timed unmount kept racing the CSS transition it was
  // supposed to wait for, snapping the last bit of the collapse instead of
  // animating it.
  hoverExtra?: ReactNode;
  renderSubtaskHoverExtra?: (subtask: Subtask) => ReactNode;
};

type TaskItemProps<T extends Task> = TaskItemHandlers & { task: T };

export default function TaskItem<T extends Task>({ task, ...handlers }: TaskItemProps<T>) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  });
  // CSS.Translate (not CSS.Transform) deliberately drops the scaleX/scaleY
  // the sortable strategy computes for neighboring items of a different
  // height — applying that scale to the dragged item itself is what made
  // multi-line tasks visibly stretch/squash while being dragged.
  const style: CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    touchAction: 'none',
  };

  return (
    <TaskItemView
      task={task}
      {...handlers}
      isPlaceholder={isDragging}
      dragRef={setNodeRef}
      dragStyle={style}
      dragAttributes={attributes}
      dragListeners={listeners}
    />
  );
}

type DragBindings = {
  dragRef?: (node: HTMLElement | null) => void;
  dragStyle?: CSSProperties;
  dragAttributes?: HTMLAttributes<HTMLElement>;
  dragListeners?: HTMLAttributes<HTMLElement>;
  isPlaceholder?: boolean;
};

type TaskItemViewProps<T extends Task> = TaskItemHandlers &
  DragBindings & {
    task: T;
    // True only for the floating DragOverlay copy — renders subtasks as
    // plain, non-interactive rows instead of a nested sortable list, so a
    // drag in progress never has a second DndContext live under the pointer.
    overlay?: boolean;
  };

export function TaskItemView<T extends Task>({
  task,
  onToggle,
  onToggleSubtask,
  onReorderSubtasks,
  isActive,
  onRowClick,
  activeSubtaskId,
  onSubtaskRowClick,
  onEditStages,
  onUpdateTask,
  onUpdateSubtask,
  extra,
  renderSubtaskExtra,
  hoverExtra,
  renderSubtaskHoverExtra,
  dragRef,
  dragStyle,
  dragAttributes,
  dragListeners,
  isPlaceholder,
  overlay,
}: TaskItemViewProps<T>) {
  const nextIndex = getNextStageIndex(task.stage, task.stages.length);
  const activeStage = task.stages[task.stage];
  const nextStage = task.stages[nextIndex];
  const StageIcon = getTaskStageIcon(activeStage.icon);

  return (
    <div
      ref={dragRef}
      style={dragStyle}
      className={`task-item ${isPlaceholder ? 'task-item--placeholder' : ''} ${isActive ? 'task-item--active' : ''}`}
      onClick={(event: MouseEvent) => {
        event.stopPropagation();
        onRowClick?.(clickPosition(event));
      }}
      {...dragAttributes}
      {...dragListeners}
    >
      <button
        type="button"
        className={`task-toggle task-toggle--${activeStage.color}`}
        data-stage={task.stage}
        data-position={getStagePosition(task.stage, task.stages.length)}
        onClick={(event) => {
          event.stopPropagation();
          onToggle(task.id);
        }}
        aria-label={`Set ${task.title} to ${stageAriaLabel(nextStage, nextIndex)}`}
      >
        {StageIcon && createElement(StageIcon, { size: 12 })}
      </button>

      <div className="task-item__content">
        <InlineEditableField
          value={task.title}
          className={`task-item__title ${isTaskDone(task) ? 'is-done' : ''}`}
          ariaLabel={`Edit title for ${task.title}`}
          onCommit={(title) => onUpdateTask?.({ ...task, title })}
        />

        <InlineEditableField
          value={task.description ?? ''}
          placeholder="Description..."
          allowEmpty
          showPlaceholderIcon
          className="task-item__description"
          ariaLabel={`Edit description for ${task.title}`}
          onCommit={(description) => onUpdateTask?.({ ...task, description })}
        />

        {(extra || !isBlankStage(activeStage) || hoverExtra) && (
          <div className="task-item__footer">
            {!isBlankStage(activeStage) && (
              <Badge
                icon={StageIcon}
                title={activeStage.name || undefined}
                ariaLabel={`Stage: ${stageAriaLabel(activeStage, task.stage)}`}
                color={activeStage.color}
                onClick={(event) => {
                  event.stopPropagation();
                  onEditStages?.(task);
                }}
              />
            )}
            {extra}
            {hoverExtra && (
              <div className="task-item__hover-reveal">
                <div className="task-item__hover-reveal-inner">{hoverExtra}</div>
              </div>
            )}
          </div>
        )}

        {task.subtasks.length > 0 &&
          (overlay ? (
            <div className="task-item__subtasks">
              {task.subtasks.map((subtask) => (
                <SubtaskRowView
                  key={subtask.id}
                  subtask={subtask}
                  stages={task.stages}
                  onToggle={() => {}}
                  onRowClick={() => {}}
                  extra={renderSubtaskExtra?.(subtask)}
                  hoverExtra={renderSubtaskHoverExtra?.(subtask)}
                />
              ))}
            </div>
          ) : (
            <SortableTaskList
              ids={task.subtasks.map((subtask) => subtask.id)}
              onReorder={(activeId, overId) => onReorderSubtasks?.(task.id, activeId, overId)}
              renderOverlay={(activeId) => {
                const subtask = task.subtasks.find((s) => s.id === activeId);
                return subtask ? (
                  <SubtaskRowView
                    subtask={subtask}
                    stages={task.stages}
                    onToggle={() => {}}
                    onRowClick={() => {}}
                    extra={renderSubtaskExtra?.(subtask)}
                    hoverExtra={renderSubtaskHoverExtra?.(subtask)}
                  />
                ) : null;
              }}
            >
              <div className="task-item__subtasks">
                {task.subtasks.map((subtask) => (
                  <SubtaskRow
                    key={subtask.id}
                    subtask={subtask}
                    stages={task.stages}
                    onToggle={() => onToggleSubtask?.(task.id, subtask.id)}
                    isActive={activeSubtaskId === subtask.id}
                    onRowClick={(position) => onSubtaskRowClick?.(subtask.id, position)}
                    onUpdateSubtask={(patch) => onUpdateSubtask?.(task.id, subtask.id, patch)}
                    extra={renderSubtaskExtra?.(subtask)}
                    hoverExtra={renderSubtaskHoverExtra?.(subtask)}
                  />
                ))}
              </div>
            </SortableTaskList>
          ))}
      </div>
    </div>
  );
}

function SubtaskRow({
  subtask,
  stages,
  onToggle,
  isActive,
  onRowClick,
  onUpdateSubtask,
  extra,
  hoverExtra,
}: {
  subtask: Subtask;
  stages: TaskStageDef[];
  onToggle: () => void;
  isActive?: boolean;
  onRowClick: (position: FloatingToolbarPosition) => void;
  onUpdateSubtask?: (patch: Partial<Pick<Subtask, 'title' | 'description'>>) => void;
  extra?: ReactNode;
  hoverExtra?: ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: subtask.id,
  });
  const style: CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    touchAction: 'none',
  };

  return (
    <SubtaskRowView
      subtask={subtask}
      stages={stages}
      onToggle={onToggle}
      isActive={isActive}
      onRowClick={onRowClick}
      onUpdateSubtask={onUpdateSubtask}
      extra={extra}
      hoverExtra={hoverExtra}
      isPlaceholder={isDragging}
      dragRef={setNodeRef}
      dragStyle={style}
      dragAttributes={attributes}
      dragListeners={listeners}
    />
  );
}

type SubtaskRowViewProps = DragBindings & {
  subtask: Subtask;
  stages: TaskStageDef[];
  onToggle: () => void;
  isActive?: boolean;
  onRowClick: (position: FloatingToolbarPosition) => void;
  onUpdateSubtask?: (patch: Partial<Pick<Subtask, 'title' | 'description'>>) => void;
  extra?: ReactNode;
  hoverExtra?: ReactNode;
};

function SubtaskRowView({
  subtask,
  stages,
  onToggle,
  isActive,
  onRowClick,
  onUpdateSubtask,
  extra,
  hoverExtra,
  dragRef,
  dragStyle,
  dragAttributes,
  dragListeners,
  isPlaceholder,
}: SubtaskRowViewProps) {
  const subtaskStage = stages[subtask.stage];
  const subtaskStageLabel = stageAriaLabel(subtaskStage, subtask.stage);
  const SubtaskStageIcon = getTaskStageIcon(subtaskStage.icon);

  return (
    <div
      ref={dragRef}
      style={dragStyle}
      className={`subtask ${isPlaceholder ? 'subtask--placeholder' : ''} ${isActive ? 'subtask--active' : ''}`}
      onClick={(event: MouseEvent) => {
        event.stopPropagation();
        onRowClick(clickPosition(event));
      }}
      {...dragAttributes}
      {...dragListeners}
    >
      <button
        type="button"
        className={`task-toggle task-toggle--${subtaskStage.color}`}
        data-stage={subtask.stage}
        data-position={getStagePosition(subtask.stage, stages.length)}
        onClick={(event) => {
          event.stopPropagation();
          onToggle();
        }}
        aria-label={`Set ${subtask.title} to next status`}
        title={subtaskStageLabel}
      >
        {SubtaskStageIcon && createElement(SubtaskStageIcon, { size: 12 })}
      </button>
      <div className="subtask__content">
        <InlineEditableField
          value={subtask.title}
          className={`subtask__title ${isTaskDone({ stage: subtask.stage, stages }) ? 'is-done' : ''}`}
          ariaLabel={`Edit title for ${subtask.title}`}
          onCommit={(title) => onUpdateSubtask?.({ title })}
        />

        <InlineEditableField
          value={subtask.description ?? ''}
          placeholder="Description..."
          allowEmpty
          showPlaceholderIcon
          className="task-item__description"
          ariaLabel={`Edit description for ${subtask.title}`}
          onCommit={(description) => onUpdateSubtask?.({ description })}
        />
        {(extra || hoverExtra) && (
          <div className="task-item__footer">
            {extra}
            {hoverExtra && (
              <div className="task-item__hover-reveal">
                <div className="task-item__hover-reveal-inner">{hoverExtra}</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
