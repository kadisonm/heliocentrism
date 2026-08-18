'use client';

import { ImageOff } from 'lucide-react';
import { useEffect, useState } from 'react';
import Modal from '../../common/Modal';
import SettingsField from '../../common/SettingsField';
import { useWidgetContext } from '../../grid/widgetContext';

type PhotoSettingsModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

type FitValue = 'cover' | 'contain';

const FIT_OPTIONS: { value: FitValue; label: string }[] = [
  { value: 'cover', label: 'Fill (crop to fit)' },
  { value: 'contain', label: 'Fit (show whole image)' },
];

export default function PhotoSettingsModal({ isOpen, onClose }: PhotoSettingsModalProps) {
  const { widget, onUpdate } = useWidgetContext();
  const [url, setUrl] = useState('');
  const [alt, setAlt] = useState('');
  const [fit, setFit] = useState<FitValue>('cover');

  // Re-seed local form state from the widget's saved config every time the
  // modal opens, so closing without saving discards whatever was typed.
  useEffect(() => {
    if (!isOpen) return;
    /* eslint-disable react-hooks/set-state-in-effect */
    setUrl(widget.photo?.url ?? '');
    setAlt(widget.photo?.alt ?? '');
    setFit(widget.photo?.fit ?? 'cover');
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [isOpen, widget.photo]);

  const handleSave = () => {
    const trimmedUrl = url.trim();
    onUpdate({
      photo: trimmedUrl ? { url: trimmedUrl, alt: alt.trim() || undefined, fit } : undefined,
    });
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Photo Settings"
      scope="instance"
      scopeLabel="Only this widget is affected"
    >
      <div className="settings-section">
        <div className="photo-settings-preview">
          {url.trim() ? (
            /* eslint-disable-next-line @next/next/no-img-element -- same
               arbitrary-URL reasoning as the widget itself. */
            <img src={url.trim()} alt={alt} />
          ) : (
            <span className="photo-settings-preview-empty">
              <ImageOff size={22} />
            </span>
          )}
        </div>

        <SettingsField
          label="Image URL"
          value={url}
          onChange={setUrl}
          placeholder="https://example.com/photo.gif"
        />
        <SettingsField
          label="Alt text (optional)"
          value={alt}
          onChange={setAlt}
          placeholder="Description of the image"
        />
        <SettingsField
          label="Fit"
          type="select"
          value={fit}
          options={FIT_OPTIONS}
          onChange={(value) => setFit(value as FitValue)}
        />

        <div className="settings-actions">
          <button
            type="button"
            className="settings-button settings-button-primary"
            onClick={handleSave}
          >
            Save
          </button>
        </div>
      </div>
    </Modal>
  );
}
