import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { DEFAULT_HABITS } from '../data';
import { readHabits } from '../firebase/firebaseSync';
import { habitStartKey, nextHabitDay } from '../habits/habitGoal';
import { nextOrder } from '../tasks/reorder';
import type { Habit, HabitDraft } from '../types';
import type { AppDispatch } from './store';

export type HabitsState = {
  habits: Habit[];
  isLoading: boolean;
};

const initialState: HabitsState = {
  habits: DEFAULT_HABITS,
  isLoading: true,
};

let hasStartedLoad = false;

export const loadHabits = createAsyncThunk('habits/load', async () => (await readHabits()) ?? DEFAULT_HABITS);

export function ensureHabitsLoaded(dispatch: AppDispatch) {
  if (hasStartedLoad) return;
  hasStartedLoad = true;
  dispatch(loadHabits());
}

// Writes (or clears, for an empty value) one day's log entry in place — called inside Immer reducers.
function logValue(habit: Habit, date: string, value: number, nowIso: string) {
  const entry = nextHabitDay(habit.goal, habit.log[date], value, nowIso);
  if (entry) habit.log[date] = entry;
  else delete habit.log[date];
}

// Clamps to the goal's valid range and strips float noise from fractional steps (e.g. 0.1 km).
function sanitizeValue(habit: Habit, value: number): number {
  const max = habit.goal.type === 'check' ? 1 : Infinity;
  return Math.min(Math.max(Math.round(value * 1000) / 1000, 0), max);
}

const habitsSlice = createSlice({
  name: 'habits',
  initialState,
  reducers: {
    // id is generated in `prepare` so callers get it back synchronously (e.g. to select the new habit).
    createHabit: {
      reducer: (state, action: PayloadAction<{ id: string; createdAt: string; draft: HabitDraft }>) => {
        const { id, createdAt, draft } = action.payload;
        state.habits.push({ ...draft, id, createdAt, source: { kind: 'manual' }, order: nextOrder(state.habits), log: {} });
      },
      prepare: (draft: HabitDraft) => ({
        payload: { id: crypto.randomUUID(), createdAt: new Date().toISOString(), draft },
      }),
    },

    // Goal type is locked after creation; a changed target re-judges `today` only, past days keep their record.
    updateHabit: (state, action: PayloadAction<{ habitId: string; draft: HabitDraft; today: string }>) => {
      const { habitId, draft, today } = action.payload;
      const habit = state.habits.find((h) => h.id === habitId);
      if (!habit) return;
      habit.name = draft.name;
      habit.color = draft.color;
      if (draft.goal.type === habit.goal.type) habit.goal = draft.goal;
      const todayEntry = habit.log[today];
      if (todayEntry) logValue(habit, today, todayEntry.value, new Date().toISOString());
    },

    deleteHabit: (state, action: PayloadAction<{ habitId: string }>) => {
      state.habits = state.habits.filter((habit) => habit.id !== action.payload.habitId);
    },

    setHabitValue: (state, action: PayloadAction<{ habitId: string; date: string; value: number }>) => {
      const { habitId, date, value } = action.payload;
      const habit = state.habits.find((h) => h.id === habitId);
      if (!habit) return;
      // Clearing an abstain day before tracking began means "clean since then" — move the start back instead.
      if (habit.goal.type === 'abstain' && value === 0 && date < habitStartKey(habit)) {
        habit.startDate = date;
        return;
      }
      logValue(habit, date, sanitizeValue(habit, value), new Date().toISOString());
    },
  },
  extraReducers: (builder) => {
    builder.addCase(loadHabits.fulfilled, (state, action) => {
      state.habits = action.payload;
      state.isLoading = false;
    });
  },
});

export const { createHabit, updateHabit, deleteHabit, setHabitValue } = habitsSlice.actions;
export default habitsSlice.reducer;
