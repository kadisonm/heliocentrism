import type { LucideIcon } from 'lucide-react';
import type { BadgeColor } from '../Badge';

type MenuItemProps = {
  icon: LucideIcon;
  label: string;
  // Reuses Badge's color set for consistency with the rest of the app's
  // color system, though the meaning here is just icon/text color (no
  // background pill) — 'none' (default) is full-contrast text, not
  // muted, since that's what a menu item's normal/non-destructive state
  // should read as.
  color?: BadgeColor;
  onClick: () => void;
};

export default function MenuItem({ icon: Icon, label, color = 'none', onClick }: MenuItemProps) {
  const classes = `menu-item ${color !== 'none' ? `menu-item--${color}` : ''}`.trim();

  return (
    <button type="button" className={classes} onClick={onClick}>
      <Icon size={14} />
      {label}
    </button>
  );
}
