'use client';

import { useCallback, useMemo } from 'react';
import type { GoalSources } from '../../../lib/goals/goalProgress';
import {
  createGoal as createGoalAction,
  deleteGoal as deleteGoalAction,
  deleteGoalEntry as deleteGoalEntryAction,
  logGoalEntry as logGoalEntryAction,
  toggleMilestone as toggleMilestoneAction,
  updateGoal as updateGoalAction,
} from '../../../lib/store/goalsSlice';
import { useAppDispatch, useAppSelector } from '../../../lib/store/hooks';
import type { GoalDraft } from '../../../lib/types';

// Thin wrapper over the goals Redux slice, plus the habit/task data linked goals read from.
export function useGoals() {
  const dispatch = useAppDispatch();
  const goals = useAppSelector((state) => state.goals.goals);
  const isLoading = useAppSelector((state) => state.goals.isLoading);
  const habits = useAppSelector((state) => state.habits.habits);
  const tasks = useAppSelector((state) => state.taskLists.tasks);
  const taskLists = useAppSelector((state) => state.taskLists.taskLists);
  const sources = useMemo<GoalSources>(() => ({ habits, tasks, taskLists }), [habits, tasks, taskLists]);

  // Returns the new goal's id (generated in the action's `prepare`) so it can be selected immediately.
  const createGoal = useCallback((draft: GoalDraft): string => dispatch(createGoalAction(draft)).payload.id, [dispatch]);
  const updateGoal = useCallback((goalId: string, draft: GoalDraft) => dispatch(updateGoalAction({ goalId, draft })), [dispatch]);
  const deleteGoal = useCallback((goalId: string) => dispatch(deleteGoalAction({ goalId })), [dispatch]);

  const toggleMilestone = useCallback(
    (goalId: string, milestoneId: string) => dispatch(toggleMilestoneAction({ goalId, milestoneId })),
    [dispatch]
  );

  const logGoalEntry = useCallback(
    (goalId: string, date: string, amount: number) => dispatch(logGoalEntryAction(goalId, date, amount)),
    [dispatch]
  );

  const deleteGoalEntry = useCallback(
    (goalId: string, entryId: string) => dispatch(deleteGoalEntryAction({ goalId, entryId })),
    [dispatch]
  );

  return { goals, isLoading, sources, createGoal, updateGoal, deleteGoal, toggleMilestone, logGoalEntry, deleteGoalEntry };
}
