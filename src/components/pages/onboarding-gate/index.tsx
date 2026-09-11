'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { isFirebaseConfigured, subscribeToAuthState } from '../../../lib/firebase/firebaseSync';
import SyncConfigForm from '../sync-config/SyncConfigForm';

type GateStatus = 'checking' | 'unconfigured' | 'blocked' | 'allowed';

// Blocks the whole app until signed in — Firestore is the only data store, so
// there's nothing to show before that. Reuses SyncConfigForm (same as the Nav
// "Sync Configuration" modal) instead of duplicating it.
export default function OnboardingGate({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<GateStatus>('checking');

  useEffect(() => {
    // isFirebaseConfigured() reads a build-time env var, which is baked in
    // once and can't change at runtime — unlike the old localStorage-backed
    // config, there's no "saved mid-session" case to re-check for.
    if (!isFirebaseConfigured()) {
      /* eslint-disable-next-line react-hooks/set-state-in-effect */
      setStatus('unconfigured');
      return;
    }

    // subscribeToAuthState (and the Firebase SDK init it triggers) isn't
    // wrapped in a try/catch of its own — a platform restriction blocking
    // Firebase Auth's persistence layer (e.g. IndexedDB disabled in a
    // locked-down mobile browser/WebView) throws here instead of ever
    // calling back, which without this would leave `status` stuck on
    // 'checking' (renders null) forever. Falling back to 'blocked' at least
    // gets the sign-in form on screen instead of a permanently blank page.
    try {
      const unsubscribe = subscribeToAuthState((user) => {
        setStatus(user ? 'allowed' : 'blocked');
      });
      return () => {
        unsubscribe?.();
      };
    } catch (error) {
      console.error('[OnboardingGate] Failed to subscribe to auth state', error);
      setStatus('blocked');
    }
  }, []);

  if (status === 'checking') return null;

  if (status === 'unconfigured') {
    return (
      <div className="onboarding-screen">
        <div className="settings-panel onboarding-panel">
          <div className="settings-header">
            <h2>Firebase not configured</h2>
          </div>
          <div className="settings-content">
            <div className="settings-section">
              <p className="onboarding-intro">
                This deployment is missing its Firebase build configuration
                (the NEXT_PUBLIC_FIREBASE_* env vars). Set them and rebuild to
                continue.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'blocked') {
    return (
      <div className="onboarding-screen">
        <div className="settings-panel onboarding-panel">
          <div className="settings-header">
            <h2>Welcome to Heliocentrism</h2>
          </div>
          <div className="settings-content">
            <div className="settings-section">
              <p className="onboarding-intro">
                This app stores everything in Firestore — sign in to continue.
              </p>
              <SyncConfigForm />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
