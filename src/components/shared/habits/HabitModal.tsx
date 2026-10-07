'use client';

import { useState } from 'react';
import { HABIT_TEMPLATES } from '../../../lib/habits/habitTemplates';
import type { Habit, HabitColor, HabitDraft, HabitGoal } from '../../../lib/types';
import Modal from '../../common/Modal';
import SettingsField from '../../common/SettingsField';
import SwatchPicker from '../../common/SwatchPicker';
import Tabs from '../../common/Tabs';
import { HABIT_COLOR_OPTIONS } from './habitDisplay';

type GoalType = HabitGoal['type'];

const GOAL_TYPE_OPTIONS: { value: GoalType; label: string }[] = [
  { value: 'check', label: 'Checkbox' },
  { value: 'quantity', label: 'Amount' },
  { value: 'abstain', label: 'Abstain' },
];

const GOAL_TYPE_HELP: Record<GoalType, string> = {
  check: 'Tick it off once a day.',
  quantity: 'Log an amount each day — complete once it reaches the target.',
  abstain: 'Starts each day complete. Mark a slip if it happens.',
};

// Quantity numbers are held as strings so fields can be cleared while typing.
type FormState = {
  name: string;
  color: HabitColor;
  goalType: GoalType;
  target: string;
  unit: string;
  step: string;
};

function toFormState({ name, color, goal }: HabitDraft): FormState {
  const quantity = goal.type === 'quantity' ? goal : null;
  return {
    name,
    color,
    goalType: goal.type,
    target: String(quantity?.target ?? 1),
    unit: quantity?.unit ?? '',
    step: String(quantity?.step ?? 1),
  };
}

// Null while the form can't produce a valid habit.
function toDraft(form: FormState): HabitDraft | null {
  const name = form.name.trim();
  if (!name) return null;
  if (form.goalType !== 'quantity') return { name, color: form.color, goal: { type: form.goalType } };

  const target = Number(form.target);
  const step = Number(form.step);
  if (!(target > 0) || !(step > 0)) return null;
  return { name, color: form.color, goal: { type: 'quantity', target, unit: form.unit.trim(), step } };
}

type HabitModalProps = {
  isOpen: boolean;
  // Non-null while editing — read at mount only; the parent remounts via `key`.
  habit?: Habit | null;
  initialName?: string;
  onClose: () => void;
  onSubmit: (draft: HabitDraft) => void;
};

export default function HabitModal({ isOpen, habit = null, initialName = '', onClose, onSubmit }: HabitModalProps) {
  const isEditing = habit !== null;
  const [form, setForm] = useState<FormState>(() =>
    toFormState(habit ?? { name: initialName, color: 'blue', goal: { type: 'check' } })
  );
  const draft = toDraft(form);
  const update = (patch: Partial<FormState>) => setForm((current) => ({ ...current, ...patch }));

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEditing ? 'Edit Habit' : 'New Habit'}>
      <form
        className="settings-section"
        onSubmit={(event) => {
          event.preventDefault();
          if (draft) onSubmit(draft);
        }}
      >
        {!isEditing && (
          <div className="habit-modal__templates">
            {HABIT_TEMPLATES.map((template) => (
              <button
                key={template.name}
                type="button"
                className="habit-modal__template"
                onClick={() => setForm(toFormState(template))}
              >
                {template.name}
              </button>
            ))}
          </div>
        )}

        <SettingsField label="Name" value={form.name} onChange={(name) => update({ name })} placeholder="Habit name" />

        {/* Type is fixed once created so the habit's history keeps one meaning. */}
        {!isEditing && (
          <div className="settings-field">
            <label>Type</label>
            <Tabs
              options={GOAL_TYPE_OPTIONS}
              value={form.goalType}
              onChange={(goalType) => update({ goalType })}
              ariaLabel="Habit type"
            />
            <p className="habit-modal__help">{GOAL_TYPE_HELP[form.goalType]}</p>
          </div>
        )}

        {form.goalType === 'quantity' && (
          <div className="settings-field-row">
            <SettingsField label="Daily target" type="number" value={form.target} onChange={(target) => update({ target })} />
            <SettingsField label="Unit" value={form.unit} onChange={(unit) => update({ unit })} placeholder="e.g. km" />
            <SettingsField label="Step" type="number" value={form.step} onChange={(step) => update({ step })} />
          </div>
        )}

        <div className="settings-field">
          <label>Colour</label>
          <SwatchPicker
            options={HABIT_COLOR_OPTIONS}
            value={form.color}
            onChange={(color) => update({ color })}
            ariaLabel="Habit colour"
          />
        </div>

        <div className="settings-actions">
          <button type="submit" className="settings-button settings-button-primary" disabled={!draft}>
            {isEditing ? 'Save' : 'Create Habit'}
          </button>
          <button type="button" className="settings-button" onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  );
}
