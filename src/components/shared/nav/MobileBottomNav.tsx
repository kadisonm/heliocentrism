'use client';

import { ChevronDown, ChevronUp, Eye, EyeOff, Menu, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { NAV_VISIBLE_COUNT, resolveNavOrder, type NavItem } from '../../../lib/nav/navItems';
import { useSettings } from '../settings/useSettings';
import { useDeviceTier } from '../../grid/useDeviceTier';
import { useLongPress } from '../../grid/useLongPress';
import { useCloseMenuOnOutsideClick } from '../../grid/useCloseMenuOnOutsideClick';
import ContextMenu, { type ContextMenuPosition } from '../../common/context-menu/ContextMenu';

function moveId(order: string[], id: string, direction: -1 | 1): string[] {
  const index = order.indexOf(id);
  const swapIndex = index + direction;
  if (index < 0 || swapIndex < 0 || swapIndex >= order.length) return order;
  const next = [...order];
  [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  return next;
}

function toggleHiddenId(hidden: string[], id: string): string[] {
  return hidden.includes(id) ? hidden.filter((hiddenId) => hiddenId !== id) : [...hidden, id];
}

// Floating pill nav for mobile/tablet (see nav/index.tsx). Its icon set is
// user-reorderable/toggleable (long-press or right-click the pill background
// — WIDGET_GESTURE_SKIP_SELECTOR keeps that off the links/button themselves)
// via NavBarSettings, persisted the same way every other app setting is.
export default function MobileBottomNav() {
  const pathname = usePathname();
  const tier = useDeviceTier();
  const { settings, updateSettings } = useSettings();
  const [isOverflowOpen, setIsOverflowOpen] = useState(false);
  const [quickSettingsPosition, setQuickSettingsPosition] = useState<ContextMenuPosition | null>(null);

  const orderedItems = resolveNavOrder(settings.navBar.order);
  const visibleCount = NAV_VISIBLE_COUNT[tier === 'tablet' ? 'tablet' : 'mobile'];
  const shownItems = orderedItems.filter((item) => !settings.navBar.hidden.includes(item.id));
  const visibleItems = shownItems.slice(0, visibleCount);
  const overflowItems = shownItems.slice(visibleCount);

  const longPressHandlers = useLongPress({
    onLongPress: (point) => setQuickSettingsPosition(point),
  });

  useCloseMenuOnOutsideClick(!!quickSettingsPosition, () => setQuickSettingsPosition(null));

  const setNavBar = (patch: Partial<{ order: string[]; hidden: string[] }>) => {
    updateSettings({ ...settings, navBar: { ...settings.navBar, ...patch } });
  };

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
        <ContextMenu position={quickSettingsPosition} onClose={() => setQuickSettingsPosition(null)}>
          <div className="nav-order-menu">
            {orderedItems.map((item, index) => {
              const isHidden = settings.navBar.hidden.includes(item.id);
              return (
                <div key={item.id} className="nav-order-row">
                  <span className="nav-order-row-label">
                    <item.icon size={14} />
                    {item.label}
                  </span>
                  <div className="nav-order-row-controls">
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() => setNavBar({ order: moveId(settings.navBar.order, item.id, -1) })}
                      aria-label={`Move ${item.label} up`}
                    >
                      <ChevronUp size={14} />
                    </button>
                    <button
                      type="button"
                      disabled={index === orderedItems.length - 1}
                      onClick={() => setNavBar({ order: moveId(settings.navBar.order, item.id, 1) })}
                      aria-label={`Move ${item.label} down`}
                    >
                      <ChevronDown size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setNavBar({ hidden: toggleHiddenId(settings.navBar.hidden, item.id) })}
                      aria-label={isHidden ? `Show ${item.label}` : `Hide ${item.label}`}
                    >
                      {isHidden ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </ContextMenu>
      )}
    </>
  );
}
