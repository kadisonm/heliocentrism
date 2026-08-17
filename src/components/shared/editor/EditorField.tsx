import type { ReactNode } from 'react';

type EditorFieldProps = {
  label: string;
  // 'label' wraps a single form control (Title, Description, ...); 'div' is
  // for a field that isn't one control (e.g. the subtask list).
  as?: 'label' | 'div';
  children: ReactNode;
};

export default function EditorField({ label, as = 'label', children }: EditorFieldProps) {
  if (as === 'div') {
    return (
      <div className="editor-field">
        <span>{label}</span>
        {children}
      </div>
    );
  }

  return (
    <label className="editor-field">
      <span>{label}</span>
      {children}
    </label>
  );
}
