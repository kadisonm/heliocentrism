import type { HabitDraft } from '../types';

// One-tap starting points offered when creating a habit.
export const HABIT_TEMPLATES: HabitDraft[] = [
  { name: 'Do Anki', color: 'blue', goal: { type: 'check' } },
  { name: 'Wake up at 9 am', color: 'yellow', goal: { type: 'check' } },
  { name: 'Reach 10,000 steps', color: 'green', goal: { type: 'quantity', target: 10000, unit: 'steps', step: 1000 } },
  { name: 'Brush teeth', color: 'cyan', goal: { type: 'quantity', target: 2, unit: 'times', step: 1 } },
  { name: 'Walk dog', color: 'orange', goal: { type: 'check' } },
  { name: 'Jog', color: 'red', goal: { type: 'quantity', target: 2, unit: 'km', step: 0.5 } },
  { name: 'Drink water', color: 'cyan', goal: { type: 'quantity', target: 8, unit: 'glasses', step: 1 } },
  { name: 'Read', color: 'purple', goal: { type: 'quantity', target: 20, unit: 'pages', step: 5 } },
  { name: 'Meditate', color: 'pink', goal: { type: 'quantity', target: 10, unit: 'min', step: 5 } },
  { name: 'No junk food', color: 'orange', goal: { type: 'abstain' } },
];
