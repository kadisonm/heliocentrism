'use client';

import { useEffect, useRef, useState, type MouseEvent } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { LONG_PRESS_MS } from '../../grid/useLongPress';
import { useWidgetNote } from './useWidgetNote';

type NotepadProps = {
  // Renders the note as GitHub-flavoured markdown, switching to the editor only while focused.
  markdown?: boolean;
};

// Full-widget note editor; the content is stored on this widget instance.
export default function Notepad({ markdown = false }: NotepadProps) {
  const { content, setContent, flush } = useWidgetNote();
  const [isEditing, setIsEditing] = useState(false);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const pressStartRef = useRef(0);
  const isPreview = markdown && !isEditing;

  // Entering edit mode from the preview: focus with the caret at the end.
  useEffect(() => {
    const editor = editorRef.current;
    if (!markdown || !isEditing || !editor) return;
    editor.focus();
    editor.setSelectionRange(editor.value.length, editor.value.length);
  }, [markdown, isEditing]);

  // Skips clicks that were really something else: a link, a text selection, or a long-press release.
  const handlePreviewClick = (event: MouseEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest('a')) return;
    if (window.getSelection()?.toString()) return;
    if (Date.now() - pressStartRef.current >= LONG_PRESS_MS) return;
    setIsEditing(true);
  };

  return (
    <div className={markdown ? 'notepad notepad--markdown' : 'notepad'}>
      {isPreview ? (
        <div
          className="notepad__preview"
          onMouseDown={() => (pressStartRef.current = Date.now())}
          onTouchStart={() => (pressStartRef.current = Date.now())}
          onClick={handlePreviewClick}
        >
          {content.trim() ? (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{ a: (props) => <a {...props} target="_blank" rel="noreferrer" /> }}
            >
              {content}
            </ReactMarkdown>
          ) : (
            <p className="widget-empty">Click to write markdown…</p>
          )}
        </div>
      ) : (
        <textarea
          ref={editorRef}
          className="notepad__editor"
          value={content}
          onChange={(event) => setContent(event.target.value)}
          onBlur={() => {
            flush();
            setIsEditing(false);
          }}
          placeholder={markdown ? 'Write markdown…' : 'Write something…'}
          spellCheck
        />
      )}
    </div>
  );
}
