import type { LucideIcon } from 'lucide-react';
import type { MouseEvent, ReactNode } from 'react';

export type BadgeColor = 'none' | 'accent' | 'success' | 'warning' | 'error' | 'secondary' | 'muted';

type BadgeProps = {
  icon?: LucideIcon;
  title?: ReactNode;
  ariaLabel: string;
  color?: BadgeColor;
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
  className?: string;
};

export default function Badge({ icon: Icon, title, ariaLabel, color = 'none', onClick, className = '' }: BadgeProps) {
  const classes = `badge badge--${color} ${onClick ? 'badge--interactive' : ''} ${className}`.trim();
  // The DOM `title` attribute (not the `title` prop above, which is the
  // visible label) is what surfaces the full aria label as a native hover
  // tooltip — the mechanism the due/repeat badges rely on to reveal exact
  // date/time on hover.
  const content = (
    <>
      {Icon && <Icon size={12} />}
      {title !== undefined && <span className="badge__label">{title}</span>}
    </>
  );

  if (onClick) {
    return (
      <button type="button" className={classes} onClick={onClick} title={ariaLabel} aria-label={ariaLabel}>
        {content}
      </button>
    );
  }

  return (
    <span className={classes} title={ariaLabel} aria-label={ariaLabel}>
      {content}
    </span>
  );
}
