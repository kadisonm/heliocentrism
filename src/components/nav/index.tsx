'use client';

import { Menu, RefreshCw, Settings, X } from 'lucide-react';
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

// GitHub Pages serves this app from /<repo>/, not the domain root — plain
// <img src="/..."> paths aren't rewritten by Next's basePath automatically,
// so this (mirroring next.config.ts's basePath) has to be prepended by hand.
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

export default function Nav() {
  const pathname = usePathname();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSyncConfigOpen, setIsSyncConfigOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const linkClassName = (href: string) =>
    pathname === href ? 'app-nav-link app-nav-link--active' : 'app-nav-link';

  return (
    <nav className="app-nav">
      <div className="app-nav-start">
        <Link href="/" className="app-nav-logo" onClick={() => setIsMobileMenuOpen(false)}>
          <img src={`${BASE_PATH}/wordmark.svg`} alt="Heliocentrism" />
        </Link>

        <div className="app-nav-links">
          {NAV_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className={linkClassName(link.href)}>
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

      <button
        type="button"
        className="app-nav-menu-toggle"
        onClick={() => setIsMobileMenuOpen(true)}
        title="Open menu"
        aria-label="Open menu"
      >
        <Menu size={20} />
      </button>

      {isMobileMenuOpen && (
        <div className="app-nav-mobile-menu">
          <div className="app-nav-mobile-menu-header">
            <img
              src={`${BASE_PATH}/wordmark.svg`}
              alt="Heliocentrism"
              className="app-nav-mobile-menu-logo"
            />
            <button
              type="button"
              className="icon-button"
              onClick={() => setIsMobileMenuOpen(false)}
              title="Close menu"
              aria-label="Close menu"
            >
              <X size={20} />
            </button>
          </div>

          <div className="app-nav-mobile-menu-links">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={linkClassName(link.href)}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                {link.label}
              </Link>
            ))}
          </div>

          <div className="app-nav-mobile-menu-actions">
            <button
              type="button"
              className="app-nav-mobile-menu-action"
              onClick={() => {
                setIsSyncConfigOpen(true);
                setIsMobileMenuOpen(false);
              }}
            >
              <RefreshCw size={18} />
              Sync Configuration
            </button>

            <button
              type="button"
              className="app-nav-mobile-menu-action"
              onClick={() => {
                setIsSettingsOpen(true);
                setIsMobileMenuOpen(false);
              }}
            >
              <Settings size={18} />
              Settings
            </button>
          </div>
        </div>
      )}

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
