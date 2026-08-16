'use client';

import { RefreshCw, Settings } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import GeneralSettingsPanel from '../general-settings';
import SyncConfigPanel from '../sync-config';

const NAV_LINKS = [
  { href: '/', label: 'Dashboard' },
  { href: '/projects', label: 'Projects' },
  { href: '/mail', label: 'Mail' },
  { href: '/calendar', label: 'Calendar' },
  { href: '/family', label: 'Family' }
];

export default function Nav() {
  const pathname = usePathname();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSyncConfigOpen, setIsSyncConfigOpen] = useState(false);

  return (
    <nav className="app-nav">
      <div className="app-nav-start">
        <Link href="/" className="app-nav-logo">
          <img src="/wordmark.svg" alt="Heliocentrism" />
        </Link>

        <div className="app-nav-links">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={
                pathname === link.href ? 'app-nav-link app-nav-link--active' : 'app-nav-link'
              }
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="app-nav-actions">
        <button
          type="button"
          className="icon-button"
          onClick={() => setIsSyncConfigOpen(true)}
          title="Sync Configuration"
          aria-label="Sync Configuration"
        >
          <RefreshCw size={18} />
        </button>

        <button
          type="button"
          className="icon-button"
          onClick={() => setIsSettingsOpen(true)}
          title="Settings"
          aria-label="Settings"
        >
          <Settings size={18} />
        </button>
      </div>

      <GeneralSettingsPanel
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />

      <SyncConfigPanel
        isOpen={isSyncConfigOpen}
        onClose={() => setIsSyncConfigOpen(false)}
        onSyncConfigured={() => {
          // Refresh tasks if needed
          window.location.reload();
        }}
      />
    </nav>
  );
}
