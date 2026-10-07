'use client';

import { Undo2 } from 'lucide-react';
import { useState } from 'react';
import { parseDateKey } from '../../../lib/dateKey';
import { isGoalLinkMissing } from '../../../lib/goals/goalProgress';
import NumberStepper from '../../common/NumberStepper';
import { formatGoalAmount, goalLinkLabel } from './goalDisplay';
import type { GoalViewProps } from './GoalWidgetFrame';
import { useGoals } from './useGoals';

// Logging for numeric goals; linked goals show where their progress comes from instead.
export default function GoalQuickLog({ goal, sources, today }: GoalViewProps) {
  const { logGoalEntry, deleteGoalEntry } = useGoals();
  const [amount, setAmount] = useState(1);
  const linkLabel = goalLinkLabel(goal, sources);
  const { measure } = goal;

  if (linkLabel) {
    const missing = isGoalLinkMissing(goal, sources);
    return <p className={missing ? 'goal-quick-log__link goal-quick-log__link--missing' : 'goal-quick-log__link'}>{linkLabel}</p>;
  }
  if (measure.type !== 'numeric') return null;

  // Amounts are entered as positive numbers and move the value toward the target.
  const direction = measure.target < measure.start ? -1 : 1;
  const lastEntry = measure.entries.at(-1);
  const lastEntryLabel = lastEntry
    ? `Undo last entry (${lastEntry.amount > 0 ? '+' : '−'}${formatGoalAmount(Math.abs(lastEntry.amount), measure.unit)} on ${parseDateKey(
        lastEntry.date
      ).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })})`
    : '';

  return (
    <div className="goal-quick-log">
      <NumberStepper value={amount} onChange={setAmount} ariaLabel="Amount to log" />
      {measure.unit && <span className="goal-quick-log__unit">{measure.unit}</span>}
      <button
        type="button"
        className="goal-quick-log__log"
        disabled={amount <= 0}
        onClick={() => logGoalEntry(goal.id, today, amount * direction)}
      >
        Log
      </button>
      {lastEntry && (
        <button
          type="button"
          className="goal-quick-log__undo"
          onClick={() => deleteGoalEntry(goal.id, lastEntry.id)}
          title={lastEntryLabel}
          aria-label={lastEntryLabel}
        >
          <Undo2 size={14} />
        </button>
      )}
    </div>
  );
}
