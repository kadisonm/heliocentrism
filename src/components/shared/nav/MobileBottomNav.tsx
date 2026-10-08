'use client';

import { Menu, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { NAV_VISIBLE_COUNT, type NavItem } from '../../../lib/nav/navItems';
import { useDeviceTier } from '../../grid/useDeviceTier';
import { useLongPress } from '../../grid/useLongPress';
import { useCloseMenuOnOutsideClick } from '../../grid/useCloseMenuOnOutsideClick';
import type { ContextMenuPosition } from '../../common/context-menu/ContextMenu';
import NavOrderMenu from './NavOrderMenu';
import { useNavItems } from './useNavItems';

// Floating pill nav for mobile/tablet (see nav/index.tsx). Its icon set is
// user-reorderable/toggleable (long-press or right-click the pill background
// — WIDGET_GESTURE_SKIP_SELECTOR keeps that off the links/button themselves)
// via NavBarSettings, persisted the same way every other app setting is.
export default function MobileBottomNav() {
  const pathname = usePathname();
  const tier = useDeviceTier();
  const { shownItems } = useNavItems();
  const [isOverflowOpen, setIsOverflowOpen] = useState(false);
  const [quickSettingsPosition, setQuickSettingsPosition] = useState<ContextMenuPosition | null>(null);

  const visibleCount = NAV_VISIBLE_COUNT[tier === 'tablet' ? 'tablet' : 'mobile'];
  const visibleItems = shownItems.slice(0, visibleCount);
  const overflowItems = shownItems.slice(visibleCount);

  const longPressHandlers = useLongPress({
    onLongPress: (point) => setQuickSettingsPosition(point),
  });

  useCloseMenuOnOutsideClick(!!quickSettingsPosition, () => setQuickSettingsPosition(null));

  const itemClassName = (item: NavItem) =>
    pathname === item.href ? 'mobile-bottom-nav-item mobile-bottom-nav-item--active' : 'mobile-bottom-nav-item';

  return (
    <>
      <nav
        className="mobile-bottom-nav"
        {...longPressHandlers}
        onContextMenu={(event) => {
          event.preventDefault();
          setQuickSettingsPosition({ x: event.clientX, y: event.clientY });
        }}
      >
        {visibleItems.map((item) => (
          <Link key={item.id} href={item.href} className={itemClassName(item)} aria-label={item.label} title={item.label}>
            <item.icon size={20} />
          </Link>
        ))}

        {overflowItems.length > 0 && (
          <button
            type="button"
            className="mobile-bottom-nav-toggle"
            onClick={() => setIsOverflowOpen(true)}
            title="More"
            aria-label="More"
          >
            <Menu size={20} />
          </button>
        )}
      </nav>

      {isOverflowOpen && (
        <div className="mobile-nav-overflow">
          <div className="mobile-nav-overflow-header">
            <button
              type="button"
              className="icon-button"
              onClick={() => setIsOverflowOpen(false)}
              title="Close menu"
              aria-label="Close menu"
            >
              <X size={20} />
            </button>
          </div>

          <div className="mobile-nav-overflow-links">
            {overflowItems.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                className="mobile-nav-overflow-link"
                onClick={() => setIsOverflowOpen(false)}
              >
                <item.icon size={18} />
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      )}

      {quickSettingsPosition && (
        <NavOrderMenu position={quickSettingsPosition} onClose={() => setQuickSettingsPosition(null)} />
      )}
    </>
  );
}
