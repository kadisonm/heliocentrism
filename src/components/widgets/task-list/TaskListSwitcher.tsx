'use client';

import { ChevronDown, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { type KeyboardEvent, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { TaskList } from '../../../lib/types';

const MIN_PANEL_WIDTH = 260;
const PANEL_WIDTH_PADDING = 40;

type PanelPosition = { top: number; left: number; width: number };

type TaskListSwitcherProps = {
  lists: TaskList[];
  activeList: TaskList | null;
  onSelect: (listId: string) => void;
  // Opens the confirm dialog — owned by index.tsx, matching how every
  // other modal in this widget is centrally managed there.
  onRequestDelete: (list: TaskList) => void;
  // Opens the create-list modal, pre-filled with the given name — owned by
  // index.tsx, same as onRequestDelete.
  onRequestCreate: (name: string) => void;
  // Opens the same modal in edit mode for an existing list — owned by
  // index.tsx, same as onRequestDelete.
  onRequestEdit: (list: TaskList) => void;
};

// A search-filterable replacement for the old plain <select>, styled as a
// real bordered trigger (matching every other <select>/input in the app)
// with a portaled dropdown panel — the app's first custom popover/combobox.
// Portaled to document.body for the same reason Modal and ContextMenu
// are: react-grid-layout positions widgets via CSS `transform`, which traps
// position: fixed descendants inside the widget's box otherwise.
export default function TaskListSwitcher({
  lists,
  activeList,
  onSelect,
  onRequestDelete,
  onRequestCreate,
  onRequestEdit,
}: TaskListSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [position, setPosition] = useState<PanelPosition | null>(null);
  const [mounted, setMounted] = useState(false);
  // Index into [...filteredLists, createRow] — the row Enter/arrow keys act
  // on. The create row is always the last index, so when filteredLists is
  // empty it's automatically index 0, i.e. the only (and thus highlighted)
  // row, satisfying "if there's no result, Add list must stay selected"
  // with no separate special-case branch.
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    /* eslint-disable-next-line react-hooks/set-state-in-effect */
    setMounted(true);
  }, []);

  // Outside-click-to-close, using DOM containment (closest()) rather than
  // relying on each row's onClick calling stopPropagation() — same
  // reasoning as index.tsx's activeToolbar listener (dnd-kit's
  // PointerSensor registers its own document-level click listener, and
  // stopPropagation() alone wasn't reliable against that). Both this
  // component's own wrapper class AND its panel's class are checked: the
  // panel is portaled to document.body, so it's a *sibling* of
  // .task-list-switcher in the DOM, not a descendant — checking only the
  // wrapper class would treat every click inside the open panel as
  // "outside" and close it mid-interaction.
  useEffect(() => {
    if (!isOpen) return;
    const handleDocumentClick = (event: globalThis.MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('.task-list-switcher, .task-list-switcher__panel')) return;
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

  const handleOptionKeyDown = (event: KeyboardEvent<HTMLDivElement>, listId: string) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect(listId);
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
  const filteredLists = normalizedQuery
    ? lists.filter((list) => list.name.toLowerCase().includes(normalizedQuery))
    : lists;
  // The create row is always the last item, so its index is filteredLists's
  // length regardless of how many (or how few) lists matched.
  const itemCount = filteredLists.length + 1;
  const createRowIndex = filteredLists.length;
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

  // Enter confirms whichever row is currently highlighted — the top search
  // result by default, or wherever Up/Down has since moved to. With zero
  // matches the create row is the only (and thus highlighted) row, so
  // Enter confirms that instead. Escape just closes the panel — no
  // selection, mirroring how Escape now cancels every Modal-based dialog.
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
        onSelect(filteredLists[clampedHighlightedIndex].id);
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
    <div className="task-list-switcher">
      <button
        type="button"
        ref={triggerRef}
        className="task-list-switcher__trigger"
        onClick={() => (isOpen ? setIsOpen(false) : openPanel())}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className="task-list-switcher__trigger-label">{activeList?.name ?? 'Select list'}</span>
        <ChevronDown size={14} />
      </button>

      {isOpen &&
        mounted &&
        position &&
        createPortal(
          <div
            ref={panelRef}
            className="task-list-switcher__panel"
            style={{ top: position.top, left: position.left, width: position.width }}
          >
            <div className="task-list-switcher__search">
              <Search size={13} />
              <input
                type="text"
                placeholder="Search lists"
                value={query}
                onChange={(event) => handleSearchChange(event.target.value)}
                onKeyDown={handleSearchKeyDown}
                autoFocus
              />
            </div>

            <div className="task-list-switcher__options" role="listbox">
              {filteredLists.length > 0 ? (
                filteredLists.map((list, index) => (
                  <div
                    key={list.id}
                    data-index={index}
                    role="option"
                    tabIndex={0}
                    aria-selected={list.id === activeList?.id}
                    className={[
                      'task-list-switcher__option',
                      list.id === activeList?.id && 'task-list-switcher__option--active',
                      index === clampedHighlightedIndex && 'task-list-switcher__option--highlighted',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    onClick={() => {
                      onSelect(list.id);
                      setIsOpen(false);
                    }}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    onKeyDown={(event) => handleOptionKeyDown(event, list.id)}
                  >
                    <span className="task-list-switcher__option-label">{list.name}</span>
                    <div className="task-list-switcher__row-actions">
                      <button
                        type="button"
                        className="task-list-switcher__icon-button"
                        onClick={(event) => {
                          // Plain React-internal bubbling within this row —
                          // stops the click from also reaching the row's
                          // own onClick above (which would select this
                          // list right as it's being edited/deleted).
                          // Unrelated to the dnd-kit/document-listener
                          // issue this component's outside-click effect
                          // works around.
                          event.stopPropagation();
                          onRequestEdit(list);
                        }}
                        title={`Edit ${list.name}`}
                        aria-label={`Edit ${list.name}`}
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        type="button"
                        className="task-list-switcher__icon-button task-list-switcher__icon-button--danger"
                        onClick={(event) => {
                          event.stopPropagation();
                          onRequestDelete(list);
                        }}
                        title={`Delete ${list.name}`}
                        aria-label={`Delete ${list.name}`}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="task-list-switcher__empty">No lists match &quot;{query}&quot;.</p>
              )}

              <div className="task-list-switcher__separator" />

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
                    ? 'task-list-switcher__option task-list-switcher__option--create task-list-switcher__option--highlighted'
                    : 'task-list-switcher__option task-list-switcher__option--create'
                }
                onClick={handleCreate}
                onMouseEnter={() => setHighlightedIndex(createRowIndex)}
                onKeyDown={handleCreateKeyDown}
              >
                <span className="task-list-switcher__option-label">
                  {trimmedQuery ? `Add "${trimmedQuery}"` : 'Add list'}
                </span>
                <span className="task-list-switcher__icon-slot">
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
