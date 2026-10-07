import type { GoalMeasure, PaletteColor } from '../types';

// Starting points offered when creating a goal; dates are filled in by the modal.
// Habit-linked templates pick a habit whose name matches `habitHint`, if one exists.
export type GoalTemplate = {
  name: string;
  color: PaletteColor;
  measure: GoalMeasure;
  habitHint?: string;
  // Deadline as days from today; omitted = open-ended.
  durationDays?: number;
};

const milestone = (title: string) => ({ id: crypto.randomUUID(), title, completedAt: null });

export const GOAL_TEMPLATES: GoalTemplate[] = [
  {
    name: 'Read 24 books this year',
    color: 'purple',
    measure: { type: 'numeric', start: 0, target: 24, unit: 'books', entries: [] },
    durationDays: 365,
  },
  {
    name: 'Save $5,000',
    color: 'green',
    measure: { type: 'numeric', start: 0, target: 5000, unit: '$', entries: [] },
    durationDays: 365,
  },
  {
    name: 'Run 500 km',
    color: 'red',
    measure: { type: 'habit', habitId: '', metric: 'total', target: 500 },
    habitHint: 'jog',
    durationDays: 365,
  },
  {
    name: 'Anki on 300 days',
    color: 'blue',
    measure: { type: 'habit', habitId: '', metric: 'days', target: 300 },
    habitHint: 'anki',
    durationDays: 365,
  },
  {
    name: 'Pass JLPT N5',
    color: 'pink',
    get measure(): GoalMeasure {
      return {
        type: 'milestones',
        milestones: ['Learn hiragana & katakana', 'Learn 100 kanji', 'Finish Genki I', 'Take a practice test', 'Sit the exam'].map(
          milestone
        ),
      };
    },
    durationDays: 180,
  },
  {
    name: 'Ship a project',
    color: 'orange',
    measure: { type: 'taskList', listId: '' },
    durationDays: 30,
  },
];
