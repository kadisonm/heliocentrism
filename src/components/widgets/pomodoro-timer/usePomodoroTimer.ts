'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { getSettingsSnapshot, useSettings } from '../../tasks/useSettings';

export type PomodoroPhase = 'study' | 'break';

type PomodoroSnapshot = {
  phase: PomodoroPhase;
  remainingSeconds: number;
  isRunning: boolean;
  autoStart: boolean;
};

function phaseDurationSeconds(targetPhase: PomodoroPhase): number {
  const { studyMinutes, breakMinutes } = getSettingsSnapshot().pomodoro;
  return (targetPhase === 'study' ? studyMinutes : breakMinutes) * 60;
}

// Module-level singleton, mirroring src/components/widgets/routines/useRoutineTasks.ts
// — every widget instance shares the same running timer instead of each
// instance counting down independently. Deliberately not synced to
// Firestore: a countdown mid-session isn't meaningful across devices, and
// resetting on reload is the expected behavior for a focus timer.
let phase: PomodoroPhase = 'study';
let remainingSeconds = phaseDurationSeconds('study');
let isRunning = false;
let autoStart = false;
let intervalId: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<() => void>();

// useSyncExternalStore requires a referentially stable snapshot between
// notifications, so it's cached here and only rebuilt when the state
// actually changes (inside notify()) rather than on every getSnapshot call.
let snapshot: PomodoroSnapshot = { phase, remainingSeconds, isRunning, autoStart };

function notify() {
  snapshot = { phase, remainingSeconds, isRunning, autoStart };
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return snapshot;
}

function stopInterval() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

function startInterval() {
  if (intervalId) return;
  intervalId = setInterval(() => {
    remainingSeconds -= 1;
    if (remainingSeconds <= 0) {
      stopInterval();
      completePhase();
      return;
    }
    notify();
  }, 1000);
}

// Called when a phase's countdown reaches zero — always advances to the
// other phase with a fresh countdown; whether it starts running
// automatically depends on the auto-start toggle.
function completePhase() {
  phase = phase === 'study' ? 'break' : 'study';
  remainingSeconds = phaseDurationSeconds(phase);
  isRunning = autoStart;
  notify();
  if (isRunning) startInterval();
}

function togglePlay() {
  isRunning = !isRunning;
  if (isRunning) {
    startInterval();
  } else {
    stopInterval();
  }
  notify();
}

function setPhase(nextPhase: PomodoroPhase) {
  if (nextPhase === phase) return;
  stopInterval();
  phase = nextPhase;
  remainingSeconds = phaseDurationSeconds(nextPhase);
  isRunning = false;
  notify();
}

function toggleAutoStart() {
  autoStart = !autoStart;
  notify();
}

// Keeps the idle (not-running) countdown in sync if the user adjusts the
// study/break duration in Settings while this phase hasn't started yet. An
// in-progress countdown is left alone so a session isn't disrupted mid-way.
function syncFromSettings() {
  if (isRunning) return;
  remainingSeconds = phaseDurationSeconds(phase);
  notify();
}

export function formatPomodoroTime(totalSeconds: number): string {
  const clamped = Math.max(0, totalSeconds);
  const minutes = Math.floor(clamped / 60);
  const seconds = clamped % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function usePomodoroTimer() {
  const { settings, isLoading: isSettingsLoading } = useSettings();

  useEffect(() => {
    if (!isSettingsLoading) {
      syncFromSettings();
    }
  }, [isSettingsLoading, settings.pomodoro.studyMinutes, settings.pomodoro.breakMinutes]);

  const currentSnapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  return {
    ...currentSnapshot,
    togglePlay,
    setPhase,
    toggleAutoStart,
  };
}
