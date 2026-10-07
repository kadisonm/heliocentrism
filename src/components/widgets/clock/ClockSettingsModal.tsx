'use client';

import { useEffect, useState } from 'react';
import { CLOCK_FORMAT_PRESETS, DEFAULT_CLOCK_FORMAT } from '../../../lib/clock/clockPresets';
import { DATE_TIME_TOKENS, formatDateTime } from '../../../lib/clock/dateTimeFormat';
import ChipList from '../../common/ChipList';
import Modal from '../../common/Modal';
import SettingsField from '../../common/SettingsField';
import { useWidgetContext } from '../../grid/widgetContext';

type ClockSettingsModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

export default function ClockSettingsModal({ isOpen, onClose }: ClockSettingsModalProps) {
  const { widget, onUpdate } = useWidgetContext();
  const [format, setFormat] = useState(DEFAULT_CLOCK_FORMAT);

  // Re-seed from the saved config on every open, so closing without saving discards edits.
  useEffect(() => {
    if (!isOpen) return;
    /* eslint-disable-next-line react-hooks/set-state-in-effect */
    setFormat(widget.clock?.format || DEFAULT_CLOCK_FORMAT);
  }, [isOpen, widget.clock]);

  const handleSave = () => {
    onUpdate({ clock: format.trim() ? { format } : undefined });
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Clock Settings" scope="instance" scopeLabel="Only this widget is affected">
      <div className="settings-section">
        <div className="clock-settings-preview">{formatDateTime(new Date(), format || DEFAULT_CLOCK_FORMAT)}</div>

        <ChipList options={CLOCK_FORMAT_PRESETS} onSelect={setFormat} />

        <SettingsField label="Format" type="textarea" value={format} onChange={setFormat} placeholder={DEFAULT_CLOCK_FORMAT} />

        <p className="settings-hint">
          Press Enter for a new line. Wrap plain words in [brackets] so their letters aren&apos;t read as tokens.
        </p>

        <dl className="clock-settings-tokens">
          {DATE_TIME_TOKENS.map((def) => (
            <div key={def.token} className="clock-settings-token">
              <dt>{def.token}</dt>
              <dd>{def.description}</dd>
            </div>
          ))}
        </dl>

        <div className="settings-actions">
          <button type="button" className="settings-button settings-button-primary" onClick={handleSave}>
            Save
          </button>
        </div>
      </div>
    </Modal>
  );
}
