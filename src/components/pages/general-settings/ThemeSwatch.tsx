import type { ThemePalette } from '../../../lib/types';

type ThemeSwatchProps = {
  palette: ThemePalette;
  mode: 'light' | 'dark';
};

// A tiny mock of the app (page, card, text, accent) painted in another palette's real tokens via data-theme-preview.
export default function ThemeSwatch({ palette, mode }: ThemeSwatchProps) {
  return (
    <span className="theme-swatch" data-theme-preview={`${palette}-${mode}`}>
      <span className="theme-swatch__card">
        <span className="theme-swatch__line theme-swatch__line--title" />
        <span className="theme-swatch__line" />
        <span className="theme-swatch__pill" />
      </span>
      <span className="theme-swatch__dots">
        <span className="theme-swatch__dot theme-swatch__dot--primary" />
        <span className="theme-swatch__dot theme-swatch__dot--secondary" />
        <span className="theme-swatch__dot theme-swatch__dot--accent" />
      </span>
    </span>
  );
}
