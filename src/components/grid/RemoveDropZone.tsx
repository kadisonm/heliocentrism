'use client';

import { forwardRef } from 'react';
import { Trash2 } from 'lucide-react';

// Rendered by Grid.tsx only while a widget drag is in flight — the drag
// engine hit-tests this element's own rect every frame (see removeZoneRef
// in Grid.tsx) to decide whether releasing here deletes the widget being
// dragged, and toggles `--armed` on it once the ghost is hovering over it.
const RemoveDropZone = forwardRef<HTMLDivElement>(function RemoveDropZone(_props, ref) {
  return (
    <div ref={ref} className="remove-drop-zone">
      <Trash2 size={16} />
      Remove
    </div>
  );
});

export default RemoveDropZone;
