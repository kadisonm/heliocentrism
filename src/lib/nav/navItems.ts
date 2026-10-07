import { Briefcase, Calendar, Mail, Orbit, Users, type LucideIcon } from 'lucide-react';

export type NavItem = {
  id: string;
  href: string;
  label: string;
  icon: LucideIcon;
};

// Single source of truth for the app's top-level pages — DesktopNav, the
// mobile header's title lookup, and MobileBottomNav all map over this
// instead of each hardcoding their own list. Add a page by adding an entry.
export const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', href: '/', label: 'Dashboard', icon: Orbit },
  { id: 'mail', href: '/mail', label: 'Mail', icon: Mail },
  { id: 'projects', href: '/projects', label: 'Projects', icon: Briefcase },
  { id: 'calendar', href: '/calendar', label: 'Calendar', icon: Calendar },
  { id: 'family', href: '/family', label: 'Family', icon: Users },
];

export function findNavItemByPathname(pathname: string): NavItem | undefined {
  return NAV_ITEMS.find((item) => item.href === pathname);
}

// How many pill icons MobileBottomNav shows before overflowing the rest into
// its hamburger menu — tablet has more room, so it shows more.
export const NAV_VISIBLE_COUNT: Record<'mobile' | 'tablet', number> = {
  mobile: 3,
  tablet: 5,
};

// Resolves a persisted NavBarSettings.order (ids) against the current
// NAV_ITEMS, appending any item added to NAV_ITEMS after the order was last
// saved — so a new page shows up for existing users instead of vanishing.
export function resolveNavOrder(order: string[]): NavItem[] {
  const byId = new Map(NAV_ITEMS.map((item) => [item.id, item]));
  const ordered = order.map((id) => byId.get(id)).filter((item): item is NavItem => !!item);
  const missing = NAV_ITEMS.filter((item) => !order.includes(item.id));
  return [...ordered, ...missing];
}
