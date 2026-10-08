'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import type { NavBarPosition } from '../../../lib/types';
import type { ContextMenuPosition } from '../../common/context-menu/ContextMenu';
import { useCloseMenuOnOutsideClick } from '../../grid/useCloseMenuOnOutsideClick';
import { useLongPress } from '../../grid/useLongPress';
import { useSettings } from '../settings/useSettings';
import AccountMenu, { type AccountMenuPlacement } from './AccountMenu';
import NavOrderMenu from './NavOrderMenu';
import { useNavItems } from './useNavItems';

// GitHub Pages serves this app from /<repo>/, not the domain root — plain
// <img src="/..."> paths aren't rewritten by Next's basePath automatically,
// so this (mirroring next.config.ts's basePath) has to be prepended by hand.
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

// The account menu opens away from whichever screen edge the bar is docked to.
const ACCOUNT_MENU_PLACEMENT: Record<NavBarPosition, AccountMenuPlacement> = {
  top: 'below',
  bottom: 'above',
  left: 'right',
  right: 'left',
};

type DesktopNavProps = {
  onOpenSyncConfig: () => void;
  onOpenSettings: () => void;
};

// >=1200px only (see useDeviceTier) — mobile/tablet render MobileHeader +
// MobileBottomNav instead. Docks to the edge chosen in settings: a bar along the
// top/bottom, or a rail down the left/right (see desktop-nav.scss for the layout offsets).
export default function DesktopNav({ onOpenSyncConfig, onOpenSettings }: DesktopNavProps) {
  const pathname = usePathname();
  const { settings } = useSettings();
  const { shownItems } = useNavItems();
  const [orderMenuPosition, setOrderMenuPosition] = useState<ContextMenuPosition | null>(null);
  const position = settings.navBar.position;
  const isRail = position === 'left' || position === 'right';

  const longPressHandlers = useLongPress({ onLongPress: (point) => setOrderMenuPosition(point) });
  useCloseMenuOnOutsideClick(!!orderMenuPosition, () => setOrderMenuPosition(null));

  return (
    <>
      <nav
        className={`app-nav app-nav--${position}`}
        {...longPressHandlers}
        onContextMenu={(event) => {
          event.preventDefault();
          setOrderMenuPosition({ x: event.clientX, y: event.clientY });
        }}
      >
        <Link href="/" className="app-nav-logo" aria-label="Heliocentrism home">
          <img src={`${BASE_PATH}/${isRail ? 'logo.svg' : 'wordmark.svg'}`} alt="Heliocentrism" />
        </Link>

        <div className="app-nav-items">
          {shownItems.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              className={pathname === item.href ? 'app-nav-item app-nav-item--active' : 'app-nav-item'}
              title={item.label}
            >
              <item.icon size={isRail ? 20 : 18} />
              <span className="app-nav-item__label">{item.label}</span>
            </Link>
          ))}
        </div>

        <div className="app-nav-account">
          <AccountMenu
            placement={ACCOUNT_MENU_PLACEMENT[position]}
            onOpenSyncConfig={onOpenSyncConfig}
            onOpenSettings={onOpenSettings}
          />
        </div>
      </nav>

      {orderMenuPosition && <NavOrderMenu position={orderMenuPosition} onClose={() => setOrderMenuPosition(null)} />}
    </>
  );
}
