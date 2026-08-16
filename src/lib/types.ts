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
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
  completedAt: string | null; // ISO 8601, null while not done
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

export type DailyResetTime = { hour: number; minute: number }; // 0-23, 0-59
export type WeeklyResetTime = { dayOfWeek: number; hour: number; minute: number }; // 0=Sun..6=Sat
export type MonthlyResetTime = { dayOfMonth: number; hour: number; minute: number }; // 1-31

export type RoutineResetTimes = {
  daily: DailyResetTime;
  weekly: WeeklyResetTime;
  monthly: MonthlyResetTime;
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
