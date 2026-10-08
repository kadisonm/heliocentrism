'use client';

import { resolveNavOrder } from '../../../lib/nav/navItems';
import { useSettings } from '../settings/useSettings';

// The user's nav order (every page) and the subset they haven't hidden — shared by the desktop bar and mobile pill.
export function useNavItems() {
  const { settings } = useSettings();
  const orderedItems = resolveNavOrder(settings.navBar.order);
  const shownItems = orderedItems.filter((item) => !settings.navBar.hidden.includes(item.id));
  return { orderedItems, shownItems };
}
