import type { LucideIcon } from 'lucide-react';
import type { BadgeColor } from '../Badge';

type MenuItemProps = {
  icon: LucideIcon;
  label: string;
  // Reuses Badge's color set for app-wide consistency, but here it colors
  // icon/text only (no pill); 'none' means full-contrast text, since that's
  // a menu item's normal/non-destructive state.
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
