import type { TaskStageDef } from '../../../lib/types';

export function stageAriaLabel(stageDef: TaskStageDef, index: number): string {
  return stageDef.name || `stage ${index + 1}`;
}

export function isBlankStage(stageDef: TaskStageDef): boolean {
  return stageDef.name === '' && stageDef.color === 'none' && !stageDef.icon;
}

// CSS-only classification for the toggle's rounded-end styling.
export function getStagePosition(stage: number, stagesLength: number): 'start' | 'middle' | 'done' {
  if (stage === stagesLength - 1) return 'done';
  if (stage === 0) return 'start';
  return 'middle';
}
