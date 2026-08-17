'use client';

import { Check, Pencil, Plus } from 'lucide-react';
import { useState } from 'react';
import Tabs from '../common/Tabs';
import type { DashboardBreakpoint } from '../../lib/types';
import AddWidgetModal from './AddWidgetModal';

const BREAKPOINT_OPTIONS: { value: DashboardBreakpoint; label: string }[] = [
  { value: 'desktop', label: 'Desktop' },
  { value: 'tablet', label: 'Tablet' },
  { value: 'mobile', label: 'Mobile' },
];

type GridStatusBarProps = {
  isEditMode: boolean;
  onToggleEditMode: () => void;
  activeBreakpoint: DashboardBreakpoint;
  allowedBreakpoints: DashboardBreakpoint[];
  onBreakpointChange: (breakpoint: DashboardBreakpoint) => void;
  onAddWidget: (type: string) => void;
};

export default function GridStatusBar({
  isEditMode,
  onToggleEditMode,
  activeBreakpoint,
  allowedBreakpoints,
  onBreakpointChange,
  onAddWidget,
}: GridStatusBarProps) {
  const [isAddWidgetOpen, setIsAddWidgetOpen] = useState(false);
  const breakpointOptions = BREAKPOINT_OPTIONS.filter((option) =>
    allowedBreakpoints.includes(option.value)
  );

  return (
    <div
      className={
        isEditMode ? 'grid-status-bar grid-status-bar--expanded' : 'grid-status-bar'
      }
    >
      <div className="grid-status-bar-expand" inert={!isEditMode}>
        <div className="grid-status-bar-expand-inner">
          <Tabs
            ariaLabel="Editing breakpoint"
            options={breakpointOptions}
            value={activeBreakpoint}
            onChange={onBreakpointChange}
          />

          <button
            type="button"
            className="grid-status-bar-add"
            onClick={() => setIsAddWidgetOpen(true)}
            title="Add Widget"
            aria-label="Add Widget"
          >
            <Plus size={18} />
          </button>
        </div>
      </div>

      <button
        type="button"
        className={
          isEditMode
            ? 'grid-status-bar-toggle grid-status-bar-toggle--confirm'
            : 'grid-status-bar-toggle'
        }
        onClick={onToggleEditMode}
        title={isEditMode ? 'Done editing' : 'Edit grid'}
        aria-label={isEditMode ? 'Done editing' : 'Edit grid'}
      >
        {isEditMode ? <Check size={18} /> : <Pencil size={18} />}
      </button>

      <AddWidgetModal
        isOpen={isAddWidgetOpen}
        onClose={() => setIsAddWidgetOpen(false)}
        onSelect={(type) => {
          onAddWidget(type);
          setIsAddWidgetOpen(false);
        }}
      />
    </div>
  );
}
