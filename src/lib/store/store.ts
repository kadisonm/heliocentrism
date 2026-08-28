import { configureStore } from '@reduxjs/toolkit';
import gridReducer from './gridSlice';
import taskListsReducer from './taskListsSlice';
import settingsReducer from './settingsSlice';
import { persistenceMiddleware } from './persistenceMiddleware';

export const store = configureStore({
  reducer: {
    grid: gridReducer,
    taskLists: taskListsReducer,
    settings: settingsReducer,
  },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().prepend(persistenceMiddleware.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
