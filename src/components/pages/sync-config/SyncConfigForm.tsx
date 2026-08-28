'use client';

import { useEffect, useRef, useState } from 'react';
import {
  createEmailAccount,
  isFirebaseConfigured,
  signInWithEmail,
  signInWithGoogle,
  signOutFirebaseUser,
  subscribeToAuthState,
} from '../../../lib/firebase/firebaseSync';
import SectionHeader from '../../common/SectionHeader';
import SettingsField from '../../common/SettingsField';
import StatusAlert, { type StatusTone } from '../../common/StatusAlert';
import Tabs from '../../common/Tabs';
import ConnectionStatus from './ConnectionStatus';

type SyncConfigFormProps = {
  // Whether the auth-state subscription should be active. Modal-hosted usage
  // only needs it while the modal is open; the full-screen onboarding gate
  // has no such concept, so it defaults to always-on.
  isOpen?: boolean;
  onSyncConfigured?: () => void;
};

type AuthTab = 'google' | 'email';

export default function SyncConfigForm({
  isOpen = true,
  onSyncConfigured,
}: SyncConfigFormProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isGoogleAuthenticated, setIsGoogleAuthenticated] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [statusTone, setStatusTone] = useState<StatusTone>('info');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isAuthSectionOpen, setIsAuthSectionOpen] = useState(true);
  const [activeAuthTab, setActiveAuthTab] = useState<AuthTab>('google');
  const hasInitializedAuthOpen = useRef(false);
  // isFirebaseConfigured() reads process.env, which is identical on server and
  // client for a static export — no hydration-mismatch risk, unlike the old
  // localStorage-backed check.
  const isConfigured = isFirebaseConfigured();

  useEffect(() => {
    if (!isOpen) return;

    const unsubscribe = subscribeToAuthState((user) => {
      const authenticated = !!user;

      setIsAuthenticated(!!user);
      setIsGoogleAuthenticated(
        !!user?.providerData?.some((provider) => provider.providerId === 'google.com')
      );
      setUserEmail(user?.email || null);

      // Set default auth dropdown state once based on sign-in health.
      if (!hasInitializedAuthOpen.current) {
        setIsAuthSectionOpen(!authenticated);
        hasInitializedAuthOpen.current = true;
      }
    });

    return () => {
      unsubscribe?.();
    };
  }, [isOpen]);

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    const result = await signInWithGoogle();
    setStatusMessage(result.message);
    setStatusTone(result.success ? 'success' : 'warning');
    if (result.success) {
      setIsAuthSectionOpen(false);
      onSyncConfigured?.();
    }
    setIsLoading(false);
  };

  const handleEmailSignIn = async () => {
    setIsLoading(true);
    const result = await signInWithEmail(email, password);
    setStatusMessage(result.message);
    setStatusTone(result.success ? 'success' : 'warning');
    if (result.success) {
      setIsAuthSectionOpen(false);
      onSyncConfigured?.();
    }
    setIsLoading(false);
  };

  const handleCreateAccount = async () => {
    setIsLoading(true);
    const result = await createEmailAccount(email, password);
    setStatusMessage(result.message);
    setStatusTone(result.success ? 'success' : 'warning');
    if (result.success) {
      setIsAuthSectionOpen(false);
      onSyncConfigured?.();
    }
    setIsLoading(false);
  };

  const handleSignOut = async () => {
    setIsLoading(true);
    const result = await signOutFirebaseUser();
    setStatusMessage(result.message);
    setStatusTone(result.success ? 'info' : 'warning');
    if (result.success) {
      setIsAuthenticated(false);
      setIsGoogleAuthenticated(false);
      setUserEmail(null);
    }
    onSyncConfigured?.();
    setIsLoading(false);
  };

  return (
    <div className="settings-section">
      <ConnectionStatus
        isConfigured={isConfigured}
        isAuthenticated={isAuthenticated}
        userEmail={userEmail}
      />

      <SectionHeader
        title="Authentication"
        isOpen={isAuthSectionOpen}
        isHealthy={isAuthenticated}
        onToggle={() => setIsAuthSectionOpen((current) => !current)}
      />

      {isAuthSectionOpen && (
        <div className="settings-section-body">
          <Tabs
            ariaLabel="Authentication methods"
            options={[
              { value: 'google', label: 'Google' },
              { value: 'email', label: 'Email' },
            ]}
            value={activeAuthTab}
            onChange={setActiveAuthTab}
          />

          {activeAuthTab === 'google' && (
            <div className="settings-actions">
              <button
                className="settings-button settings-button-primary"
                onClick={handleGoogleSignIn}
                disabled={isLoading || !isConfigured || isGoogleAuthenticated}
              >
                Sign in with Google
              </button>

              <button
                className="settings-button settings-button-danger"
                onClick={handleSignOut}
                disabled={isLoading || !isAuthenticated}
              >
                Sign out
              </button>
            </div>
          )}

          {activeAuthTab === 'email' && (
            <>
              <SettingsField
                label="Email"
                value={email}
                onChange={setEmail}
                placeholder="you@example.com"
              />

              <SettingsField
                label="Password"
                value={password}
                onChange={setPassword}
                placeholder="Enter password"
                type="password"
              />

              <div className="settings-actions">
                <button
                  className="settings-button settings-button-primary"
                  onClick={handleEmailSignIn}
                  disabled={isLoading || !isConfigured}
                >
                  Sign in with Email
                </button>

                <button
                  className="settings-button settings-button-primary"
                  onClick={handleCreateAccount}
                  disabled={isLoading || !isConfigured}
                >
                  Create Account
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {statusMessage ? <StatusAlert message={statusMessage} tone={statusTone} /> : null}

      {!isConfigured && (
        <p className="settings-help">
          Firebase isn&apos;t configured for this deployment — the
          NEXT_PUBLIC_FIREBASE_* build env vars are missing.
        </p>
      )}
    </div>
  );
}
