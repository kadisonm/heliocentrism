'use client';

import { useEffect } from 'react';
import { useSettings } from '../settings/useSettings';
import SpaceBackground from './SpaceBackground';

// Renders the user's chosen page background (see general-settings) behind
// every route — mounted once in layout.tsx, same pattern as ThemeSync.
// Stamps a data-background attribute on <html> too, so pages/dashboard.scss
// can make .dashboard-wrapper's own opaque background transparent for any
// variant other than 'none', letting this show through underneath it.
export default function Background() {
  const { settings, isLoading } = useSettings();

  useEffect(() => {
    if (isLoading) return;
    document.documentElement.dataset.background = settings.background.variant;
  }, [isLoading, settings.background.variant]);

  if (isLoading) return null;

  switch (settings.background.variant) {
    case 'space':
      return <SpaceBackground />;
    case 'none':
      return null;
  }
}
