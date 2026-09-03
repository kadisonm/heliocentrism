'use client';

import { ArrowLeft, Check, Monitor, Plus, X } from 'lucide-react';
import { useState } from 'react';
import ContextMenu, { type ContextMenuPosition } from '../common/context-menu/ContextMenu';
import MenuItem from '../common/context-menu/MenuItem';
import type { DashboardBreakpoint } from '../../lib/types';

const BREAKPOINT_OPTIONS: { value: DashboardBreakpoint; label: string }[] = [
  { value: 'desktop', label: 'Desktop' },
  { value: 'tablet', label: 'Tablet' },
  { value: 'mobile', label: 'Mobile' },
];

type CanvasContextMenuProps = {
  // null when closed — controlled by the caller (Grid.tsx), which owns the
  // actual right-click/long-press trigger on the active page's background.
  position: ContextMenuPosition | null;
  onClose: () => void;
  onAddWidget: () => void;
  previewBreakpoint: DashboardBreakpoint | null;
  allowedBreakpoints: DashboardBreakpoint[];
  onPreviewBreakpointChange: (breakpoint: DashboardBreakpoint | null) => void;
};

// Right-click (desktop) or long-press (mobile) on empty canvas space — see
// Grid.tsx for the trigger wiring. Replaces the old GridStatusBar's Add
// Widget button and breakpoint-simulation Tabs with a single menu, swapping
// between a root and a "Preview as" submenu within the same ContextMenu
// instance rather than a real flyout (see the plan's own note on this being
// the lower-risk initial approach).
export default function CanvasContextMenu({
  position,
  onClose,
  onAddWidget,
  previewBreakpoint,
  allowedBreakpoints,
  onPreviewBreakpointChange,
}: CanvasContextMenuProps) {
  const [submenu, setSubmenu] = useState<'root' | 'preview'>('root');
  // Every fresh open starts back at the root menu, regardless of which
  // submenu a previous open session was left on — adjusted during render
  // (React's own pattern for resetting state when a prop changes) rather
  // than in an effect, so there's no extra render showing the stale submenu
  // before it resets.
  const [prevPosition, setPrevPosition] = useState(position);
  if (position !== prevPosition) {
    setPrevPosition(position);
    if (position) setSubmenu('root');
  }

  if (!position) return null;

  const breakpointOptions = BREAKPOINT_OPTIONS.filter((option) => allowedBreakpoints.includes(option.value));

  return (
    <ContextMenu position={position} onClose={onClose}>
      {submenu === 'root' ? (
        <>
          <MenuItem
            icon={Plus}
            label="Add widget"
            onClick={() => {
              onAddWidget();
              onClose();
            }}
          />
          <MenuItem icon={Monitor} label="Preview as" onClick={() => setSubmenu('preview')} />
        </>
      ) : (
        <>
          <MenuItem icon={ArrowLeft} label="Back" onClick={() => setSubmenu('root')} />
          {breakpointOptions.map((option) => (
            <MenuItem
              key={option.value}
              icon={option.value === previewBreakpoint ? Check : Monitor}
              label={option.label}
              onClick={() => {
                onPreviewBreakpointChange(option.value);
                onClose();
              }}
            />
          ))}
          {previewBreakpoint !== null && (
            <MenuItem
              icon={X}
              label="Stop previewing"
              onClick={() => {
                onPreviewBreakpointChange(null);
                onClose();
              }}
            />
          )}
        </>
      )}
    </ContextMenu>
  );
}
