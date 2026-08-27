import type { BackgroundVariant } from './types';

// Extend as new background components are added under
// src/components/shared/background/.
export const BACKGROUND_VARIANTS: { id: BackgroundVariant; label: string }[] = [
  { id: 'none', label: 'None' },
  { id: 'space', label: 'Space' },
];
