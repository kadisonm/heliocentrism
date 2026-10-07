'use client';

import { useState } from 'react';
import GeneralSettingsPanel from '../../pages/general-settings';
import SyncConfigPanel from '../../pages/sync-config';
import { useDeviceTier } from '../../grid/useDeviceTier';
import DesktopNav from './DesktopNav';
import MobileHeader from './MobileHeader';
import MobileBottomNav from './MobileBottomNav';

// Branches into two structurally different layouts (not just a CSS collapse)
// — DesktopNav's top bar for >=1200px, or MobileHeader + MobileBottomNav for
// tablet/mobile — sharing the Settings/Sync Configuration panel state here so
// either branch can open them.
export default function Nav() {
  const tier = useDeviceTier();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSyncConfigOpen, setIsSyncConfigOpen] = useState(false);

  return (
    <>
      {tier === 'desktop' ? (
        <DesktopNav
          onOpenSyncConfig={() => setIsSyncConfigOpen(true)}
          onOpenSettings={() => setIsSettingsOpen(true)}
        />
      ) : (
        <>
          <MobileHeader
            onOpenSyncConfig={() => setIsSyncConfigOpen(true)}
            onOpenSettings={() => setIsSettingsOpen(true)}
          />
          <MobileBottomNav />
        </>
      )}

      <GeneralSettingsPanel isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />

      <SyncConfigPanel
        isOpen={isSyncConfigOpen}
        onClose={() => setIsSyncConfigOpen(false)}
        onSyncConfigured={() => {
          // Refresh tasks if needed
          window.location.reload();
        }}
      />
    </>
  );
}
