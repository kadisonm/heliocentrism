'use client';

import { RefreshCw, Settings } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NAV_ITEMS } from '../../../lib/nav/navItems';

// GitHub Pages serves this app from /<repo>/, not the domain root — plain
// <img src="/..."> paths aren't rewritten by Next's basePath automatically,
// so this (mirroring next.config.ts's basePath) has to be prepended by hand.
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

type DesktopNavProps = {
  onOpenSyncConfig: () => void;
  onOpenSettings: () => void;
};

// >=1200px only (see useDeviceTier) — mobile/tablet render MobileHeader +
// MobileBottomNav instead, so this never needs to collapse itself.
export default function DesktopNav({ onOpenSyncConfig, onOpenSettings }: DesktopNavProps) {
  const pathname = usePathname();

  const linkClassName = (href: string) =>
    pathname === href ? 'app-nav-link app-nav-link--active' : 'app-nav-link';

  return (
    <nav className="app-nav">
      <div className="app-nav-start">
        <Link href="/" className="app-nav-logo">
          <img src={`${BASE_PATH}/wordmark.svg`} alt="Heliocentrism" />
        </Link>

        <div className="app-nav-links">
          {NAV_ITEMS.map((item) => (
            <Link key={item.href} href={item.href} className={linkClassName(item.href)}>
              {item.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="app-nav-actions">
        <button
          type="button"
          className="icon-button"
          onClick={onOpenSyncConfig}
          title="Sync Configuration"
          aria-label="Sync Configuration"
        >
          <RefreshCw size={18} />
        </button>

        <button
          type="button"
          className="icon-button"
          onClick={onOpenSettings}
          title="Settings"
          aria-label="Settings"
        >
          <Settings size={18} />
        </button>
      </div>
    </nav>
  );
}
