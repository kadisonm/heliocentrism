import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { DEFAULT_GOALS } from '../data';
import { readGoals } from '../firebase/firebaseSync';
import { nextOrder } from '../tasks/reorder';
import type { Goal, GoalDraft } from '../types';
import type { AppDispatch } from './store';

export type GoalsState = {
  goals: Goal[];
  isLoading: boolean;
};

const initialState: GoalsState = {
  goals: DEFAULT_GOALS,
  isLoading: true,
};

let hasStartedLoad = false;

export const loadGoals = createAsyncThunk('goals/load', async () => (await readGoals()) ?? DEFAULT_GOALS);

export function ensureGoalsLoaded(dispatch: AppDispatch) {
  if (hasStartedLoad) return;
  hasStartedLoad = true;
  dispatch(loadGoals());
}

const goalsSlice = createSlice({
  name: 'goals',
  initialState,
  reducers: {
    // id is generated in `prepare` so callers get it back synchronously (e.g. to select the new goal).
    createGoal: {
      reducer: (state, action: PayloadAction<{ id: string; createdAt: string; draft: GoalDraft }>) => {
        const { id, createdAt, draft } = action.payload;
        state.goals.push({ ...draft, id, createdAt, order: nextOrder(state.goals) });
      },
      prepare: (draft: GoalDraft) => ({
        payload: { id: crypto.randomUUID(), createdAt: new Date().toISOString(), draft },
      }),
    },

    // Measure type is locked after creation; a numeric goal keeps its logged entries whatever the form sent.
    updateGoal: (state, action: PayloadAction<{ goalId: string; draft: GoalDraft }>) => {
      const { goalId, draft } = action.payload;
      const goal = state.goals.find((g) => g.id === goalId);
      if (!goal || draft.measure.type !== goal.measure.type) return;
      const measure =
        draft.measure.type === 'numeric' && goal.measure.type === 'numeric'
          ? { ...draft.measure, entries: goal.measure.entries }
          : draft.measure;
      Object.assign(goal, draft, { measure });
    },

    deleteGoal: (state, action: PayloadAction<{ goalId: string }>) => {
      state.goals = state.goals.filter((goal) => goal.id !== action.payload.goalId);
    },

    toggleMilestone: (state, action: PayloadAction<{ goalId: string; milestoneId: string }>) => {
      const { goalId, milestoneId } = action.payload;
      const measure = state.goals.find((g) => g.id === goalId)?.measure;
      if (measure?.type !== 'milestones') return;
      const milestone = measure.milestones.find((m) => m.id === milestoneId);
      if (milestone) milestone.completedAt = milestone.completedAt ? null : new Date().toISOString();
    },

    logGoalEntry: {
      reducer: (state, action: PayloadAction<{ id: string; goalId: string; date: string; amount: number }>) => {
        const { id, goalId, date, amount } = action.payload;
        const measure = state.goals.find((g) => g.id === goalId)?.measure;
        if (measure?.type === 'numeric' && amount !== 0) measure.entries.push({ id, date, amount });
      },
      prepare: (goalId: string, date: string, amount: number) => ({
        payload: { id: crypto.randomUUID(), goalId, date, amount },
      }),
    },

    deleteGoalEntry: (state, action: PayloadAction<{ goalId: string; entryId: string }>) => {
      const { goalId, entryId } = action.payload;
      const measure = state.goals.find((g) => g.id === goalId)?.measure;
      if (measure?.type === 'numeric') measure.entries = measure.entries.filter((entry) => entry.id !== entryId);
    },
  },
  extraReducers: (builder) => {
    builder.addCase(loadGoals.fulfilled, (state, action) => {
      state.goals = action.payload;
      state.isLoading = false;
    });
  },
});

export const { createGoal, updateGoal, deleteGoal, toggleMilestone, logGoalEntry, deleteGoalEntry } = goalsSlice.actions;
export default goalsSlice.reducer;
