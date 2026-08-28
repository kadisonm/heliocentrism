import { EllipsisVertical } from 'lucide-react';
import { createElement } from 'react';
import type { ReactNode } from 'react';
import { getTaskStageIcon } from '../../../lib/tasks/taskStageIcons';
import type { TaskStageDef } from '../../../lib/types';
import Badge from '../../common/Badge';
import type { ContextMenuPosition } from '../../common/context-menu/ContextMenu';
import { toContextMenuPosition } from './contextMenuPosition';
import InlineEditableField from './InlineEditableField';
import { isBlankStage, stageAriaLabel } from './taskStageDisplay';

// One row, shared by both a task and its subtasks — the only real
// differences are the outer class prefix and that a subtask never shows a
// Stage badge or nests children of its own (both driven by `variant`).
type TaskRowProps = {
  // dnd-kit v7 manages the drag transform/transition AND the placeholder/
  // floating-clone visuals entirely on its own (see [data-dnd-dragging]
  // and [data-dnd-placeholder] in task-item.scss) — this component only
  // needs to hand it the ref (see useTaskSortable.ts).
  dragRef?: (element: Element | null) => void;
  variant: 'task' | 'subtask';
  title: string;
  description?: string;
  isDone: boolean;
  stageDef: TaskStageDef;
  stageIndex: number;
  stagePosition: 'start' | 'middle' | 'done';
  toggleAriaLabel: string;
  toggleTitle?: string;
  onToggleStage: () => void;
  onCommitTitle: (title: string) => void;
  onCommitDescription: (description: string) => void;
  showStageBadge?: boolean;
  onStageBadgeClick?: () => void;
  isActive?: boolean;
  onRowClick?: (position: ContextMenuPosition) => void;
  showMenuButton?: boolean;
  extra?: ReactNode;
  editExtra?: ReactNode;
  isEditingRow?: boolean;
  onEnterEditMode?: () => void;
  // One-shot "picked up"/"dropped" scale pop, driven by our own stable
  // draggingId/droppingId state rather than dnd-kit's own
  // [data-dnd-dragging] attribute (see task-item.scss).
  dragPhase?: 'dragging' | 'dropped';
  // Nested subtasks list — task rows only.
  children?: ReactNode;
};

export default function TaskRow({
  variant,
  title,
  description,
  isDone,
  stageDef,
  stageIndex,
  stagePosition,
  toggleAriaLabel,
  toggleTitle,
  onToggleStage,
  onCommitTitle,
  onCommitDescription,
  showStageBadge = false,
  onStageBadgeClick,
  isActive,
  onRowClick,
  showMenuButton = true,
  extra,
  editExtra,
  isEditingRow,
  onEnterEditMode,
  dragPhase,
  children,
  dragRef,
}: TaskRowProps) {
  const rootClass = variant === 'task' ? 'task-item' : 'subtask';
  const contentClass = variant === 'task' ? 'task-item__content' : 'subtask__content';
  const titleClass = variant === 'task' ? 'task-item__title' : 'subtask__title';
  const StageIcon = getTaskStageIcon(stageDef.icon);
  const showStageBadgeNow = showStageBadge && !isBlankStage(stageDef);

  return (
    <div
      ref={dragRef}
      className={`${rootClass} ${isActive ? `${rootClass}--active` : ''} ${isEditingRow ? `${rootClass}--editing` : ''} ${dragPhase ? `${rootClass}--${dragPhase}` : ''}`}
      // Clicking the row background enters edit mode; interactive children
      // already stopPropagation. Must stop it here too, since a subtask's
      // DOM is nested inside its parent task's — otherwise the click
      // bubbles up and the parent overwrites edit state meant for this subtask.
      onClick={(event) => {
        event.stopPropagation();
        onEnterEditMode?.();
      }}
    >
      <button
        type="button"
        className={`task-toggle task-toggle--${stageDef.color}`}
        data-stage={stageIndex}
        data-position={stagePosition}
        onClick={(event) => {
          event.stopPropagation();
          onToggleStage();
          onEnterEditMode?.();
        }}
        aria-label={toggleAriaLabel}
        title={toggleTitle}
      >
        {StageIcon && createElement(StageIcon, { size: 12 })}
      </button>

      <div className={contentClass}>
        <InlineEditableField
          value={title}
          className={`${titleClass} ${isDone ? 'is-done' : ''}`}
          ariaLabel={`Edit title for ${title}`}
          onCommit={onCommitTitle}
          onEditStart={onEnterEditMode}
        />

        <InlineEditableField
          value={description ?? ''}
          placeholder="Description..."
          allowEmpty
          showPlaceholderIcon
          className="task-item__description"
          ariaLabel={`Edit description for ${title}`}
          onCommit={onCommitDescription}
          onEditStart={onEnterEditMode}
        />

        {(extra || showStageBadgeNow || editExtra) && (
          <div className="task-item__footer">
            {showStageBadgeNow && (
              <Badge
                icon={StageIcon}
                title={stageDef.name || undefined}
                ariaLabel={`Stage: ${stageAriaLabel(stageDef, stageIndex)}`}
                color={stageDef.color}
                onClick={(event) => {
                  event.stopPropagation();
                  onStageBadgeClick?.();
                  onEnterEditMode?.();
                }}
              />
            )}
            {extra}
            {editExtra && (
              <div className="task-item__footer-reveal">
                <div className="task-item__footer-reveal-inner">{editExtra}</div>
              </div>
            )}
          </div>
        )}

        {children}
      </div>

      {showMenuButton && (
        <button
          type="button"
          className="task-item__toolbar-button task-item__menu-button"
          onClick={(event) => {
            event.stopPropagation();
            onRowClick?.(toContextMenuPosition(event));
            onEnterEditMode?.();
          }}
          title="More actions"
          aria-label={`More actions for ${title}`}
        >
          <EllipsisVertical size={14} />
        </button>
      )}
    </div>
  );
}
