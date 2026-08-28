'use client';

import { useState } from 'react';
import { WIDGET_REGISTRY } from '../../lib/grid/widgetRegistry';
import Modal from '../common/Modal';

type AddWidgetModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (type: string) => void;
};

export default function AddWidgetModal({ isOpen, onClose, onSelect }: AddWidgetModalProps) {
  const [search, setSearch] = useState('');

  const results = WIDGET_REGISTRY.filter((widget) =>
    widget.name.toLowerCase().includes(search.trim().toLowerCase())
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Widget">
      <div className="settings-section">
        <input
          type="text"
          className="settings-input"
          placeholder="Search widgets..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          autoFocus
        />

        <div className="grid-widget-results">
          {results.length > 0 ? (
            results.map((widget) => (
              <button
                key={widget.type}
                type="button"
                className="grid-widget-result"
                onClick={() => onSelect(widget.type)}
              >
                <span className="grid-widget-result-name">{widget.name}</span>
                <span className="grid-widget-result-description">
                  {widget.description}
                </span>
              </button>
            ))
          ) : (
            <p className="settings-help">No widgets match &quot;{search}&quot;.</p>
          )}
        </div>
      </div>
    </Modal>
  );
}
