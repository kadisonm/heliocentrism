type EditorActionsProps = {
  onCancel: () => void;
  onSave: () => void;
  saveLabel: string;
};

export default function EditorActions({ onCancel, onSave, saveLabel }: EditorActionsProps) {
  return (
    <>
      <button type="button" className="editor-cancel" onClick={onCancel}>
        Cancel
      </button>
      <button type="button" className="editor-save" onClick={onSave}>
        {saveLabel}
      </button>
    </>
  );
}
