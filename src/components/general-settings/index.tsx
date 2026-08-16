'use client';

import Modal from '../common/Modal';

type GeneralSettingsPanelProps = {
  isOpen: boolean;
  onClose: () => void;
};

export default function GeneralSettingsPanel({
  isOpen,
  onClose,
}: GeneralSettingsPanelProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Settings">
      <div className="settings-section">
        <p className="settings-help">No settings yet — check back soon.</p>
      </div>
    </Modal>
  );
}
