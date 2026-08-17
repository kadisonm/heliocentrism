'use client';

import { useEffect, useRef, useState } from 'react';
import {
  clearFirebaseConfig,
  createEmailAccount,
  loadFirebaseConfig,
  saveFirebaseConfig,
  signInWithEmail,
  signInWithGoogle,
  signOutFirebaseUser,
  subscribeToAuthState,
} from '../../../lib/firebaseSync';
import type { FirebaseConfig } from '../../../lib/types';
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

const EMPTY_CONFIG: FirebaseConfig = {
  apiKey: '',
  authDomain: '',
  projectId: '',
  appId: '',
  storageBucket: '',
  messagingSenderId: '',
  measurementId: '',
};

const FIREBASE_FIELD_CONFIG: Array<{
  key: keyof FirebaseConfig;
  label: string;
  placeholder: string;
}> = [
  { key: 'apiKey', label: 'API Key', placeholder: 'AIza...' },
  {
    key: 'authDomain',
    label: 'Auth Domain',
    placeholder: 'your-project.firebaseapp.com',
  },
  { key: 'projectId', label: 'Project ID', placeholder: 'your-project-id' },
  {
    key: 'storageBucket',
    label: 'Storage Bucket',
    placeholder: 'your-project.firebasestorage.app',
  },
  {
    key: 'messagingSenderId',
    label: 'Messaging Sender ID',
    placeholder: '1234567890',
  },
  { key: 'appId', label: 'App ID', placeholder: '1:123:web:abc' },
  {
    key: 'measurementId',
    label: 'Measurement ID (optional)',
    placeholder: 'G-XXXXXXX',
  },
];

export default function SyncConfigForm({
  isOpen = true,
  onSyncConfigured,
}: SyncConfigFormProps) {
  // Start from the server-safe default; loadFirebaseConfig() reads
  // localStorage, which doesn't exist during SSR, so seeding state with it
  // directly here would make the client's hydration render disagree with
  // the server-rendered HTML. Load the real value after mount instead.
  const [config, setConfig] = useState<FirebaseConfig>(EMPTY_CONFIG);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isGoogleAuthenticated, setIsGoogleAuthenticated] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [statusTone, setStatusTone] = useState<StatusTone>('info');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isFirebaseSectionOpen, setIsFirebaseSectionOpen] = useState(true);
  const [isAuthSectionOpen, setIsAuthSectionOpen] = useState(true);
  const [activeAuthTab, setActiveAuthTab] = useState<AuthTab>('google');
  const hasInitializedAuthOpen = useRef(false);
  // subscribeToAuthState() no-ops if Firebase isn't configured yet at the
  // moment it's called — which is the normal case the first time this form
  // mounts during onboarding. Bumping this after a save/clear re-runs the
  // subscription effect below so it can attach for real once config exists.
  const [configVersion, setConfigVersion] = useState(0);

  const isConfigured =
    !!config.apiKey && !!config.authDomain && !!config.projectId && !!config.appId;
  const isFirebaseConfigHealthy = isConfigured;

  useEffect(() => {
    const savedConfig = loadFirebaseConfig();
    if (savedConfig) {
      // Hydrating client-only localStorage data after mount is the sanctioned
      // "sync from an external system" effect pattern — not derived state we
      // could compute during render, since localStorage doesn't exist during SSR.
      /* eslint-disable react-hooks/set-state-in-effect */
      setConfig(savedConfig);
      setIsFirebaseSectionOpen(
        !(
          savedConfig.apiKey &&
          savedConfig.authDomain &&
          savedConfig.projectId &&
          savedConfig.appId
        )
      );
      /* eslint-enable react-hooks/set-state-in-effect */
    }
  }, []);

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
  }, [isOpen, configVersion]);

  const updateConfigField = (field: keyof FirebaseConfig, value: string) => {
    setConfig((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleSaveConfig = async () => {
    setIsLoading(true);
    const result = saveFirebaseConfig(config);
    setStatusMessage(result.message);
    setStatusTone(result.success ? 'success' : 'warning');
    if (result.success) {
      const savedConfig = loadFirebaseConfig();
      if (savedConfig) {
        setConfig(savedConfig);
      }
      setConfigVersion((current) => current + 1);
      onSyncConfigured?.();
    }
    setIsLoading(false);
  };

  const handleClearConfig = async () => {
    setIsLoading(true);
    await signOutFirebaseUser();
    clearFirebaseConfig();
    setConfig(EMPTY_CONFIG);
    setIsAuthenticated(false);
    setIsGoogleAuthenticated(false);
    setUserEmail(null);
    setConfigVersion((current) => current + 1);
    setStatusMessage('Firebase config removed.');
    setStatusTone('info');
    onSyncConfigured?.();
    setIsLoading(false);
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    const result = await signInWithGoogle();
    setStatusMessage(result.message);
    setStatusTone(result.success ? 'success' : 'warning');
    if (result.success) {
      setIsFirebaseSectionOpen(false);
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
      setIsFirebaseSectionOpen(false);
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
      setIsFirebaseSectionOpen(false);
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
      <SectionHeader
        title="Firebase Config"
        isOpen={isFirebaseSectionOpen}
        isHealthy={isFirebaseConfigHealthy}
        onToggle={() => setIsFirebaseSectionOpen((current) => !current)}
      />

      {isFirebaseSectionOpen && (
        <div className="settings-section-body">
          {FIREBASE_FIELD_CONFIG.map((field) => (
            <SettingsField
              key={field.key}
              label={field.label}
              value={config[field.key] ?? ''}
              onChange={(value) => updateConfigField(field.key, value)}
              placeholder={field.placeholder}
            />
          ))}

          <div className="settings-actions">
            <button
              className="settings-button settings-button-primary"
              onClick={handleSaveConfig}
              disabled={isLoading}
            >
              Save Firebase Config
            </button>

            <button
              className="settings-button settings-button-danger"
              onClick={handleClearConfig}
              disabled={isLoading}
            >
              Clear Config
            </button>
          </div>

          <ConnectionStatus
            isConfigured={isConfigured}
            isAuthenticated={isAuthenticated}
            userEmail={userEmail}
          />
        </div>
      )}

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

      <p className="settings-help">
        Sync configuration is stored in this browser only. To avoid shared billing,
        each user should enter their own Firebase project credentials.
      </p>
    </div>
  );
}
