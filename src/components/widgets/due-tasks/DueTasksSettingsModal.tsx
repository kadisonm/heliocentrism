'use client';

import { useEffect, useState } from 'react';
import { useAppSelector } from '../../../lib/store/hooks';
import CheckboxList from '../../common/CheckboxList';
import Modal from '../../common/Modal';
import SettingsField from '../../common/SettingsField';
import { useWidgetContext } from '../../grid/widgetContext';

type DueTasksSettingsModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

export default function DueTasksSettingsModal({ isOpen, onClose }: DueTasksSettingsModalProps) {
  const { widget, onUpdate } = useWidgetContext();
  const taskLists = useAppSelector((state) => state.taskLists.taskLists);
  const [included, setIncluded] = useState<string[]>([]);
  const [withinDays, setWithinDays] = useState('');

  // Re-seed from the saved filter on every open, so closing without saving discards changes.
  useEffect(() => {
    if (!isOpen) return;
    const excluded = new Set(widget.excludedListIds ?? []);
    /* eslint-disable react-hooks/set-state-in-effect */
    setIncluded(taskLists.filter((list) => !excluded.has(list.id)).map((list) => list.id));
    setWithinDays(widget.dueWithinDays !== undefined ? String(widget.dueWithinDays) : '');
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [isOpen, widget.excludedListIds, widget.dueWithinDays, taskLists]);

  // Blank (or invalid) = no limit; 0 = today only.
  const parsedDays = withinDays.trim() === '' ? undefined : Math.floor(Number(withinDays));
  const dueWithinDays = parsedDays !== undefined && parsedDays >= 0 ? parsedDays : undefined;

  // Stored as exclusions so lists created later are included automatically.
  const handleSave = () => {
    const excluded = taskLists.filter((list) => !included.includes(list.id)).map((list) => list.id);
    onUpdate({ excludedListIds: excluded.length > 0 ? excluded : undefined, dueWithinDays });
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Due Tasks Settings" scope="instance" scopeLabel="Only this widget is affected">
      <div className="settings-section">
        <div className="settings-field">
          <SettingsField
            label="Show tasks due within (days)"
            type="number"
            value={withinDays}
            onChange={setWithinDays}
            placeholder="No limit"
          />
          <p className="settings-hint">Overdue tasks always show. 0 = due today only; leave blank for no limit.</p>
        </div>

        <div className="settings-field">
          <label>Include tasks from</label>
          {taskLists.length > 0 ? (
            <CheckboxList
              options={taskLists.map((list) => ({ value: list.id, label: list.name }))}
              checked={included}
              onChange={setIncluded}
              ariaLabel="Task lists to include"
            />
          ) : (
            <p className="settings-hint">No task lists yet.</p>
          )}
        </div>

        <div className="settings-actions">
          <button type="button" className="settings-button settings-button-primary" onClick={handleSave}>
            Save
          </button>
        </div>
      </div>
    </Modal>
  );
}
