'use client';

import { Maximize2, Settings, Trash2, UnfoldVertical } from 'lucide-react';
import ContextMenu, { type ContextMenuPosition } from '../common/context-menu/ContextMenu';
import MenuItem from '../common/context-menu/MenuItem';
import type { WidgetDefinition } from '../../lib/grid/widgetRegistry';
import type { DashboardWidget } from '../../lib/types';

type WidgetContextMenuProps = {
  position: ContextMenuPosition;
  widget: DashboardWidget;
  definition: WidgetDefinition | null;
  onClose: () => void;
  onOpenSettings: () => void;
  onToggleAutoExpand: () => void;
  // Swaps this menu for the resize handles (see WidgetShell's overlay
  // state) — deliberately NOT followed by onClose in this file: closing
  // would just null the overlay right back out from under it.
  onResize: () => void;
  onDelete: () => void;
};

// Opened by WidgetShell on a widget's own long-press (see useLongPress) —
// reuses the same ContextMenu/MenuItem shell the task-list widget's own
// "..." menu already uses.
export default function WidgetContextMenu({
  position,
  widget,
  definition,
  onClose,
  onOpenSettings,
  onToggleAutoExpand,
  onResize,
  onDelete,
}: WidgetContextMenuProps) {
  const isAutoExpand = !!(widget.autoExpand && definition?.supportsAutoExpand);

  return (
    <ContextMenu position={position} onClose={onClose}>
      {definition?.settingsComponent && (
        <MenuItem
          icon={Settings}
          label="Settings"
          onClick={() => {
            onOpenSettings();
            onClose();
          }}
        />
      )}
      {definition?.supportsAutoExpand && (
        <MenuItem
          icon={UnfoldVertical}
          label={isAutoExpand ? 'Disable auto-expand' : 'Enable auto-expand'}
          onClick={() => {
            onToggleAutoExpand();
            onClose();
          }}
        />
      )}
      <MenuItem icon={Maximize2} label="Resize" onClick={onResize} />
      <MenuItem
        icon={Trash2}
        label="Delete"
        color="error"
        onClick={() => {
          onDelete();
          onClose();
        }}
      />
    </ContextMenu>
  );
}
