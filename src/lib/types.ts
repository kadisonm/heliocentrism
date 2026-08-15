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
