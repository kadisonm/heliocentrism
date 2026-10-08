'use client';

import { Search } from 'lucide-react';
import { useState } from 'react';
import { searchBackgrounds } from '../../../lib/background';
import type { BackgroundVariant } from '../../../lib/types';
import Modal from '../../common/Modal';
import OptionCardPicker from '../../common/OptionCardPicker';
import { backgroundCard } from './backgroundCard';

type BackgroundPickerModalProps = {
  isOpen: boolean;
  value: BackgroundVariant;
  onSelect: (variant: BackgroundVariant) => void;
  onClose: () => void;
};

// Every background as a live swatch, searchable by name or mood ("calm", "retro", "grid"…).
export default function BackgroundPickerModal({ isOpen, value, onSelect, onClose }: BackgroundPickerModalProps) {
  const [query, setQuery] = useState('');
  const results = searchBackgrounds(query);

  const close = () => {
    setQuery('');
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={close} title="Backgrounds">
      <div className="settings-section">
        <label className="background-picker-modal__search">
          <Search size={14} />
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search backgrounds — e.g. calm, retro, grid"
            aria-label="Search backgrounds"
            autoFocus
          />
        </label>

        {results.length > 0 ? (
          <OptionCardPicker
            options={results.map(backgroundCard)}
            value={value}
            onChange={(variant) => {
              onSelect(variant);
              close();
            }}
            ariaLabel="Backgrounds"
          />
        ) : (
          <p className="settings-hint">No backgrounds match &quot;{query.trim()}&quot;.</p>
        )}
      </div>
    </Modal>
  );
}
