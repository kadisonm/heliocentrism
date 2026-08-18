'use client';

import { ImageOff } from 'lucide-react';
import { useWidgetContext } from '../../grid/widgetContext';

export default function PhotoWidget() {
  const { widget } = useWidgetContext();
  const photo = widget.photo;

  if (!photo?.url) {
    return (
      <div className="photo-widget-empty">
        <ImageOff size={28} />
        <p>Add an image URL via widget settings.</p>
      </div>
    );
  }

  return (
    <div className="photo-widget">
      {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary
          external URL the user pastes in; Next's <Image> needs either a
          static import or a configured remote domain allowlist, neither
          of which fits an open "paste any link" field. */}
      <img
        src={photo.url}
        alt={photo.alt ?? ''}
        className={`photo-widget-image photo-widget-image--${photo.fit ?? 'cover'}`}
      />
    </div>
  );
}
