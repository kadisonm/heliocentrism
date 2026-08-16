'use client';

import type { RoutineResetTimes } from '../../lib/types';
import Modal from '../common/Modal';
import { useSettings } from '../tasks/useSettings';

type GeneralSettingsPanelProps = {
  isOpen: boolean;
  onClose: () => void;
};

const DAY_OPTIONS = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

function formatTime(hour: number, minute: number): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function parseTime(value: string): { hour: number; minute: number } {
  const [hour, minute] = value.split(':').map(Number);
  return { hour: hour || 0, minute: minute || 0 };
}

// 28 is the highest day-of-month guaranteed to exist in every month
// (including February in non-leap years), so it's a fixed cap rather than
// one that depends on whichever month Settings happens to be open in.
const MAX_DAY_OF_MONTH = 28;

export default function GeneralSettingsPanel({
  isOpen,
  onClose,
}: GeneralSettingsPanelProps) {
  const { settings, isLoading, updateSettings } = useSettings();
  const { daily, weekly, monthly } = settings.routineResetTimes;
  // Defensive only — clamps for display if a value >28 was ever stored
  // (e.g. from before this cap existed), without overwriting the setting.
  const displayedDayOfMonth = Math.min(monthly.dayOfMonth, MAX_DAY_OF_MONTH);

  const updateResetTimes = (patch: Partial<RoutineResetTimes>) => {
    updateSettings({
      ...settings,
      routineResetTimes: { ...settings.routineResetTimes, ...patch },
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Settings">
      <div className="settings-section">
        <h3>Routine Reset Times</h3>

        {!isLoading && (
          <>
            <div className="settings-field">
              <label>Daily</label>
              <input
                type="time"
                className="settings-input"
                value={formatTime(daily.hour, daily.minute)}
                onChange={(event) => updateResetTimes({ daily: parseTime(event.target.value) })}
              />
            </div>

            <div className="settings-field-row">
              <div className="settings-field">
                <label>Weekly</label>
                <select
                  className="settings-input"
                  value={weekly.dayOfWeek}
                  onChange={(event) =>
                    updateResetTimes({
                      weekly: { ...weekly, dayOfWeek: Number(event.target.value) },
                    })
                  }
                >
                  {DAY_OPTIONS.map((day) => (
                    <option key={day.value} value={day.value}>
                      {day.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="settings-field">
                <label>Time</label>
                <input
                  type="time"
                  className="settings-input"
                  value={formatTime(weekly.hour, weekly.minute)}
                  onChange={(event) =>
                    updateResetTimes({ weekly: { ...weekly, ...parseTime(event.target.value) } })
                  }
                />
              </div>
            </div>

            <div className="settings-field-row">
              <div className="settings-field">
                <label>Monthly (day)</label>
                <select
                  className="settings-input"
                  value={displayedDayOfMonth}
                  onChange={(event) =>
                    updateResetTimes({
                      monthly: { ...monthly, dayOfMonth: Number(event.target.value) },
                    })
                  }
                >
                  {Array.from({ length: MAX_DAY_OF_MONTH }, (_, index) => index + 1).map((day) => (
                    <option key={day} value={day}>
                      {day}
                    </option>
                  ))}
                </select>
              </div>

              <div className="settings-field">
                <label>Time</label>
                <input
                  type="time"
                  className="settings-input"
                  value={formatTime(monthly.hour, monthly.minute)}
                  onChange={(event) =>
                    updateResetTimes({ monthly: { ...monthly, ...parseTime(event.target.value) } })
                  }
                />
              </div>
            </div>
          </>
        )}

        <p className="settings-help">
          Completed daily, weekly, and monthly tasks automatically reset back to
          &quot;To do&quot; once their reset time passes.
        </p>
      </div>
    </Modal>
  );
}
