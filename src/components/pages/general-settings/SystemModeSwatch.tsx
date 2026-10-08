import type { ThemePalette } from '../../../lib/types';
import ThemeSwatch from './ThemeSwatch';

// "System" appearance: the light and dark previews split diagonally, since it follows the device either way.
export default function SystemModeSwatch({ palette }: { palette: ThemePalette }) {
  return (
    <span className="system-mode-swatch">
      <ThemeSwatch palette={palette} mode="light" />
      <span className="system-mode-swatch__dark">
        <ThemeSwatch palette={palette} mode="dark" />
      </span>
    </span>
  );
}
