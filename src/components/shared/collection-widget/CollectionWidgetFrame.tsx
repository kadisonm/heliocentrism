'use client';

import { Plus } from 'lucide-react';
import { Fragment, useState, type CSSProperties, type ReactNode } from 'react';
import type { PaletteColor } from '../../../lib/types';
import ColorDot from '../../common/ColorDot';
import ConfirmDialog from '../../common/ConfirmDialog';
import SearchableSwitcher from '../../common/SearchableSwitcher';
import { useWidgetContext } from '../../grid/widgetContext';
import { paletteColorVar } from '../palette/paletteColor';

type CollectionItem = { id: string; name: string; color: PaletteColor };

export type CollectionModalState<T> = { mode: 'add'; seedName: string } | { mode: 'edit'; item: T };

// What renderModal gets: the open state (null = closed), plus helpers to close it and select a new item.
export type CollectionModalApi<T> = {
  state: CollectionModalState<T> | null;
  close: () => void;
  select: (id: string) => void;
};

type CollectionWidgetFrameProps<T extends CollectionItem> = {
  className: string;
  items: T[];
  isLoading: boolean;
  noun: string; // singular lowercase, e.g. "habit"
  title: string; // header shown while there are no items
  // Which DashboardWidget field remembers this widget's chosen item.
  selectionKey: 'selectedHabitId' | 'selectedGoalId';
  renderModal: (api: CollectionModalApi<T>) => ReactNode;
  onDelete: (item: T) => void;
  deleteMessage: (item: T) => string;
  // Renders the widget-specific view of the selected item.
  children: (item: T) => ReactNode;
};

// Shared shell for widgets that show one item from a user collection (habits, goals):
// switcher, create/edit/delete flows, and empty state. Exposes the item's colour as --item-color.
export default function CollectionWidgetFrame<T extends CollectionItem>({
  className,
  items,
  isLoading,
  noun,
  title,
  selectionKey,
  renderModal,
  onDelete,
  deleteMessage,
  children,
}: CollectionWidgetFrameProps<T>) {
  const { widget, onUpdate } = useWidgetContext();
  const [modalState, setModalState] = useState<CollectionModalState<T> | null>(null);
  const [pendingDelete, setPendingDelete] = useState<T | null>(null);

  const activeItem = items.find((item) => item.id === widget[selectionKey]) ?? items[0] ?? null;
  const colorStyle = activeItem ? ({ '--item-color': paletteColorVar(activeItem.color) } as CSSProperties) : undefined;
  const select = (id: string) => onUpdate({ [selectionKey]: id });
  // Remounts the modal per target so its form state re-seeds.
  const modalKey = modalState ? (modalState.mode === 'edit' ? modalState.item.id : `add-${modalState.seedName}`) : 'idle';

  return (
    <>
      <aside className="widget-content-shell">
        <div className={`widget-content collection-widget-frame ${className}`} style={colorStyle}>
          <div className="widget-content-header">
            {items.length > 0 ? (
              <SearchableSwitcher
                items={items}
                activeItem={activeItem}
                noun={noun}
                renderPrefix={(item) => <ColorDot color={paletteColorVar(item.color)} />}
                onSelect={select}
                onRequestDelete={setPendingDelete}
                onRequestCreate={(name) => setModalState({ mode: 'add', seedName: name })}
                onRequestEdit={(item) => setModalState({ mode: 'edit', item })}
              />
            ) : (
              <h2>{title}</h2>
            )}
          </div>

          {!isLoading &&
            (activeItem ? (
              <div className="collection-widget-frame__body">{children(activeItem)}</div>
            ) : (
              <div className="widget-empty-row">
                <p className="widget-empty">No {noun}s yet</p>
                <button
                  type="button"
                  className="widget-add-button"
                  onClick={() => setModalState({ mode: 'add', seedName: '' })}
                  title={`Create ${noun}`}
                  aria-label={`Create ${noun}`}
                >
                  <Plus size={14} />
                </button>
              </div>
            ))}
        </div>
      </aside>

      <Fragment key={modalKey}>{renderModal({ state: modalState, close: () => setModalState(null), select })}</Fragment>

      <ConfirmDialog
        isOpen={pendingDelete !== null}
        title={`Delete ${noun}?`}
        message={pendingDelete ? deleteMessage(pendingDelete) : ''}
        confirmLabel="Delete"
        danger
        onConfirm={() => {
          if (pendingDelete) onDelete(pendingDelete);
          setPendingDelete(null);
        }}
        onCancel={() => setPendingDelete(null)}
      />
    </>
  );
}
