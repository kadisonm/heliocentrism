'use client';

import { useEffect, useMemo, useState } from 'react';
import DashboardGrid from '../../components/dashboard/DashboardGrid';
import DashboardStatusBar from '../../components/dashboard/DashboardStatusBar';
import { useDashboardState } from '../../components/dashboard/useDashboardState';
import { useDeviceTier } from '../../components/dashboard/useDeviceTier';
import type { DashboardBreakpoint } from '../../lib/types';

export default function DashboardPage() {
  const [isEditMode, setIsEditMode] = useState(false);
  const [activeBreakpoint, setActiveBreakpoint] = useState<DashboardBreakpoint>('desktop');

  const dashboard = useDashboardState();
  const deviceTier = useDeviceTier();

  // A phone can't usefully preview or edit the desktop layout it can't see,
  // and a tablet has no reason to touch desktop either — each device can
  // only edit its own tier and narrower ones.
  const allowedBreakpoints = useMemo<DashboardBreakpoint[]>(() => {
    if (deviceTier === 'mobile') return ['mobile'];
    if (deviceTier === 'tablet') return ['mobile', 'tablet'];
    return ['desktop', 'tablet', 'mobile'];
  }, [deviceTier]);

  useEffect(() => {
    if (!allowedBreakpoints.includes(activeBreakpoint)) {
      // Sync activeBreakpoint back into the allowed set whenever the device
      // tier changes (e.g. resizing across a breakpoint mid-edit) — land on
      // the widest tier still allowed, closest to what was selected.
      /* eslint-disable-next-line react-hooks/set-state-in-effect */
      setActiveBreakpoint(allowedBreakpoints[allowedBreakpoints.length - 1]);
    }
  }, [allowedBreakpoints, activeBreakpoint]);

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
        allowedBreakpoints={allowedBreakpoints}
        onBreakpointChange={setActiveBreakpoint}
        onAddWidget={dashboard.addWidget}
      />
    </div>
  );
}
