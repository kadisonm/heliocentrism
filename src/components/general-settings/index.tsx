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
      <p className="settings-help">
        No general settings yet — widget-specific settings live on their own
        widgets, accessible via the gear icon while editing the dashboard.
      </p>
    </Modal>
  );
}
