'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { isFirebaseConfigured, subscribeToAuthState } from '../../lib/firebaseSync';
import SyncConfigForm from '../sync-config/SyncConfigForm';

type GateStatus = 'checking' | 'blocked' | 'allowed';

// Blocks the whole app (nav + routes) until Firebase is configured and the
// visitor is signed in — Firestore is the only place app data lives, so
// there's nothing useful to show before that's true. Reuses the same form
// as the Nav-accessible "Sync Configuration" modal (SyncConfigForm) rather
// than duplicating the config/sign-in UI.
export default function OnboardingGate({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<GateStatus>('checking');
  // subscribeToAuthState() no-ops if Firebase isn't configured yet at the
  // moment it's called — true on first mount during onboarding, since
  // there's no config at all yet. Bumping this (via SyncConfigForm's
  // onSyncConfigured below) re-runs the effect so it can attach for real
  // once config exists, instead of staying stuck on that first dead call.
  const [configVersion, setConfigVersion] = useState(0);

  useEffect(() => {
    // isFirebaseConfigured() reads localStorage, which doesn't exist during
    // SSR — checking it here (post-mount) rather than during render avoids a
    // hydration mismatch, same pattern SyncConfigForm itself uses.
    if (!isFirebaseConfigured()) {
      /* eslint-disable-next-line react-hooks/set-state-in-effect */
      setStatus('blocked');
      return;
    }

    // Stays subscribed for the app's lifetime (not just until the first
    // callback) so signing out or clearing config from inside the app —
    // e.g. via the Nav "Sync Configuration" modal — re-blocks live instead
    // of requiring a reload.
    const unsubscribe = subscribeToAuthState((user) => {
      setStatus(user ? 'allowed' : 'blocked');
    });

    return () => {
      unsubscribe?.();
    };
  }, [configVersion]);

  if (status === 'checking') return null;

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
                This app stores everything in Firestore — connect a Firebase project
                and sign in to continue.
              </p>
              <SyncConfigForm
                onSyncConfigured={() => setConfigVersion((current) => current + 1)}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
