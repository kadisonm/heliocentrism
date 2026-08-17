type ConnectionStatusProps = {
  isConfigured: boolean;
  isAuthenticated: boolean;
  userEmail: string | null;
};

export default function ConnectionStatus({
  isConfigured,
  isAuthenticated,
  userEmail,
}: ConnectionStatusProps) {
  return (
    <div className="settings-field">
      <label>Connection Status</label>
      <div className={isConfigured ? 'sync-status' : 'sync-not-supported'}>
        <p>
          <strong>{isConfigured ? 'Configured' : 'Not configured'}</strong>
        </p>
        <p>
          {isAuthenticated ? `Signed in as ${userEmail || 'user'}` : 'Not signed in'}
        </p>
      </div>
    </div>
  );
}
