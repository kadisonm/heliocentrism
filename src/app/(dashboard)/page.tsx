'use client';

import { useState } from 'react';
import RecurringTasks from '../../components/RecurringTasks';
import SettingsPanel from '../../components/Settings';

export default function DashboardPage() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  return (
    <div className="dashboard-wrapper">
      <header className="dashboard-header">
        <h1>Dashboard</h1>
        <button
          className="dashboard-settings-button"
          onClick={() => setIsSettingsOpen(true)}
          title="Settings"
        >
          ⚙️
        </button>
      </header>

      <div className="dashboard-container">
        <RecurringTasks />
      </div>

      <SettingsPanel
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSyncConfigured={() => {
          // Refresh tasks if needed
          window.location.reload();
        }}
      />
    </div>
  );
}
