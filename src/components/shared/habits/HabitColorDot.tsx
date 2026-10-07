import type { CSSProperties } from 'react';
import type { HabitColor } from '../../../lib/types';
import { habitColorVar } from './habitDisplay';

export default function HabitColorDot({ color }: { color: HabitColor }) {
  return <span className="habit-color-dot" style={{ '--habit-color': habitColorVar(color) } as CSSProperties} aria-hidden />;
}
