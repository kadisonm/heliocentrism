'use client';

import { LogOut, RefreshCw, Settings, User as UserIcon } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import { signOutFirebaseUser, subscribeToAuthState } from '../../../lib/firebase/firebaseSync';
import { findNavItemByPathname } from '../../../lib/nav/navItems';
import ContextMenu, { type ContextMenuPosition } from '../../common/context-menu/ContextMenu';
import MenuItem from '../../common/context-menu/MenuItem';
import { useCloseMenuOnOutsideClick } from '../../grid/useCloseMenuOnOutsideClick';

type MobileHeaderProps = {
  onOpenSyncConfig: () => void;
  onOpenSettings: () => void;
};

function initialsFor(user: User): string {
  const source = user.displayName || user.email || '';
  const parts = source.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? '';
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

// Mobile/tablet-only header: a bare avatar + current page title floating on
// the background (see nav/index.tsx, which branches on useDeviceTier). The
// avatar opens a dropdown to the same Settings/Sync Configuration panels the
// desktop nav's icon buttons open, plus sign-out.
// Scroll distance before the header gains its frosted-glass backing — stays
// fully transparent at rest (matching the design's bare floating look), and
// legible once the page underneath it is no longer just the space backdrop.
const SCROLL_GLASS_THRESHOLD_PX = 8;

export default function MobileHeader({ onOpenSyncConfig, onOpenSettings }: MobileHeaderProps) {
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [menuPosition, setMenuPosition] = useState<ContextMenuPosition | null>(null);
  const [isScrolled, setIsScrolled] = useState(false);
  const avatarButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const unsubscribe = subscribeToAuthState(setUser);
    return () => unsubscribe?.();
  }, []);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > SCROLL_GLASS_THRESHOLD_PX);
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useCloseMenuOnOutsideClick(!!menuPosition, () => setMenuPosition(null));

  const title = findNavItemByPathname(pathname)?.label ?? 'Dashboard';

  const openMenu = () => {
    const rect = avatarButtonRef.current?.getBoundingClientRect();
    if (!rect) return;
    setMenuPosition({ x: rect.left, y: rect.bottom + 8 });
  };

  const handleSignOut = async () => {
    await signOutFirebaseUser();
    window.location.reload();
  };

  return (
    <header className={isScrolled ? 'mobile-header mobile-header--scrolled' : 'mobile-header'}>
      <button
        ref={avatarButtonRef}
        type="button"
        className="mobile-header-avatar"
        onClick={openMenu}
        title="Account"
        aria-label="Account menu"
      >
        {user?.photoURL ? (
          <img src={user.photoURL} alt="" />
        ) : user ? (
          <span className="mobile-header-avatar-initials">{initialsFor(user)}</span>
        ) : (
          <UserIcon size={18} />
        )}
      </button>

      <h1 className="mobile-header-title">{title}</h1>

      {menuPosition && (
        <ContextMenu position={menuPosition} onClose={() => setMenuPosition(null)}>
          <MenuItem
            icon={Settings}
            label="Settings"
            onClick={() => {
              onOpenSettings();
              setMenuPosition(null);
            }}
          />
          <MenuItem
            icon={RefreshCw}
            label="Sync Configuration"
            onClick={() => {
              onOpenSyncConfig();
              setMenuPosition(null);
            }}
          />
          <MenuItem icon={LogOut} label="Sign out" onClick={handleSignOut} />
        </ContextMenu>
      )}
    </header>
  );
}
