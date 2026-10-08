'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { findNavItemByPathname } from '../../../lib/nav/navItems';
import AccountMenu from './AccountMenu';

type MobileHeaderProps = {
  onOpenSyncConfig: () => void;
  onOpenSettings: () => void;
};

// Scroll distance before the header gains its frosted-glass backing — stays
// fully transparent at rest (matching the design's bare floating look), and
// legible once the page underneath it is no longer just the space backdrop.
const SCROLL_GLASS_THRESHOLD_PX = 8;

// Mobile/tablet-only header: the account avatar + current page title floating on
// the background (see nav/index.tsx, which branches on useDeviceTier).
export default function MobileHeader({ onOpenSyncConfig, onOpenSettings }: MobileHeaderProps) {
  const pathname = usePathname();
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > SCROLL_GLASS_THRESHOLD_PX);
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const title = findNavItemByPathname(pathname)?.label ?? 'Dashboard';

  return (
    <header className={isScrolled ? 'mobile-header mobile-header--scrolled' : 'mobile-header'}>
      <AccountMenu placement="below" onOpenSyncConfig={onOpenSyncConfig} onOpenSettings={onOpenSettings} />
      <h1 className="mobile-header-title">{title}</h1>
    </header>
  );
}
