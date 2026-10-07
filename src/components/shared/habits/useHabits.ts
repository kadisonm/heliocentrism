'use client';

import { useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '../../../lib/store/hooks';
import {
  createHabit as createHabitAction,
  deleteHabit as deleteHabitAction,
  setHabitValue as setHabitValueAction,
  updateHabit as updateHabitAction,
} from '../../../lib/store/habitsSlice';
import type { HabitDraft } from '../../../lib/types';

// Thin wrapper over the habits Redux slice (src/lib/store/habitsSlice.ts).
export function useHabits() {
  const dispatch = useAppDispatch();
  const habits = useAppSelector((state) => state.habits.habits);
  const isLoading = useAppSelector((state) => state.habits.isLoading);

  // Returns the new habit's id (generated in the action's `prepare`) so it can be selected immediately.
  const createHabit = useCallback((draft: HabitDraft): string => dispatch(createHabitAction(draft)).payload.id, [dispatch]);

  const updateHabit = useCallback(
    (habitId: string, draft: HabitDraft, today: string) => dispatch(updateHabitAction({ habitId, draft, today })),
    [dispatch]
  );

  const deleteHabit = useCallback((habitId: string) => dispatch(deleteHabitAction({ habitId })), [dispatch]);

  const setHabitValue = useCallback(
    (habitId: string, date: string, value: number) => dispatch(setHabitValueAction({ habitId, date, value })),
    [dispatch]
  );

  return { habits, isLoading, createHabit, updateHabit, deleteHabit, setHabitValue };
}
