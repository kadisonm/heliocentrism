import BackgroundFrame, { type BackgroundViewProps } from './BackgroundFrame';

// Striped sunset over a neon grid floor scrolling toward the horizon — see synthwave-background.scss.
export default function SynthwaveBackground(props: BackgroundViewProps) {
  return (
    <BackgroundFrame name="synthwave" {...props}>
      <div className="synthwave-background__sun" />
      <div className="synthwave-background__floor">
        <div className="synthwave-background__grid" />
      </div>
    </BackgroundFrame>
  );
}
