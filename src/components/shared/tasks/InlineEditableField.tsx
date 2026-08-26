import { Pilcrow } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

// Click-to-edit text for title/description. One persistent <textarea> for
// its whole lifespan — toggles readOnly/tabIndex rather than swapping
// element types, avoiding an unmount/remount. Always <textarea> (never
// <input>) so it can wrap multi-line text and take Shift+Enter newlines.
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

  // Re-measures on every displayed value change, not just while typing —
  // a <textarea> needs its height set by hand for text at rest too,
  // unlike the old <button> which got this for free from wrapping.
  useEffect(() => {
    measure();
  }, [displayValue, measure]);

  // Re-measures when the web font finishes loading (fallback font metrics
  // can wrap differently) and on any width change via ResizeObserver —
  // both can change wrapping at the same displayValue without retriggering
  // the effect above.
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

  // Always rendered as this same wrapper — never swapped for a bare
  // <textarea> based on isPlaceholder. Switching root element type on
  // click caused React to unmount/remount mid-click, detaching the node
  // before index.tsx's click-outside listener ran, which then cleared edit mode.
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
