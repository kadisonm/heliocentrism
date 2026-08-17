import {
  createUserWithEmailAndPassword,
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import { getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import {
  doc,
  getDoc,
  getFirestore,
  initializeFirestore,
  serverTimestamp,
  setDoc,
  type Firestore,
} from 'firebase/firestore';
import type { AppData, AppSettings } from './data';
import { clearSetting, loadSetting, saveSetting } from './fileStorage';
import type {
  DashboardState,
  FirebaseConfig,
  RecurrenceValue,
  RoutineTask,
  SyncStatus,
  Todo,
  TodoList,
  TodoStage,
} from './types';

const FIREBASE_CONFIG_KEY = 'firebase_config';

type FirebaseServices = {
  app: FirebaseApp;
  db: Firestore;
};

function formatAuthError(prefix: string, error: unknown): string {
  const firebaseError = error as { code?: string; message?: string };
  const code = firebaseError.code || '';

  if (code === 'auth/configuration-not-found') {
    return `${prefix}: Google provider is not configured. In Firebase Console, enable Authentication and the Google sign-in provider for this project.`;
  }

  if (code === 'auth/unauthorized-domain') {
    return `${prefix}: This domain is not authorized. Add your app domain to Firebase Authentication > Settings > Authorized domains.`;
  }

  if (code === 'auth/popup-blocked') {
    return `${prefix}: The sign-in popup was blocked by the browser. Allow popups for this site and try again.`;
  }

  if (code === 'auth/popup-closed-by-user') {
    return `${prefix}: Sign-in popup was closed before completion.`;
  }

  return `${prefix}: ${firebaseError.message || 'Unknown authentication error.'}`;
}

function normalizeConfig(config: FirebaseConfig): FirebaseConfig {
  return {
    apiKey: config.apiKey.trim(),
    authDomain: config.authDomain.trim(),
    projectId: config.projectId.trim(),
    appId: config.appId.trim(),
    storageBucket: config.storageBucket?.trim() || '',
    messagingSenderId: config.messagingSenderId?.trim() || '',
    measurementId: config.measurementId?.trim() || '',
  };
}

export function validateFirebaseConfig(config: FirebaseConfig): {
  valid: boolean;
  missingFields: string[];
} {
  const required: Array<keyof FirebaseConfig> = [
    'apiKey',
    'authDomain',
    'projectId',
    'appId',
  ];

  const normalized = normalizeConfig(config);
  const missingFields = required.filter((field) => !normalized[field]);

  return {
    valid: missingFields.length === 0,
    missingFields,
  };
}

export function saveFirebaseConfig(config: FirebaseConfig): {
  success: boolean;
  message: string;
} {
  const normalized = normalizeConfig(config);
  const { valid, missingFields } = validateFirebaseConfig(normalized);

  if (!valid) {
    return {
      success: false,
      message: `Missing required fields: ${missingFields.join(', ')}`,
    };
  }

  saveSetting(FIREBASE_CONFIG_KEY, normalized);
  return {
    success: true,
    message: 'Firebase config saved.',
  };
}

export function loadFirebaseConfig(): FirebaseConfig | null {
  const config = loadSetting(FIREBASE_CONFIG_KEY, null);
  if (!config) return null;

  const normalized = normalizeConfig(config as FirebaseConfig);
  return validateFirebaseConfig(normalized).valid ? normalized : null;
}

export function clearFirebaseConfig(): void {
  clearSetting(FIREBASE_CONFIG_KEY);
  // Otherwise getFirebaseServices() below would keep serving the stale
  // cached instance and never notice config is gone — breaking the
  // onboarding gate's "clear config re-blocks the app" behavior.
  cachedServices = undefined;
}

export function isFirebaseConfigured(): boolean {
  return !!loadFirebaseConfig();
}

// Once a config is loaded, the app/db pairing can't actually change within
// the session anyway — getApps()[0] below always wins over whatever config
// is currently in storage, so re-deriving from scratch on every call bought
// nothing but a localStorage read + JSON.parse + an initializeFirestore()
// throw/catch (Firestore rejects re-initializing an already-initialized
// app) on every single read/write across the whole app. Cache the success
// case; leave the "not configured yet" case uncached so a config saved
// mid-session (e.g. during onboarding) is picked up on the next call.
let cachedServices: FirebaseServices | null | undefined;

function getFirebaseServices(): FirebaseServices | null {
  if (cachedServices !== undefined) return cachedServices;

  const config = loadFirebaseConfig();
  if (!config) return null;

  const app = getApps().length > 0 ? getApps()[0] : initializeApp(config);

  // react-grid-layout layout items can carry undefined internal fields
  // (e.g. `moved`), which Firestore's setDoc otherwise rejects.
  let db: Firestore;
  try {
    db = initializeFirestore(app, { ignoreUndefinedProperties: true });
  } catch {
    db = getFirestore(app);
  }

  cachedServices = { app, db };
  return cachedServices;
}

function getFirebaseAuth() {
  const services = getFirebaseServices();
  if (!services) return null;
  return getAuth(services.app);
}

// Doc name predates this doc holding routine tasks, todos, dashboard
// layout, and settings all together — 'userData' describes what's actually
// in here.
function getAppDataDocRef(uid: string) {
  const services = getFirebaseServices();
  if (!services) return null;
  return doc(services.db, 'users', uid, 'appData', 'userData');
}

// Pre-rename doc name. Only used as a one-time read fallback (see
// getAuthenticatedSnapshot) for accounts that synced before the rename, so
// their data isn't orphaned — every write goes to the renamed doc.
function getLegacyAppDataDocRef(uid: string) {
  const services = getFirebaseServices();
  if (!services) return null;
  return doc(services.db, 'users', uid, 'appData', 'recurringTasks');
}

// Firebase Auth restores a signed-in session asynchronously — reading
// auth.currentUser immediately after page load can see `null` even when the
// user is actually signed in, because the restore hasn't resolved yet.
// authStateReady() waits for that restore to finish, so currentUser here can
// be trusted. Without this, an early read would wrongly report "not signed
// in", and a subsequent write would overwrite the real saved data with that
// empty state.
async function getAuthenticatedDocRef() {
  const auth = getFirebaseAuth();
  if (!auth) return null;

  await auth.authStateReady();
  if (!auth.currentUser) return null;

  return getAppDataDocRef(auth.currentUser.uid);
}

// Reads whichever doc actually has data: the current 'userData' doc, or —
// for accounts that synced before the rename — the legacy 'recurringTasks'
// doc. Every write lands on the renamed doc, so this fallback naturally
// stops being hit once an account's data has been written back once.
async function getAuthenticatedSnapshot() {
  const auth = getFirebaseAuth();
  if (!auth) return null;

  await auth.authStateReady();
  if (!auth.currentUser) return null;

  const uid = auth.currentUser.uid;
  const docRef = getAppDataDocRef(uid);
  if (!docRef) return null;

  const snapshot = await getDoc(docRef);
  if (snapshot.exists()) return snapshot;

  const legacyDocRef = getLegacyAppDataDocRef(uid);
  if (!legacyDocRef) return snapshot;

  const legacySnapshot = await getDoc(legacyDocRef);
  return legacySnapshot.exists() ? legacySnapshot : snapshot;
}

export async function getSyncStatus(): Promise<SyncStatus> {
  const auth = getFirebaseAuth();
  if (!auth) {
    return {
      isConfigured: false,
      isAuthenticated: false,
      userEmail: null,
    };
  }

  return {
    isConfigured: true,
    isAuthenticated: !!auth.currentUser,
    userEmail: auth.currentUser?.email || null,
  };
}

export function subscribeToAuthState(
  callback: (user: User | null) => void
): (() => void) | null {
  const auth = getFirebaseAuth();
  if (!auth) {
    callback(null);
    return null;
  }

  return onAuthStateChanged(auth, callback);
}

export async function signInWithGoogle(): Promise<{
  success: boolean;
  message: string;
}> {
  const auth = getFirebaseAuth();
  if (!auth) {
    return { success: false, message: 'Configure Firebase first.' };
  }

  try {
    await signInWithPopup(auth, new GoogleAuthProvider());
    return { success: true, message: 'Signed in with Google.' };
  } catch (error) {
    return {
      success: false,
      message: formatAuthError('Google sign in failed', error),
    };
  }
}

export async function signInWithEmail(
  email: string,
  password: string
): Promise<{ success: boolean; message: string }> {
  const auth = getFirebaseAuth();
  if (!auth) {
    return { success: false, message: 'Configure Firebase first.' };
  }

  try {
    await signInWithEmailAndPassword(auth, email.trim(), password);
    return { success: true, message: 'Signed in successfully.' };
  } catch (error) {
    return {
      success: false,
      message: formatAuthError('Email sign in failed', error),
    };
  }
}

export async function createEmailAccount(
  email: string,
  password: string
): Promise<{ success: boolean; message: string }> {
  const auth = getFirebaseAuth();
  if (!auth) {
    return { success: false, message: 'Configure Firebase first.' };
  }

  try {
    await createUserWithEmailAndPassword(auth, email.trim(), password);
    return { success: true, message: 'Account created and signed in.' };
  } catch (error) {
    return {
      success: false,
      message: formatAuthError('Account creation failed', error),
    };
  }
}

export async function signOutFirebaseUser(): Promise<{
  success: boolean;
  message: string;
}> {
  const auth = getFirebaseAuth();
  if (!auth) {
    return { success: false, message: 'Configure Firebase first.' };
  }

  try {
    await signOut(auth);
    return { success: true, message: 'Signed out.' };
  } catch (error) {
    return {
      success: false,
      message: formatAuthError('Sign out failed', error),
    };
  }
}

// Pre-refactor shape: one unified Todo with a nullable recurrence, no
// subtasks. Read once from legacy `data.tasks` and split by whether
// `recurrence` is set, for accounts that synced before RoutineTask/Todo
// became separate types.
type LegacyTask = {
  id: string;
  title: string;
  due?: string;
  stage: TodoStage;
  recurrence?: RecurrenceValue | null;
  createdAt?: string;
  updatedAt?: string;
  completedAt?: string | null;
};

function splitLegacyTask(task: LegacyTask): RoutineTask | Todo {
  const now = new Date().toISOString();
  const base = {
    id: task.id,
    title: task.title,
    stage: task.stage,
    subtasks: [],
    createdAt: task.createdAt ?? now,
    updatedAt: task.updatedAt ?? now,
    completedAt: task.completedAt ?? null,
  };

  if (task.recurrence) {
    return { ...base, recurrence: task.recurrence };
  }
  return { ...base, due: task.due ?? '' };
}

export async function readRoutineTasks(): Promise<RoutineTask[] | null> {
  try {
    const snapshot = await getAuthenticatedSnapshot();
    if (!snapshot || !snapshot.exists()) return null;

    const doc = snapshot.data() as { data?: Partial<AppData> & { tasks?: LegacyTask[] } };
    if (Array.isArray(doc.data?.routineTasks)) return doc.data.routineTasks;

    if (Array.isArray(doc.data?.tasks)) {
      return doc.data.tasks
        .map(splitLegacyTask)
        .filter((task): task is RoutineTask => 'recurrence' in task);
    }

    return null;
  } catch (error) {
    console.error('Error reading routine tasks from Firestore:', error);
    return null;
  }
}

export async function writeRoutineTasks(routineTasks: RoutineTask[]): Promise<boolean> {
  const docRef = await getAuthenticatedDocRef();
  if (!docRef) return false;

  try {
    const data: Pick<AppData, 'routineTasks'> = { routineTasks };
    await setDoc(
      docRef,
      {
        data,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    return true;
  } catch (error) {
    console.error('Error writing routine tasks to Firestore:', error);
    return false;
  }
}

export async function readTodoLists(): Promise<TodoList[] | null> {
  try {
    const snapshot = await getAuthenticatedSnapshot();
    if (!snapshot || !snapshot.exists()) return null;

    const doc = snapshot.data() as {
      data?: Partial<AppData> & { todos?: Todo[]; tasks?: LegacyTask[] };
    };
    if (Array.isArray(doc.data?.todoLists)) return doc.data.todoLists;

    // Pre-TodoList shape: one flat `todos` array. Wrap it in a single
    // default list so existing tasks aren't lost when this ships.
    if (Array.isArray(doc.data?.todos)) {
      return [{ id: crypto.randomUUID(), name: 'My Tasks', todos: doc.data.todos }];
    }

    if (Array.isArray(doc.data?.tasks)) {
      const todos = doc.data.tasks
        .map(splitLegacyTask)
        .filter((task): task is Todo => 'due' in task);
      return todos.length > 0 ? [{ id: crypto.randomUUID(), name: 'My Tasks', todos }] : [];
    }

    return null;
  } catch (error) {
    console.error('Error reading todo lists from Firestore:', error);
    return null;
  }
}

export async function writeTodoLists(todoLists: TodoList[]): Promise<boolean> {
  const docRef = await getAuthenticatedDocRef();
  if (!docRef) return false;

  try {
    const data: Pick<AppData, 'todoLists'> = { todoLists };
    await setDoc(
      docRef,
      {
        data,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    return true;
  } catch (error) {
    console.error('Error writing todo lists to Firestore:', error);
    return false;
  }
}

export async function readDashboardState(): Promise<DashboardState | null> {
  try {
    const snapshot = await getAuthenticatedSnapshot();
    if (!snapshot || !snapshot.exists()) return null;

    const doc = snapshot.data() as { data?: Partial<AppData> };
    return doc.data?.dashboard ?? null;
  } catch (error) {
    console.error('Error reading dashboard state from Firestore:', error);
    return null;
  }
}

export async function writeDashboardState(
  dashboard: DashboardState
): Promise<boolean> {
  const docRef = await getAuthenticatedDocRef();
  if (!docRef) return false;

  try {
    const data: Pick<AppData, 'dashboard'> = { dashboard };
    await setDoc(
      docRef,
      {
        data,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    return true;
  } catch (error) {
    console.error('Error writing dashboard state to Firestore:', error);
    return false;
  }
}

export async function readAppSettings(): Promise<AppSettings | null> {
  try {
    const snapshot = await getAuthenticatedSnapshot();
    if (!snapshot || !snapshot.exists()) return null;

    const doc = snapshot.data() as { data?: Partial<AppData> };
    return doc.data?.settings ?? null;
  } catch (error) {
    console.error('Error reading app settings from Firestore:', error);
    return null;
  }
}

export async function writeAppSettings(settings: AppSettings): Promise<boolean> {
  const docRef = await getAuthenticatedDocRef();
  if (!docRef) return false;

  try {
    const data: Pick<AppData, 'settings'> = { settings };
    await setDoc(
      docRef,
      {
        data,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    return true;
  } catch (error) {
    console.error('Error writing app settings to Firestore:', error);
    return false;
  }
}
