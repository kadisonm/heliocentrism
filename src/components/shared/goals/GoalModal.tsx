'use client';

import { useState } from 'react';
import { addDaysToKey, toDateKey } from '../../../lib/dateKey';
import { GOAL_TEMPLATES, type GoalTemplate } from '../../../lib/goals/goalTemplates';
import { useAppSelector } from '../../../lib/store/hooks';
import type { Goal, GoalDraft, GoalMeasure, GoalMilestone, Habit, PaletteColor, TaskList } from '../../../lib/types';
import ChipList from '../../common/ChipList';
import Modal from '../../common/Modal';
import SettingsField from '../../common/SettingsField';
import SwatchPicker from '../../common/SwatchPicker';
import Tabs from '../../common/Tabs';
import { PALETTE_COLOR_OPTIONS } from '../palette/paletteColor';
import GoalMilestonesField from './GoalMilestonesField';

export type MeasureType = GoalMeasure['type'];

const MEASURE_TYPE_OPTIONS: { value: MeasureType; label: string }[] = [
  { value: 'milestones', label: 'Steps' },
  { value: 'numeric', label: 'Number' },
  { value: 'habit', label: 'Habit' },
  { value: 'taskList', label: 'Task list' },
];

const MEASURE_TYPE_HELP: Record<MeasureType, string> = {
  milestones: 'Break the goal into steps and tick them off.',
  numeric: 'Log amounts toward a target. Set the target below the start for goals that go down, like weight.',
  habit: "Progress comes from a habit's history — no extra logging.",
  taskList: 'Progress is the share of tasks completed in a list.',
};

const METRIC_OPTIONS = [
  { value: 'days', label: 'Days completed' },
  { value: 'total', label: 'Total amount logged' },
];

// Every type's fields are kept side by side so switching type while creating doesn't lose input.
// Numbers are held as strings so fields can be cleared while typing.
type FormState = {
  name: string;
  color: PaletteColor;
  type: MeasureType;
  milestones: GoalMilestone[];
  start: string;
  target: string;
  unit: string;
  habitId: string;
  metric: 'days' | 'total';
  habitTarget: string;
  listId: string;
  startDate: string;
  deadline: string; // '' = no deadline
  note: string;
};

function emptyForm(name: string, habits: Habit[], taskLists: TaskList[], type: MeasureType = 'milestones'): FormState {
  return {
    name,
    color: 'blue',
    type,
    milestones: [],
    start: '0',
    target: '',
    unit: '',
    habitId: habits[0]?.id ?? '',
    metric: 'days',
    habitTarget: '',
    listId: taskLists[0]?.id ?? '',
    startDate: toDateKey(new Date()),
    deadline: '',
    note: '',
  };
}

// Layers a goal (or template) over a base form, so only its own type's fields change.
function withMeasure(form: FormState, measure: GoalMeasure): FormState {
  switch (measure.type) {
    case 'milestones':
      return { ...form, type: 'milestones', milestones: measure.milestones };
    case 'numeric':
      return { ...form, type: 'numeric', start: String(measure.start), target: String(measure.target), unit: measure.unit };
    case 'habit':
      return {
        ...form,
        type: 'habit',
        habitId: measure.habitId || form.habitId,
        metric: measure.metric,
        habitTarget: String(measure.target),
      };
    case 'taskList':
      return { ...form, type: 'taskList', listId: measure.listId || form.listId };
  }
}

function fromGoal(goal: Goal, base: FormState): FormState {
  return withMeasure(
    { ...base, name: goal.name, color: goal.color, startDate: goal.startDate, deadline: goal.deadline ?? '', note: goal.note ?? '' },
    goal.measure
  );
}

function fromTemplate(template: GoalTemplate, base: FormState, habits: Habit[]): FormState {
  const hinted = template.habitHint && habits.find((habit) => habit.name.toLowerCase().includes(template.habitHint!));
  const form = withMeasure({ ...base, name: template.name, color: template.color }, template.measure);
  return {
    ...form,
    habitId: hinted ? hinted.id : form.habitId,
    deadline: template.durationDays ? addDaysToKey(base.startDate, template.durationDays) : '',
  };
}

function toMeasure(form: FormState): GoalMeasure | null {
  switch (form.type) {
    case 'milestones': {
      const milestones = form.milestones.filter((m) => m.title.trim()).map((m) => ({ ...m, title: m.title.trim() }));
      return milestones.length > 0 ? { type: 'milestones', milestones } : null;
    }
    case 'numeric': {
      const start = Number(form.start);
      const target = Number(form.target);
      if (form.target.trim() === '' || Number.isNaN(start) || Number.isNaN(target) || start === target) return null;
      // Entries are kept by the slice on edit; a new goal starts with none.
      return { type: 'numeric', start, target, unit: form.unit.trim(), entries: [] };
    }
    case 'habit': {
      const target = Number(form.habitTarget);
      return form.habitId && target > 0 ? { type: 'habit', habitId: form.habitId, metric: form.metric, target } : null;
    }
    case 'taskList':
      return form.listId ? { type: 'taskList', listId: form.listId } : null;
  }
}

