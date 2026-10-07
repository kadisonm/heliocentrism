// Lets any widget ask the dashboard grid to bring a task into view, without the two knowing about each other.
// Grid subscribes once; widgets call requestTaskFocus.

export type TaskFocusRequest = { taskId: string; listId: string };

let listener: ((request: TaskFocusRequest) => void) | null = null;

export function onTaskFocusRequest(handler: (request: TaskFocusRequest) => void): () => void {
  listener = handler;
  return () => {
    if (listener === handler) listener = null;
  };
}

export function requestTaskFocus(request: TaskFocusRequest) {
  listener?.(request);
}

const FIND_RETRY_MS = 100;
const FIND_ATTEMPTS = 25;

// Scrolls the task's row (on the active page) into view and blinks its outline.
// Retries briefly because the row only becomes "active" once a page slide settles.
export function blinkTaskRow(taskId: string) {
  let attempts = 0;
  const tryFind = () => {
    const row = document.querySelector<HTMLElement>(`.grid-page-slot--active [data-row-id="${CSS.escape(taskId)}"]`);
    if (!row) {
      if (++attempts < FIND_ATTEMPTS) setTimeout(tryFind, FIND_RETRY_MS);
      return;
    }
    row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    // A data attribute rather than a class, so React re-rendering the row's className can't cut it short.
    row.removeAttribute('data-focus-blink');
    void row.offsetWidth; // restart the animation if it's already playing
    row.setAttribute('data-focus-blink', '');
    const handleEnd = (event: AnimationEvent) => {
      if (event.target !== row) return;
      row.removeAttribute('data-focus-blink');
      row.removeEventListener('animationend', handleEnd);
    };
    row.addEventListener('animationend', handleEnd);
  };
  tryFind();
}
