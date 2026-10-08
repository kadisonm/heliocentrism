import BackgroundFrame, { type BackgroundViewProps } from './BackgroundFrame';

// For designs drawn entirely in CSS on the frame itself (styled by `${name}-background`).
export function cssBackground(name: string) {
  function CssBackground(props: BackgroundViewProps) {
    return <BackgroundFrame name={name} {...props} />;
  }
  CssBackground.displayName = `CssBackground(${name})`;
  return CssBackground;
}
