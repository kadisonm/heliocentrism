import type { ResponsiveLayouts } from 'react-grid-layout';

export type TodoStage = 0 | 1 | 2;
export type RecurrenceValue = 'daily' | 'weekly' | 'monthly';
export type Recurrence = RecurrenceValue | null;

export type Todo = {
  id: string;
  title: string;
  due: string;
  stage: TodoStage;
  recurrence: Recurrence;
};

export type FirebaseConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  measurementId?: string;
};

export type SyncStatus = {
  isConfigured: boolean;
  isAuthenticated: boolean;
  userEmail: string | null;
};

export type DashboardBreakpoint = 'desktop' | 'tablet' | 'mobile';

export type DashboardWidget = {
  id: string;
  type: string;
};

export type DashboardState = {
  widgets: DashboardWidget[];
  layouts: ResponsiveLayouts<DashboardBreakpoint>;
};
