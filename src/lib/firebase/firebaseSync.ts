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
  deleteField,
  doc,
  getDoc,
  getFirestore,
  initializeFirestore,
  serverTimestamp,
  setDoc,
  type Firestore,
} from 'firebase/firestore';
import type { AppData, AppSettings } from '../data';
import type { DashboardState, Goal, Habit, Subtask, SyncStatus, Task, TaskList } from '../types';
import { loadGlobalFirebaseConfig } from './globalFirebaseConfig';

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

export function isFirebaseConfigured(): boolean {
  return !!loadGlobalFirebaseConfig();
}

// The app/db pairing can't change mid-session, so cache the success case to
// avoid re-parsing storage and re-initializing Firestore on every call.
// "Not configured yet" is left uncached so a config saved mid-session is
// picked up on the next call.
let cachedServices: FirebaseServices | null | undefined;

function getFirebaseServices(): FirebaseServices | null {
  if (cachedServices !== undefined) return cachedServices;

  const config = loadGlobalFirebaseConfig();
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

// Doc name predates this doc holding task lists, dashboard layout, and
// settings all together — 'userData' describes what's actually in here.
function getAppDataDocRef(uid: string) {
  const services = getFirebaseServices();
  if (!services) return null;
  return doc(services.db, 'users', uid, 'appData', 'userData');
}

// Firebase Auth restores a signed-in session asynchronously, so an early read
// of auth.currentUser can wrongly see `null`. authStateReady() waits for that
// restore first so currentUser can be trusted here.
async function getAuthenticatedDocRef() {
  const auth = getFirebaseAuth();
  if (!auth) return null;

  await auth.authStateReady();
  if (!auth.currentUser) return null;

  return getAppDataDocRef(auth.currentUser.uid);
}

async function getAuthenticatedSnapshot() {
  const auth = getFirebaseAuth();
  if (!auth) return null;

  await auth.authStateReady();
  if (!auth.currentUser) return null;

  const docRef = getAppDataDocRef(auth.currentUser.uid);
  if (!docRef) return null;

  return getDoc(docRef);
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

// Reads one top-level field of the synced `data` map; `isValid` rejects malformed shapes.
async function readDataField<K extends keyof AppData>(
  key: K,
  isValid: (value: unknown) => boolean = (value) => value != null
): Promise<AppData[K] | null> {
  try {
    const snapshot = await getAuthenticatedSnapshot();
    if (!snapshot || !snapshot.exists()) return null;

    const doc = snapshot.data() as { data?: Partial<AppData> };
    const value = doc.data?.[key];
    return isValid(value) ? (value as AppData[K]) : null;
  } catch (error) {
    console.error(`Error reading ${key} from Firestore:`, error);
    return null;
  }
}

// Merge-writes one top-level field of the synced `data` map, leaving the others untouched.
async function writeDataField<K extends keyof AppData>(key: K, value: unknown): Promise<boolean> {
  const docRef = await getAuthenticatedDocRef();
  if (!docRef) return false;

  try {
    await setDoc(
      docRef,
      {
        data: { [key]: value },
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    return true;
  } catch (error) {
    console.error(`Error writing ${key} to Firestore:`, error);
    return false;
  }
}

export const readTaskLists = (): Promise<TaskList[] | null> => readDataField('taskLists', Array.isArray);
export const writeTaskLists = (taskLists: TaskList[]) => writeDataField('taskLists', taskLists);

export const readTasks = (): Promise<Task[] | null> => readDataField('tasks', Array.isArray);
export const writeTasks = (tasks: Task[]) => writeDataField('tasks', tasks);

export const readSubtasks = (): Promise<Subtask[] | null> => readDataField('subtasks', Array.isArray);
export const writeSubtasks = (subtasks: Subtask[]) => writeDataField('subtasks', subtasks);

export const readHabits = (): Promise<Habit[] | null> => readDataField('habits', Array.isArray);
export const writeHabits = (habits: Habit[]) => writeDataField('habits', habits);

export const readGoals = (): Promise<Goal[] | null> => readDataField('goals', Array.isArray);
export const writeGoals = (goals: Goal[]) => writeDataField('goals', goals);

export const readAppSettings = (): Promise<AppSettings | null> => readDataField('settings');
export const writeAppSettings = (settings: AppSettings) => writeDataField('settings', settings);

export const readDashboardState = (): Promise<DashboardState | null> => readDataField('dashboard');

// setDoc with merge:true never removes omitted fields, so older shapes (a pre-pages
// breakpoint's widgets/layout, or the top-level widgets/layouts) are deleted explicitly.
export function writeDashboardState(dashboard: DashboardState): Promise<boolean> {
  const breakpointCleanup = {
    widgets: deleteField(),
    layout: deleteField(),
  };
  return writeDataField('dashboard', {
    ...dashboard,
    widgets: deleteField(),
    layouts: deleteField(),
    breakpoints: {
      desktop: { ...dashboard.breakpoints.desktop, ...breakpointCleanup },
      tablet: { ...dashboard.breakpoints.tablet, ...breakpointCleanup },
      mobile: { ...dashboard.breakpoints.mobile, ...breakpointCleanup },
    },
  });
}
