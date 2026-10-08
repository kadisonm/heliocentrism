'use client';

import { ChevronDown, ChevronUp, Eye, EyeOff } from 'lucide-react';
import { moveItem } from '../../../lib/moveInArray';
import ContextMenu, { type ContextMenuPosition } from '../../common/context-menu/ContextMenu';
import { useSettings } from '../settings/useSettings';
import { useNavItems } from './useNavItems';

function toggleHiddenId(hidden: string[], id: string): string[] {
  return hidden.includes(id) ? hidden.filter((hiddenId) => hiddenId !== id) : [...hidden, id];
}

type NavOrderMenuProps = {
  position: ContextMenuPosition;
  onClose: () => void;
};

// Reorder/hide the nav's pages; opened by long-press/right-click on either the desktop bar or the mobile pill.
export default function NavOrderMenu({ position, onClose }: NavOrderMenuProps) {
  const { settings, updateSettings } = useSettings();
  const { orderedItems } = useNavItems();
  // resolveNavOrder appends pages missing from the saved order, so move against the resolved ids.
  const order = orderedItems.map((item) => item.id);

  const setNavBar = (patch: Partial<{ order: string[]; hidden: string[] }>) => {
    updateSettings({ ...settings, navBar: { ...settings.navBar, ...patch } });
  };

  return (
    <ContextMenu position={position} onClose={onClose}>
      <div className="nav-order-menu">
        {orderedItems.map((item, index) => {
          const isHidden = settings.navBar.hidden.includes(item.id);
          return (
            <div key={item.id} className="nav-order-row">
              <span className="nav-order-row-label">
                <item.icon size={14} />
                {item.label}
              </span>
              <div className="nav-order-row-controls">
                <button
                  type="button"
                  disabled={index === 0}
                  onClick={() => setNavBar({ order: moveItem(order, index, -1) })}
                  aria-label={`Move ${item.label} up`}
                >
                  <ChevronUp size={14} />
                </button>
                <button
                  type="button"
                  disabled={index === orderedItems.length - 1}
                  onClick={() => setNavBar({ order: moveItem(order, index, 1) })}
                  aria-label={`Move ${item.label} down`}
                >
                  <ChevronDown size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => setNavBar({ hidden: toggleHiddenId(settings.navBar.hidden, item.id) })}
                  aria-label={isHidden ? `Show ${item.label}` : `Hide ${item.label}`}
                >
                  {isHidden ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </ContextMenu>
  );
}
