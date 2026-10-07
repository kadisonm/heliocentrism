'use client';

import React, { useEffect } from 'react';
import { Provider } from 'react-redux';
import OnboardingGate from '../components/pages/onboarding-gate';
import { store } from '../lib/store/store';
import { ensureGridLoaded } from '../lib/store/gridSlice';
import { ensureTaskListsLoaded } from '../lib/store/taskListsSlice';
import { ensureHabitsLoaded } from '../lib/store/habitsSlice';
import { ensureGoalsLoaded } from '../lib/store/goalsSlice';
import { ensureSettingsLoaded } from '../lib/store/settingsSlice';
import { ensureRepeatWatcherStarted } from '../lib/store/persistenceMiddleware';

function StoreBootstrap() {
  useEffect(() => {
    ensureGridLoaded(store.dispatch);
    ensureTaskListsLoaded(store.dispatch);
    ensureHabitsLoaded(store.dispatch);
    ensureGoalsLoaded(store.dispatch);
    ensureSettingsLoaded(store.dispatch);
    ensureRepeatWatcherStarted(store.dispatch);
  }, []);

  return null;
}

export default function ClientRoot({ children }: { children: React.ReactNode }) {
  // Place any client-only providers/hooks here to avoid marking layout as a client component.
  return (
    <Provider store={store}>
      <StoreBootstrap />
      <OnboardingGate>{children}</OnboardingGate>
    </Provider>
  );
}