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
  serverTimestamp,
  setDoc,
  type Firestore,
} from 'firebase/firestore';
import { clearSetting, loadSetting, saveSetting } from './fileStorage';
import type { FirebaseConfig, SyncStatus, Todo } from './types';

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
}

export function isFirebaseConfigured(): boolean {
  return !!loadFirebaseConfig();
}

function getFirebaseServices(): FirebaseServices | null {
  const config = loadFirebaseConfig();
  if (!config) return null;

  const app = getApps().length > 0 ? getApps()[0] : initializeApp(config);
  const db = getFirestore(app);
  return { app, db };
}

function getFirebaseAuth() {
  const services = getFirebaseServices();
  if (!services) return null;
  return getAuth(services.app);
}

function getTasksDocRef(uid: string) {
  const services = getFirebaseServices();
  if (!services) return null;
  return doc(services.db, 'users', uid, 'appData', 'recurringTasks');
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

export async function readTasksFromSyncFolder(): Promise<Todo[] | null> {
  const auth = getFirebaseAuth();
  if (!auth?.currentUser) return null;

  const docRef = getTasksDocRef(auth.currentUser.uid);
  if (!docRef) return null;

  try {
    const snapshot = await getDoc(docRef);
    if (!snapshot.exists()) return null;

    const data = snapshot.data() as { tasks?: Todo[] };
    return Array.isArray(data.tasks) ? data.tasks : null;
  } catch (error) {
    console.error('Error reading tasks from Firestore:', error);
    return null;
  }
}

export async function writeTasksToSyncFolder(tasks: Todo[]): Promise<boolean> {
  const auth = getFirebaseAuth();
  if (!auth?.currentUser) return false;

  const docRef = getTasksDocRef(auth.currentUser.uid);
  if (!docRef) return false;

  try {
    await setDoc(
      docRef,
      {
        tasks,
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
