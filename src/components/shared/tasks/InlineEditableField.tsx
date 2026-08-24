import { Pilcrow } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

// Click-to-edit text used for both task/subtask title and description. One
// persistent <textarea> for its whole lifespan — entering/leaving edit mode
// toggles `readOnly`/`tabIndex` on that same node rather than swapping
// between a <button> and a <textarea>, so there's no unmount/remount in
// between. Always a <textarea> (never <input>) so it can wrap multi-line
// text while typing and so Shift+Enter has somewhere to put a real newline.
type InlineEditableFieldProps = {
  value: string;
  // Shown in place of an empty value, and what makes an empty field
  // clickable to start editing at all.
  placeholder?: string;
  className: string;
  ariaLabel: string;
  // Title can't be blanked; description can, since that's what brings the
  // placeholder back.
  allowEmpty?: boolean;
  // Description-only: the Pilcrow icon shown before the placeholder.
  showPlaceholderIcon?: boolean;
  onCommit: (value: string) => void;
  // Fired when editing starts (not on commit) — lets the row switch itself
  // into "edit mode" (see isEditingRow in TaskRow.tsx).
  onEditStart?: () => void;
};

export default function InlineEditableField({
  value,
  placeholder,
  className,
  ariaLabel,
  allowEmpty = false,
  showPlaceholderIcon = false,
  onCommit,
  onEditStart,
}: InlineEditableFieldProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const isPlaceholder = !isEditing && !value && placeholder !== undefined;
  const displayValue = isEditing ? draft : value || placeholder || '';

  const commit = () => {
    setIsEditing(false);
    const trimmed = draft.trim();
    if (!trimmed && !allowEmpty) return; // silently keep the old value rather than blank it
    if (trimmed !== value) onCommit(trimmed);
  };

  const startEditing = () => {
    if (isEditing) return;
    setDraft(value);
    setIsEditing(true);
    onEditStart?.();
  };

  // JS fallback for browsers without native `field-sizing: content` (see
  // .task-item__editable-trigger in task-item.scss, which handles this
  // with zero JS and zero staleness risk on browsers that support it —
  // everything below exists only for the ones that don't yet).
  const measure = useCallback(() => {
    const node = textareaRef.current;
    if (!node) return;
    node.style.height = 'auto';
    node.style.height = `${node.scrollHeight}px`;
  }, []);

  // Re-measures on every DISPLAYED value change, whether typed or not — a
  // multi-line title/description needs its full height even at rest, not
  // just while being actively edited (a plain <button> used to get this
  // for free from natural text wrapping; a <textarea> needs it done by
  // hand).
  useEffect(() => {
    measure();
  }, [displayValue, measure]);

  // Two things can make a LATER render at the SAME displayValue need a
  // different height than what got measured above, without anything
  // re-triggering that effect (displayValue itself never changed):
  //  1. The web font (see next/font/google in layout.tsx) still loading at
  //     the moment of the first measurement — that measurement reflects
  //     the FALLBACK font's metrics, which, if just slightly wider, can
  //     wrap a line the real font wouldn't. Caught once, when loading
  //     actually finishes.
  //  2. The textarea's own rendered WIDTH settling later than the first
  //     measurement — e.g. sidebar/grid layout still resolving, or the
  //     widget itself being resized — which can change how many lines the
  //     same text needs. Caught continuously via ResizeObserver, watching
  //     the textarea's own box rather than a parent, so this can't ever
  //     feed back into itself (nothing here ever changes ITS width, only
  //     its height).
  useEffect(() => {
    const node = textareaRef.current;
    if (!node) return;
    let cancelled = false;

    if (typeof document !== 'undefined' && document.fonts) {
      document.fonts.ready.then(() => {
        if (!cancelled) measure();
      });
    }

    if (typeof ResizeObserver === 'undefined') return () => { cancelled = true; };
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [measure]);

  // Focus + select on entering edit mode. autoFocus only fires once, at
  // mount — no help here, since this is the SAME node for the field's
  // whole lifetime, never swapped in fresh.
  useEffect(() => {
    if (isEditing) textareaRef.current?.select();
  }, [isEditing]);

  const field = (
    <textarea
      ref={textareaRef}
      className={`${className} task-item__editable-trigger ${isPlaceholder ? 'task-item__editable-trigger--placeholder' : ''}`}
      value={displayValue}
      aria-label={ariaLabel}
      rows={1}
      readOnly={!isEditing}
      // Out of the tab order while just displaying text, same as the old
      // trigger <button> only ever being reachable through its own natural
      // tabbability — otherwise every task's title/description would
      // clutter the tab sequence even while merely browsing the list.
      tabIndex={isEditing ? undefined : -1}
      onClick={(event) => {
        event.stopPropagation();
        startEditing();
      }}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => {
        if (isEditing) commit();
      }}
      onKeyDown={(event) => {
        if (!isEditing) return;
        if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault();
          commit();
        } else if (event.key === 'Escape') {
          event.preventDefault();
          setDraft(value);
          setIsEditing(false);
        }
        // Shift+Enter falls through to insert a real newline.
      }}
    />
  );

  if (!showPlaceholderIcon) return field;

  // Height-collapse wrapper (see .task-item__description-reveal) — for a
  // field that CAN show a placeholder icon, this wrapper is ALWAYS
  // present, in every state, rather than only conditionally when currently
  // showing the empty placeholder. Only the icon and the wrapper's own
  // --visible modifier vary; the ROOT ELEMENT TYPE this component returns
  // never changes across a re-render.
  //
  // That's deliberate, not incidental: the earlier version returned EITHER
  // a bare <textarea> OR this wrapped version depending on isPlaceholder —
  // and clicking the (wrapped) placeholder sets isEditing=true in the same
  // render that flips isPlaceholder back to false, which flips which of
  // the two shapes gets returned. React unmounts the old tree and mounts a
  // fresh one whenever a component's OWN root element type changes, so the
  // very <textarea> DOM node that was just clicked got torn down and
  // replaced mid-click — detaching the click event's `target` from the
  // document before index.tsx's document-level "click outside" listener
  // ran its closest('.task-item') check, which then (correctly, given a
  // detached node) found no such ancestor and cleared edit mode right back
  // off. Keeping one stable shape here removes that unmount entirely.
  return (
    <div className={`task-item__description-reveal${isPlaceholder ? '' : ' task-item__description-reveal--visible'}`}>
      <div className="task-item__description-reveal-inner">
        {isPlaceholder && (
          <Pilcrow
            size={12}
            className="task-item__description-icon"
            onClick={(event) => {
              event.stopPropagation();
              startEditing();
            }}
          />
        )}
        {field}
      </div>
    </div>
  );
}
