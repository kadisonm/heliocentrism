'use client';

import { ChevronDown, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { type KeyboardEvent, type ReactNode, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const MIN_PANEL_WIDTH = 260;
const PANEL_WIDTH_PADDING = 40;

type PanelPosition = { top: number; left: number; width: number };

export type SwitcherItem = { id: string; name: string };

type SearchableSwitcherProps<T extends SwitcherItem> = {
  items: T[];
  activeItem: T | null;
  // Singular lowercase name of what's being switched ("list", "habit") — used in labels.
  noun: string;
  onSelect: (id: string) => void;
  // The request callbacks open modals owned by the parent widget.
  onRequestDelete: (item: T) => void;
  onRequestCreate: (name: string) => void;
  onRequestEdit: (item: T) => void;
  // Optional leading adornment per row and on the trigger (e.g. a colour dot).
  renderPrefix?: (item: T) => ReactNode;
};

// Search-filterable replacement for a plain <select>, with a portaled dropdown
// panel. Portaled to document.body because react-grid-layout's CSS `transform`
// traps position: fixed descendants inside the widget's box otherwise.
export default function SearchableSwitcher<T extends SwitcherItem>({
  items,
  activeItem,
  noun,
  onSelect,
  onRequestDelete,
  onRequestCreate,
  onRequestEdit,
  renderPrefix,
}: SearchableSwitcherProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [position, setPosition] = useState<PanelPosition | null>(null);
  const [mounted, setMounted] = useState(false);
  // Index into [...filteredItems, createRow]; when filteredItems is empty
  // this naturally lands on the create row with no special-case branch.
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    /* eslint-disable-next-line react-hooks/set-state-in-effect */
    setMounted(true);
  }, []);

  // Outside-click-to-close via DOM containment (dnd-kit's own document
  // listener makes stopPropagation() unreliable). Checks both the wrapper
  // and panel classes since the panel is portaled to document.body and so
  // is a DOM sibling, not a descendant, of the wrapper.
  useEffect(() => {
    if (!isOpen) return;
    const handleDocumentClick = (event: globalThis.MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('.searchable-switcher, .searchable-switcher__panel')) return;
      setIsOpen(false);
    };
    document.addEventListener('click', handleDocumentClick);
    return () => document.removeEventListener('click', handleDocumentClick);
  }, [isOpen]);

  const openPanel = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) {
      setPosition({ top: rect.bottom + 4, left: rect.left, width: Math.max(rect.width + PANEL_WIDTH_PADDING, MIN_PANEL_WIDTH) });
    }
    setQuery('');
    setHighlightedIndex(0);
    setIsOpen(true);
  };

  const handleOptionKeyDown = (event: KeyboardEvent<HTMLDivElement>, id: string) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect(id);
      setIsOpen(false);
    }
  };

  const handleCreate = () => {
    onRequestCreate(query.trim());
    setIsOpen(false);
  };

  const handleCreateKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleCreate();
    }
  };

  const trimmedQuery = query.trim();
  const normalizedQuery = trimmedQuery.toLowerCase();
  const filteredItems = normalizedQuery
    ? items.filter((item) => item.name.toLowerCase().includes(normalizedQuery))
    : items;
  // The create row is always last, so its index is filteredItems's length.
  const itemCount = filteredItems.length + 1;
  const createRowIndex = filteredItems.length;
  const clampedHighlightedIndex = Math.min(highlightedIndex, itemCount - 1);

  // Keeps whatever row is highlighted scrolled into view as arrow keys move
  // past the panel's own scrollable overflow.
  useEffect(() => {
    if (!isOpen) return;
    const row = panelRef.current?.querySelector(`[data-index="${clampedHighlightedIndex}"]`);
    row?.scrollIntoView({ block: 'nearest' });
  }, [isOpen, clampedHighlightedIndex]);

  const handleSearchChange = (value: string) => {
    setQuery(value);
    // A fresh query invalidates the previous highlight position — jump back
    // to the top result (or, with zero matches, the now-sole create row).
    setHighlightedIndex(0);
  };

  // Enter confirms the highlighted row (top result, or wherever Up/Down
  // moved to; falls back to the create row when there are zero matches).
  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlightedIndex((index) => Math.min(index + 1, itemCount - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlightedIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (clampedHighlightedIndex < createRowIndex) {
        onSelect(filteredItems[clampedHighlightedIndex].id);
        setIsOpen(false);
      } else {
        handleCreate();
      }
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setIsOpen(false);
    }
  };

  return (
    <div className="searchable-switcher">
      <button
        type="button"
        ref={triggerRef}
        className="searchable-switcher__trigger"
        onClick={() => (isOpen ? setIsOpen(false) : openPanel())}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        {activeItem && renderPrefix?.(activeItem)}
        <span className="searchable-switcher__trigger-label">{activeItem?.name ?? `Select ${noun}`}</span>
        <ChevronDown size={14} />
      </button>

      {isOpen &&
        mounted &&
        position &&
        createPortal(
          <div
            ref={panelRef}
            className="searchable-switcher__panel"
            style={{ top: position.top, left: position.left, width: position.width }}
          >
            <div className="searchable-switcher__search">
              <Search size={13} />
              <input
                type="text"
                placeholder={`Search ${noun}s`}
                value={query}
                onChange={(event) => handleSearchChange(event.target.value)}
                onKeyDown={handleSearchKeyDown}
                autoFocus
              />
            </div>

            <div className="searchable-switcher__options" role="listbox">
              {filteredItems.length > 0 ? (
                filteredItems.map((item, index) => (
                  <div
                    key={item.id}
                    data-index={index}
                    role="option"
                    tabIndex={0}
                    aria-selected={item.id === activeItem?.id}
                    className={[
                      'searchable-switcher__option',
                      item.id === activeItem?.id && 'searchable-switcher__option--active',
                      index === clampedHighlightedIndex && 'searchable-switcher__option--highlighted',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    onClick={() => {
                      onSelect(item.id);
                      setIsOpen(false);
                    }}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    onKeyDown={(event) => handleOptionKeyDown(event, item.id)}
                  >
                    {renderPrefix?.(item)}
                    <span className="searchable-switcher__option-label">{item.name}</span>
                    <div className="searchable-switcher__row-actions">
                      <button
                        type="button"
                        className="searchable-switcher__icon-button"
                        onClick={(event) => {
                          // Keep the row's own onClick from selecting this item too.
                          event.stopPropagation();
                          onRequestEdit(item);
                        }}
                        title={`Edit ${item.name}`}
                        aria-label={`Edit ${item.name}`}
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        type="button"
                        className="searchable-switcher__icon-button searchable-switcher__icon-button--danger"
                        onClick={(event) => {
                          event.stopPropagation();
                          onRequestDelete(item);
                        }}
                        title={`Delete ${item.name}`}
                        aria-label={`Delete ${item.name}`}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="searchable-switcher__empty">
                  No {noun}s match &quot;{query}&quot;.
                </p>
              )}

              <div className="searchable-switcher__separator" />

              {/* Always last, regardless of search — never filtered out. When
                  nothing matches the search, this is the only row, so it's
                  automatically the highlighted one (see clampedHighlightedIndex). */}
              <div
                data-index={createRowIndex}
                role="option"
                tabIndex={0}
                aria-selected={clampedHighlightedIndex === createRowIndex}
                className={
                  clampedHighlightedIndex === createRowIndex
                    ? 'searchable-switcher__option searchable-switcher__option--create searchable-switcher__option--highlighted'
                    : 'searchable-switcher__option searchable-switcher__option--create'
                }
                onClick={handleCreate}
                onMouseEnter={() => setHighlightedIndex(createRowIndex)}
                onKeyDown={handleCreateKeyDown}
              >
                <span className="searchable-switcher__option-label">
                  {trimmedQuery ? `Add "${trimmedQuery}"` : `Add ${noun}`}
                </span>
                <span className="searchable-switcher__icon-slot">
                  <Plus size={13} />
                </span>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
