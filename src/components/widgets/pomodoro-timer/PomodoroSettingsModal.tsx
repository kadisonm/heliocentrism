'use client';

import type { AppSettings } from '../../../lib/data';
import Modal from '../../common/Modal';
import { useSettings } from '../../shared/tasks/useSettings';

type PomodoroSettingsModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

export default function PomodoroSettingsModal({ isOpen, onClose }: PomodoroSettingsModalProps) {
  const { settings, isLoading, updateSettings } = useSettings();

  const updatePomodoro = (patch: Partial<AppSettings['pomodoro']>) => {
    updateSettings({
      ...settings,
      pomodoro: { ...settings.pomodoro, ...patch },
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Pomodoro Settings"
      scope="shared"
      scopeLabel="Applies to every Pomodoro Timer widget on your dashboard"
    >
      <div className="settings-section">
        <h3>Pomodoro Timer</h3>

        {!isLoading && (
          <div className="settings-field-row">
            <div className="settings-field">
              <label>Study (minutes)</label>
              <input
                type="number"
                min={1}
                className="settings-input"
                value={settings.pomodoro.studyMinutes}
                onChange={(event) =>
                  updatePomodoro({ studyMinutes: Number(event.target.value) || 1 })
                }
              />
            </div>

            <div className="settings-field">
              <label>Break (minutes)</label>
              <input
                type="number"
                min={1}
                className="settings-input"
                value={settings.pomodoro.breakMinutes}
                onChange={(event) =>
                  updatePomodoro({ breakMinutes: Number(event.target.value) || 1 })
                }
              />
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
