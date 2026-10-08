'use client';

import { LogOut, RefreshCw, Settings, User as UserIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import { signOutFirebaseUser, subscribeToAuthState } from '../../../lib/firebase/firebaseSync';
import ContextMenu, { type ContextMenuPosition } from '../../common/context-menu/ContextMenu';
import MenuItem from '../../common/context-menu/MenuItem';
import { useCloseMenuOnOutsideClick } from '../../grid/useCloseMenuOnOutsideClick';

// Which side of the avatar the menu opens on — away from the screen edge the nav sits against.
export type AccountMenuPlacement = 'below' | 'above' | 'right' | 'left';

type AccountMenuProps = {
  placement: AccountMenuPlacement;
  onOpenSyncConfig: () => void;
  onOpenSettings: () => void;
};

const MENU_GAP_PX = 8;

function initialsFor(user: User): string {
  const source = user.displayName || user.email || '';
  const parts = source.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? '';
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

// ContextMenu flips itself to stay on-screen, so the anchor only needs to sit on the right side of the avatar.
function anchorFor(rect: DOMRect, placement: AccountMenuPlacement): ContextMenuPosition {
  switch (placement) {
    case 'below':
      return { x: rect.left, y: rect.bottom + MENU_GAP_PX };
    case 'above':
      return { x: rect.left, y: rect.top - MENU_GAP_PX };
    case 'right':
      return { x: rect.right + MENU_GAP_PX, y: rect.top };
    case 'left':
      return { x: rect.left - MENU_GAP_PX, y: rect.top };
  }
}

// The signed-in user's avatar (photo, initials, or a generic icon), opening Settings / Sync / Sign out.
export default function AccountMenu({ placement, onOpenSyncConfig, onOpenSettings }: AccountMenuProps) {
  const [user, setUser] = useState<User | null>(null);
  const [menuPosition, setMenuPosition] = useState<ContextMenuPosition | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const unsubscribe = subscribeToAuthState(setUser);
    return () => unsubscribe?.();
  }, []);

  useCloseMenuOnOutsideClick(!!menuPosition, () => setMenuPosition(null));

  const openMenu = () => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) setMenuPosition(anchorFor(rect, placement));
  };

  const handleSignOut = async () => {
    await signOutFirebaseUser();
    window.location.reload();
  };

  return (
    <>
      <button ref={buttonRef} type="button" className="account-avatar" onClick={openMenu} title="Account" aria-label="Account menu">
        {user?.photoURL ? (
          <img src={user.photoURL} alt="" />
        ) : user ? (
          <span className="account-avatar__initials">{initialsFor(user)}</span>
        ) : (
          <UserIcon size={18} />
        )}
      </button>

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
    </>
  );
}
