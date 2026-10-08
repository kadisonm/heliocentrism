'use client';

import { ImageOff } from 'lucide-react';
import WidgetPlaceholder from '../../common/WidgetPlaceholder';
import { useWidgetContext } from '../../grid/widgetContext';

export default function PhotoWidget() {
  const { widget } = useWidgetContext();
  const photo = widget.photo;

  if (!photo?.url) {
    return <WidgetPlaceholder icon={ImageOff} message="Add an image URL via widget settings." />;
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
