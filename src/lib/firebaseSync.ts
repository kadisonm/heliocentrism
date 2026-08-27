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
import type { AppData, AppSettings } from './data';
import type { DashboardState, Subtask, SyncStatus, Task, TaskList } from './types';
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

export async function readTaskLists(): Promise<TaskList[] | null> {
  try {
    const snapshot = await getAuthenticatedSnapshot();
    if (!snapshot || !snapshot.exists()) return null;

    const doc = snapshot.data() as { data?: Partial<AppData> };
    return Array.isArray(doc.data?.taskLists) ? doc.data.taskLists : null;
  } catch (error) {
    console.error('Error reading task lists from Firestore:', error);
    return null;
  }
}

export async function writeTaskLists(taskLists: TaskList[]): Promise<boolean> {
  const docRef = await getAuthenticatedDocRef();
  if (!docRef) return false;

  try {
    const data: Pick<AppData, 'taskLists'> = { taskLists };
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
    console.error('Error writing task lists to Firestore:', error);
    return false;
  }
}

export async function readTasks(): Promise<Task[] | null> {
  try {
    const snapshot = await getAuthenticatedSnapshot();
    if (!snapshot || !snapshot.exists()) return null;

    const doc = snapshot.data() as { data?: Partial<AppData> };
    return Array.isArray(doc.data?.tasks) ? doc.data.tasks : null;
  } catch (error) {
    console.error('Error reading tasks from Firestore:', error);
    return null;
  }
}

export async function writeTasks(tasks: Task[]): Promise<boolean> {
  const docRef = await getAuthenticatedDocRef();
  if (!docRef) return false;

  try {
    const data: Pick<AppData, 'tasks'> = { tasks };
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
    console.error('Error writing tasks to Firestore:', error);
    return false;
  }
}

export async function readSubtasks(): Promise<Subtask[] | null> {
  try {
    const snapshot = await getAuthenticatedSnapshot();
    if (!snapshot || !snapshot.exists()) return null;

    const doc = snapshot.data() as { data?: Partial<AppData> };
    return Array.isArray(doc.data?.subtasks) ? doc.data.subtasks : null;
  } catch (error) {
    console.error('Error reading subtasks from Firestore:', error);
    return null;
  }
}

export async function writeSubtasks(subtasks: Subtask[]): Promise<boolean> {
  const docRef = await getAuthenticatedDocRef();
  if (!docRef) return false;

  try {
    const data: Pick<AppData, 'subtasks'> = { subtasks };
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
    console.error('Error writing subtasks to Firestore:', error);
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
    // setDoc with merge:true never removes fields a write omits, so older
    // shapes this doc may still carry (a pre-pages breakpoint's widgets/layout,
    // or the even older top-level widgets/layouts) would otherwise linger
    // forever, silently shadowing the current data on the next migration.
    const breakpointCleanup = {
      widgets: deleteField(),
      layout: deleteField(),
    };
    const data = {
      dashboard: {
        ...dashboard,
        widgets: deleteField(),
        layouts: deleteField(),
        breakpoints: {
          desktop: { ...dashboard.breakpoints.desktop, ...breakpointCleanup },
          tablet: { ...dashboard.breakpoints.tablet, ...breakpointCleanup },
          mobile: { ...dashboard.breakpoints.mobile, ...breakpointCleanup },
        },
      },
    };
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
