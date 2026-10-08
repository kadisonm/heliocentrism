import type { LucideIcon } from 'lucide-react';

// Centred icon + hint filling a widget that has nothing to show yet (e.g. not configured).
export default function WidgetPlaceholder({ icon: Icon, message }: { icon: LucideIcon; message: string }) {
  return (
    <div className="widget-placeholder">
      <Icon size={28} />
      <p>{message}</p>
    </div>
  );
}
