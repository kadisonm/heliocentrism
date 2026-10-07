'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useWidgetContext } from '../../grid/widgetContext';

const SAVE_DELAY_MS = 400;

// This widget's note text, edited locally and saved to the widget after typing pauses.
// `flush` saves immediately (on blur/unmount) so a quick close doesn't drop the last edit.
export function useWidgetNote() {
  const { widget, onUpdate } = useWidgetContext();
  const [content, setDraft] = useState(widget.noteContent ?? '');
  const pendingRef = useRef<string | null>(null);
  const onUpdateRef = useRef(onUpdate);

  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  const flush = useCallback(() => {
    if (pendingRef.current === null) return;
    onUpdateRef.current({ noteContent: pendingRef.current });
    pendingRef.current = null;
  }, []);

  useEffect(() => {
    if (pendingRef.current === null) return;
    const timeoutId = setTimeout(flush, SAVE_DELAY_MS);
    return () => clearTimeout(timeoutId);
  }, [content, flush]);

  useEffect(() => flush, [flush]);

  const setContent = useCallback((value: string) => {
    pendingRef.current = value;
    setDraft(value);
  }, []);

  return { content, setContent, flush };
}
