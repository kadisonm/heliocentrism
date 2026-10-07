'use client';

import { Plus, X } from 'lucide-react';
import { useState } from 'react';
import type { GoalMilestone } from '../../../lib/types';

type GoalMilestonesFieldProps = {
  milestones: GoalMilestone[];
  onChange: (milestones: GoalMilestone[]) => void;
};

// Editable ordered list of a goal's steps; existing steps keep their completion state.
export default function GoalMilestonesField({ milestones, onChange }: GoalMilestonesFieldProps) {
  const [newTitle, setNewTitle] = useState('');

  const add = () => {
    const title = newTitle.trim();
    if (!title) return;
    onChange([...milestones, { id: crypto.randomUUID(), title, completedAt: null }]);
    setNewTitle('');
  };

  return (
    <div className="settings-field goal-milestones-field">
      <label>Steps</label>
      {milestones.map((milestone) => (
        <div key={milestone.id} className="goal-milestones-field__row">
          <input
            type="text"
            className="settings-input"
            value={milestone.title}
            onChange={(event) =>
              onChange(milestones.map((m) => (m.id === milestone.id ? { ...m, title: event.target.value } : m)))
            }
          />
          <button
            type="button"
            className="goal-milestones-field__icon-button"
            onClick={() => onChange(milestones.filter((m) => m.id !== milestone.id))}
            aria-label={`Remove ${milestone.title}`}
            title="Remove step"
          >
            <X size={14} />
          </button>
        </div>
      ))}
      <div className="goal-milestones-field__row">
        <input
          type="text"
          className="settings-input"
          value={newTitle}
          placeholder="Add a step"
          onChange={(event) => setNewTitle(event.target.value)}
          onKeyDown={(event) => {
            // Enter adds a step here instead of submitting the whole form.
            if (event.key === 'Enter') {
              event.preventDefault();
              add();
            }
          }}
        />
        <button
          type="button"
          className="goal-milestones-field__icon-button"
          onClick={add}
          disabled={!newTitle.trim()}
          aria-label="Add step"
          title="Add step"
        >
          <Plus size={14} />
        </button>
      </div>
    </div>
  );
}
