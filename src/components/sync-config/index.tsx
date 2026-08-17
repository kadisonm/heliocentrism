'use client';

import Modal from '../common/Modal';
import SyncConfigForm from './SyncConfigForm';

type SyncConfigPanelProps = {
  isOpen: boolean;
  onClose: () => void;
  onSyncConfigured?: () => void;
};

export default function SyncConfigPanel({
  isOpen,
  onClose,
  onSyncConfigured,
}: SyncConfigPanelProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Sync Configuration">
      <SyncConfigForm isOpen={isOpen} onSyncConfigured={onSyncConfigured} />
    </Modal>
  );
}
