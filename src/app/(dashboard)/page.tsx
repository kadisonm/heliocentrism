'use client';

import { useState } from 'react';
import DashboardGrid from '../../components/dashboard/DashboardGrid';
import DashboardStatusBar from '../../components/dashboard/DashboardStatusBar';
import { useDashboardState } from '../../components/dashboard/useDashboardState';
import type { DashboardBreakpoint } from '../../lib/types';

export default function DashboardPage() {
  const [isEditMode, setIsEditMode] = useState(false);
  const [activeBreakpoint, setActiveBreakpoint] = useState<DashboardBreakpoint>('desktop');

  const dashboard = useDashboardState();

  return (
    <div className="dashboard-wrapper">
      <div className="dashboard-container">
        {!dashboard.isLoading && (
          <DashboardGrid
            widgets={dashboard.widgets}
            layouts={dashboard.layouts}
            isEditMode={isEditMode}
            activeBreakpoint={activeBreakpoint}
            onLayoutsChange={dashboard.setLayouts}
            onSetWidgetType={dashboard.setWidgetType}
            onRemoveWidget={dashboard.removeWidget}
          />
        )}
      </div>

      <DashboardStatusBar
        isEditMode={isEditMode}
        onToggleEditMode={() => setIsEditMode((current) => !current)}
        activeBreakpoint={activeBreakpoint}
        onBreakpointChange={setActiveBreakpoint}
        onAddWidget={dashboard.addWidget}
      />
    </div>
  );
}