// Null while the form can't produce a valid goal.
function toDraft(form: FormState): GoalDraft | null {
  const name = form.name.trim();
  const measure = toMeasure(form);
  if (!name || !measure || !form.startDate) return null;
  if (form.deadline && form.deadline < form.startDate) return null;
  return { name, color: form.color, measure, startDate: form.startDate, deadline: form.deadline || null, note: form.note.trim() || undefined };
}

type GoalModalProps = {
  isOpen: boolean;
  // Non-null while editing — read at mount only; the parent remounts via `key`.
  goal?: Goal | null;
  initialName?: string;
  initialType?: MeasureType;
  onClose: () => void;
  onSubmit: (draft: GoalDraft) => void;
};

export default function GoalModal({ isOpen, goal = null, initialName = '', initialType, onClose, onSubmit }: GoalModalProps) {
  const habits = useAppSelector((state) => state.habits.habits);
  const taskLists = useAppSelector((state) => state.taskLists.taskLists);
  const isEditing = goal !== null;
  const [form, setForm] = useState<FormState>(() => {
    const base = emptyForm(initialName, habits, taskLists, initialType);
    return goal ? fromGoal(goal, base) : base;
  });
  const draft = toDraft(form);
  const update = (patch: Partial<FormState>) => setForm((current) => ({ ...current, ...patch }));

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEditing ? 'Edit Goal' : 'New Goal'}>
      <form
        className="settings-section"
        onSubmit={(event) => {
          event.preventDefault();
          if (draft) onSubmit(draft);
        }}
      >
        {!isEditing && (
          <ChipList
            options={GOAL_TEMPLATES.map((template) => ({ value: template.name, label: template.name }))}
            onSelect={(name) =>
              setForm(fromTemplate(GOAL_TEMPLATES.find((t) => t.name === name)!, emptyForm('', habits, taskLists), habits))
            }
          />
        )}

        <SettingsField label="Name" value={form.name} onChange={(name) => update({ name })} placeholder="Goal name" />

        {/* Type is fixed once created so the goal's history keeps one meaning. */}
        {!isEditing && (
          <div className="settings-field">
            <label>Measured by</label>
            <Tabs options={MEASURE_TYPE_OPTIONS} value={form.type} onChange={(type) => update({ type })} ariaLabel="Goal type" />
            <p className="settings-hint">{MEASURE_TYPE_HELP[form.type]}</p>
          </div>
        )}

        {form.type === 'milestones' && (
          <GoalMilestonesField milestones={form.milestones} onChange={(milestones) => update({ milestones })} />
        )}

        {form.type === 'numeric' && (
          <div className="settings-field-row">
            <SettingsField label="Start" type="number" value={form.start} onChange={(start) => update({ start })} />
            <SettingsField label="Target" type="number" value={form.target} onChange={(target) => update({ target })} />
            <SettingsField label="Unit" value={form.unit} onChange={(unit) => update({ unit })} placeholder="e.g. books" />
          </div>
        )}

        {form.type === 'habit' &&
          (habits.length > 0 ? (
            <>
              <SettingsField
                label="Habit"
                type="select"
                value={form.habitId}
                options={habits.map((habit) => ({ value: habit.id, label: habit.name }))}
                onChange={(habitId) => update({ habitId })}
              />
              <div className="settings-field-row">
                <SettingsField
                  label="Count"
                  type="select"
                  value={form.metric}
                  options={METRIC_OPTIONS}
                  onChange={(metric) => update({ metric: metric as FormState['metric'] })}
                />
                <SettingsField label="Target" type="number" value={form.habitTarget} onChange={(habitTarget) => update({ habitTarget })} />
              </div>
            </>
          ) : (
            <p className="settings-hint">Create a habit first, then link it here.</p>
          ))}

        {form.type === 'taskList' &&
          (taskLists.length > 0 ? (
            <SettingsField
              label="Task list"
              type="select"
              value={form.listId}
              options={taskLists.map((list) => ({ value: list.id, label: list.name }))}
              onChange={(listId) => update({ listId })}
            />
          ) : (
            <p className="settings-hint">Create a task list first, then link it here.</p>
          ))}

        <div className="settings-field-row">
          <SettingsField label="Start date" type="date" value={form.startDate} onChange={(startDate) => update({ startDate })} />
          <SettingsField label="Deadline (optional)" type="date" value={form.deadline} onChange={(deadline) => update({ deadline })} />
        </div>

        <SettingsField
          label="Why it matters (optional)"
          type="textarea"
          value={form.note}
          onChange={(note) => update({ note })}
          placeholder="A reminder for the days it's hard"
        />

        <div className="settings-field">
          <label>Colour</label>
          <SwatchPicker options={PALETTE_COLOR_OPTIONS} value={form.color} onChange={(color) => update({ color })} ariaLabel="Goal colour" />
        </div>

        <div className="settings-actions">
          <button type="submit" className="settings-button settings-button-primary" disabled={!draft}>
            {isEditing ? 'Save' : 'Create Goal'}
          </button>
          <button type="button" className="settings-button" onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  );
}
