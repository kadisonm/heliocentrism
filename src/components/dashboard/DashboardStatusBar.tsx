'use client';

import { Check, Pencil, Plus } from 'lucide-react';
import { useState } from 'react';
import Tabs from '../common/Tabs';
import type { DashboardBreakpoint } from '../../lib/types';
import AddWidgetModal from './AddWidgetModal';

type DashboardStatusBarProps = {
  isEditMode: boolean;
  onToggleEditMode: () => void;
  activeBreakpoint: DashboardBreakpoint;
  onBreakpointChange: (breakpoint: DashboardBreakpoint) => void;
  onAddWidget: (type: string) => void;
};

export default function DashboardStatusBar({
  isEditMode,
  onToggleEditMode,
  activeBreakpoint,
  onBreakpointChange,
  onAddWidget,
}: DashboardStatusBarProps) {
  const [isAddWidgetOpen, setIsAddWidgetOpen] = useState(false);

  return (
    <div
      className={
        isEditMode
          ? 'dashboard-status-bar dashboard-status-bar--expanded'
          : 'dashboard-status-bar'
      }
    >
      <div className="dashboard-status-bar-expand" inert={!isEditMode}>
        <div className="dashboard-status-bar-expand-inner">
          <Tabs
            ariaLabel="Editing breakpoint"
            options={[
              { value: 'desktop', label: 'Desktop' },
              { value: 'tablet', label: 'Tablet' },
              { value: 'mobile', label: 'Mobile' },
            ]}
            value={activeBreakpoint}
            onChange={onBreakpointChange}
          />

          <button
            type="button"
            className="dashboard-status-bar-add"
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
            ? 'dashboard-status-bar-toggle dashboard-status-bar-toggle--confirm'
            : 'dashboard-status-bar-toggle'
        }
        onClick={onToggleEditMode}
        title={isEditMode ? 'Done editing' : 'Edit dashboard'}
        aria-label={isEditMode ? 'Done editing' : 'Edit dashboard'}
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
