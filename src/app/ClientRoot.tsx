'use client';

import React, { useEffect } from 'react';
import { Provider } from 'react-redux';
// import OnboardingGate from '../components/pages/onboarding-gate';
import { store } from '../lib/store/store';
import { ensureGridLoaded } from '../lib/store/gridSlice';
import { ensureTaskListsLoaded } from '../lib/store/taskListsSlice';
import { ensureSettingsLoaded } from '../lib/store/settingsSlice';
import { ensureRepeatWatcherStarted } from '../lib/store/persistenceMiddleware';

function StoreBootstrap() {
  useEffect(() => {
    ensureGridLoaded(store.dispatch);
    ensureTaskListsLoaded(store.dispatch);
    ensureSettingsLoaded(store.dispatch);
    ensureRepeatWatcherStarted(store.dispatch);
  }, []);

  return null;
}

export default function ClientRoot({ children }: { children: React.ReactNode }) {
  // Place any client-only providers/hooks here to avoid marking layout as a client component.
  // TEMP QA BYPASS: return <OnboardingGate>{children}</OnboardingGate>;
  return (
    <Provider store={store}>
      <StoreBootstrap />
      {children}
    </Provider>
  );
}