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
} from '../../lib/fileSystemSync';
import type { FirebaseConfig } from '../../lib/types';
import AuthTabButton from './AuthTabButton';
import SectionHeader from './SectionHeader';
import SettingsField from './SettingsField';

type SettingsPanelProps = {
  isOpen: boolean;
  onClose: () => void;
  onSyncConfigured?: () => void;
};

type AuthTab = 'google' | 'email';
type StatusTone = 'warning' | 'success' | 'info';

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

export default function SettingsPanel({
  isOpen,
  onClose,
  onSyncConfigured,
}: SettingsPanelProps) {
  const initialConfig = loadFirebaseConfig() || EMPTY_CONFIG;
  const initialIsConfigured =
    !!initialConfig.apiKey &&
    !!initialConfig.authDomain &&
    !!initialConfig.projectId &&
    !!initialConfig.appId;

  const [config, setConfig] = useState<FirebaseConfig>(() => initialConfig);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isGoogleAuthenticated, setIsGoogleAuthenticated] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [statusTone, setStatusTone] = useState<StatusTone>('info');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isFirebaseSectionOpen, setIsFirebaseSectionOpen] = useState(
    () => !initialIsConfigured
  );
  const [isAuthSectionOpen, setIsAuthSectionOpen] = useState(true);
  const [activeAuthTab, setActiveAuthTab] = useState<AuthTab>('google');
  const hasInitializedAuthOpen = useRef(false);

  const isConfigured =
    !!config.apiKey && !!config.authDomain && !!config.projectId && !!config.appId;
  const isFirebaseConfigHealthy = isConfigured;

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

  if (!isOpen) return null;

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-panel" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <h2>Settings</h2>
          <button className="settings-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="settings-content">
          <div className="settings-section">
            <SectionHeader
              title="Firebase Config"
              isOpen={isFirebaseSectionOpen}
              isHealthy={isFirebaseConfigHealthy}
              onToggle={() => setIsFirebaseSectionOpen((current) => !current)}
            />

            {isFirebaseSectionOpen && (
              <>
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

                <div className="settings-field">
                  <label>Connection Status</label>
                  <div className={isConfigured ? 'sync-status' : 'sync-not-supported'}>
                    <p>
                      <strong>{isConfigured ? 'Configured' : 'Not configured'}</strong>
                    </p>
                    <p>
                      {isAuthenticated
                        ? `Signed in as ${userEmail || 'user'}`
                        : 'Not signed in'}
                    </p>
                  </div>
                </div>
              </>
            )}

            <SectionHeader
              title="Authentication"
              isOpen={isAuthSectionOpen}
              isHealthy={isAuthenticated}
              onToggle={() => setIsAuthSectionOpen((current) => !current)}
            />

            {isAuthSectionOpen && (
              <>
                <div className="settings-tabs" role="tablist" aria-label="Authentication methods">
                  <AuthTabButton
                    label="Google"
                    isActive={activeAuthTab === 'google'}
                    onClick={() => setActiveAuthTab('google')}
                  />
                  <AuthTabButton
                    label="Email"
                    isActive={activeAuthTab === 'email'}
                    onClick={() => setActiveAuthTab('email')}
                  />
                </div>

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
              </>
            )}

            {statusMessage ? (
              <p
                className={
                  statusTone === 'warning'
                    ? 'settings-alert settings-alert-warning'
                    : statusTone === 'success'
                      ? 'settings-alert settings-alert-success'
                      : 'settings-alert settings-alert-info'
                }
              >
                {statusMessage}
              </p>
            ) : null}

            <p className="settings-help">
              Firebase config is stored in this browser only. To avoid shared billing,
              each user should enter their own Firebase project credentials.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
