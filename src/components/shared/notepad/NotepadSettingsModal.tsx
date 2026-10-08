'use client';

import { useEffect, useState } from 'react';
import CheckboxList from '../../common/CheckboxList';
import Modal from '../../common/Modal';
import { useWidgetContext } from '../../grid/widgetContext';

type NotepadSettingsModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

const HIDE_BACKGROUND = 'hideBackground';

// Shared by the plain and markdown notepads.
export default function NotepadSettingsModal({ isOpen, onClose }: NotepadSettingsModalProps) {
  const { widget, onUpdate } = useWidgetContext();
  const [checked, setChecked] = useState<string[]>([]);

  // Re-seed from the saved config on every open, so closing without saving discards changes.
  useEffect(() => {
    if (!isOpen) return;
    /* eslint-disable-next-line react-hooks/set-state-in-effect */
    setChecked(widget.hideBackground ? [HIDE_BACKGROUND] : []);
  }, [isOpen, widget.hideBackground]);

  const handleSave = () => {
    onUpdate({ hideBackground: checked.includes(HIDE_BACKGROUND) || undefined });
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Notepad Settings" scope="instance" scopeLabel="Only this widget is affected">
      <div className="settings-section">
        <div className="settings-field">
          <CheckboxList
            options={[{ value: HIDE_BACKGROUND, label: 'Hide background' }]}
            checked={checked}
            onChange={setChecked}
            ariaLabel="Appearance"
          />
          <p className="settings-hint">
            The note floats straight on the dashboard. Long-press or right-click the note&apos;s edge to reach this menu again.
          </p>
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
