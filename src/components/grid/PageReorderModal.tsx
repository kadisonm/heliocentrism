'use client';

import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';
import { Fragment, useState } from 'react';
import { MAX_PAGES_PER_BREAKPOINT } from '../../lib/grid/gridConfig';
import { findWidgetDefinition } from '../../lib/grid/widgetRegistry';
import { moveItem } from '../../lib/moveInArray';
import type { DashboardBreakpoint, DashboardBreakpointState, DashboardPage } from '../../lib/types';
import ConfirmDialog from '../common/ConfirmDialog';
import Modal from '../common/Modal';
import Tabs from '../common/Tabs';
import PageThumbnail from './PageThumbnail';

const BREAKPOINT_LABELS: Record<DashboardBreakpoint, string> = {
  desktop: 'Desktop',
  tablet: 'Tablet',
  mobile: 'Phone',
};

const NAMES_SHOWN = 2;

// "Task List, Clock +2" — enough to tell pages apart without overflowing the row.
function summarizeWidgets(page: DashboardPage): string {
  if (page.widgets.length === 0) return 'Empty';
  const names = page.widgets.map((widget) => findWidgetDefinition(widget.type)?.name ?? widget.type);
  const extra = names.length - NAMES_SHOWN;
  return names.slice(0, NAMES_SHOWN).join(', ') + (extra > 0 ? ` +${extra}` : '');
}

function deleteMessage(page: DashboardPage, number: number): string {
  const count = page.widgets.length;
  if (count === 0) return `Delete page ${number}? It's empty.`;
  return `Delete page ${number} and its ${count} widget${count === 1 ? '' : 's'}? This can't be undone.`;
}

type PageReorderModalProps = {
  isOpen: boolean;
  onClose: () => void;
  breakpoints: Record<DashboardBreakpoint, DashboardBreakpointState>;
  allowedBreakpoints: DashboardBreakpoint[];
  initialBreakpoint: DashboardBreakpoint; // read at mount; the parent remounts via `key`
  onReorder: (breakpoint: DashboardBreakpoint, pageIds: string[]) => void;
  onInsert: (breakpoint: DashboardBreakpoint, index: number) => void;
  onDelete: (breakpoint: DashboardBreakpoint, pageId: string) => void;
};

// Reorder, insert, and delete pages within one breakpoint's layout at a time; every change applies straight away.
export default function PageReorderModal({
  isOpen,
  onClose,
  breakpoints,
  allowedBreakpoints,
  initialBreakpoint,
  onReorder,
  onInsert,
  onDelete,
}: PageReorderModalProps) {
  const [breakpoint, setBreakpoint] = useState(initialBreakpoint);
  const [pendingDelete, setPendingDelete] = useState<{ page: DashboardPage; number: number } | null>(null);
  const pages = breakpoints[breakpoint].pages;
  const pageIds = pages.map((page) => page.id);
  const canInsert = pages.length < MAX_PAGES_PER_BREAKPOINT;

  // A divider that adds a blank page at `index` — shown before the first page and between pages, never after the last.
  const insertDivider = (index: number) =>
    canInsert && (
      <li className="page-reorder-modal__insert">
        <button type="button" onClick={() => onInsert(breakpoint, index)}>
          <Plus size={13} />
          Insert page
        </button>
      </li>
    );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Reorder pages">
      <div className="settings-section">
        {allowedBreakpoints.length > 1 && (
          <Tabs
            options={allowedBreakpoints.map((value) => ({ value, label: BREAKPOINT_LABELS[value] }))}
            value={breakpoint}
            onChange={setBreakpoint}
            ariaLabel="Layout to reorder"
          />
        )}

        <ol className="page-reorder-modal__list">
          {pages.map((page, index) => (
            <Fragment key={page.id}>
              {insertDivider(index)}
              <li className="page-reorder-modal__row">
                <PageThumbnail page={page} breakpoint={breakpoint} />
                <span className="page-reorder-modal__details">
                  <span className="page-reorder-modal__title">Page {index + 1}</span>
                  <span className="page-reorder-modal__summary">{summarizeWidgets(page)}</span>
                </span>
                <span className="page-reorder-modal__controls">
                  <button
                    type="button"
                    disabled={index === 0}
                    onClick={() => onReorder(breakpoint, moveItem(pageIds, index, -1))}
                    aria-label={`Move page ${index + 1} up`}
                    title="Move up"
                  >
                    <ChevronUp size={16} />
                  </button>
                  <button
                    type="button"
                    disabled={index === pages.length - 1}
                    onClick={() => onReorder(breakpoint, moveItem(pageIds, index, 1))}
                    aria-label={`Move page ${index + 1} down`}
                    title="Move down"
                  >
                    <ChevronDown size={16} />
                  </button>
                </span>
                <button
                  type="button"
                  className="page-reorder-modal__delete"
                  onClick={() => setPendingDelete({ page, number: index + 1 })}
                  aria-label={`Delete page ${index + 1}`}
                  title="Delete page"
                >
                  <Trash2 size={15} />
                </button>
              </li>
            </Fragment>
          ))}
        </ol>
        {!canInsert && <p className="settings-hint">This layout has the maximum of {MAX_PAGES_PER_BREAKPOINT} pages.</p>}
      </div>

      <ConfirmDialog
        isOpen={pendingDelete !== null}
        title="Delete page?"
        message={pendingDelete ? deleteMessage(pendingDelete.page, pendingDelete.number) : ''}
        confirmLabel="Delete"
        danger
        onConfirm={() => {
          if (pendingDelete) onDelete(breakpoint, pendingDelete.page.id);
          setPendingDelete(null);
        }}
        onCancel={() => setPendingDelete(null)}
      />
    </Modal>
  );
}
