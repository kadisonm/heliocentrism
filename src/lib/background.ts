import type { BackgroundVariant } from './types';

export type BackgroundOption = {
  id: BackgroundVariant;
  label: string;
  keywords: string; // extra search terms for the "More backgrounds" picker
  featured?: boolean; // shown directly in settings; the rest live behind "More backgrounds"
  animated?: boolean; // moves on screen — flagged on its settings card
};

// Extend as new background components are added under src/components/shared/background/.
export const BACKGROUND_VARIANTS: BackgroundOption[] = [
  { id: 'none', label: 'None', keywords: 'plain solid flat', featured: true },
  { id: 'space', label: 'Space', keywords: 'stars starfield night', featured: true, animated: true },
  { id: 'orbits', label: 'Orbits', keywords: 'planets sun solar system', featured: true, animated: true },
  { id: 'nebula', label: 'Nebula', keywords: 'clouds space colour', featured: true, animated: true },
  { id: 'image', label: 'Image', keywords: 'photo picture custom wallpaper url gif', featured: true },
  { id: 'lava-lamp', label: 'Lava lamp', keywords: 'blobs retro playful', animated: true },
  { id: 'waves', label: 'Flowing waves', keywords: 'lines ripple sound calm', animated: true },
  { id: 'bokeh', label: 'Bokeh', keywords: 'lights blur circles city', animated: true },
  { id: 'dot-grid', label: 'Dot grid', keywords: 'minimal focus dots' },
  { id: 'graph-paper', label: 'Graph paper', keywords: 'minimal focus grid lines drafting' },
  { id: 'topographic', label: 'Topographic', keywords: 'map contour lines minimal' },
  { id: 'synthwave', label: 'Synthwave', keywords: 'retro neon grid sunset 80s', animated: true },
  { id: 'pixel-sky', label: 'Pixel sky', keywords: 'retro pixel art game night stars clouds', animated: true },
  { id: 'matrix', label: 'Matrix rain', keywords: 'code characters falling hacker green', animated: true },
];

export function searchBackgrounds(query: string): BackgroundOption[] {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return BACKGROUND_VARIANTS;
  return BACKGROUND_VARIANTS.filter((option) => {
    const motion = option.animated ? 'animated moving' : 'static still';
    const haystack = `${option.label} ${option.keywords} ${motion}`.toLowerCase();
    return terms.every((term) => haystack.includes(term));
  });
}
