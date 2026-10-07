import type { PaletteColor } from '../../../lib/types';
import type { SwatchOption } from '../../common/SwatchPicker';

const PALETTE_COLORS: PaletteColor[] = ['red', 'orange', 'yellow', 'green', 'cyan', 'blue', 'purple', 'pink'];

export function paletteColorVar(color: PaletteColor): string {
  return `var(--color-${color})`;
}

export const PALETTE_COLOR_OPTIONS: SwatchOption<PaletteColor>[] = PALETTE_COLORS.map((color) => ({
  value: color,
  label: color[0].toUpperCase() + color.slice(1),
  color: paletteColorVar(color),
}));
