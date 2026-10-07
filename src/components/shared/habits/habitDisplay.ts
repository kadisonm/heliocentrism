import type { HabitColor } from '../../../lib/types';
import type { SwatchOption } from '../../common/SwatchPicker';

const HABIT_COLORS: HabitColor[] = ['red', 'orange', 'yellow', 'green', 'cyan', 'blue', 'purple', 'pink'];

export function habitColorVar(color: HabitColor): string {
  return `var(--color-${color})`;
}

export const HABIT_COLOR_OPTIONS: SwatchOption<HabitColor>[] = HABIT_COLORS.map((color) => ({
  value: color,
  label: color[0].toUpperCase() + color.slice(1),
  color: habitColorVar(color),
}));

// 10000 -> "10,000", 1.5 -> "1.5".
export function formatHabitAmount(value: number): string {
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}
