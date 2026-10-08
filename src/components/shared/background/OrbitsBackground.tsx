import BackgroundFrame, { type BackgroundViewProps } from './BackgroundFrame';
import OrbitsScene from './OrbitsScene';

// Slow orbits over the same deep-space base as the Space background.
export default function OrbitsBackground(props: BackgroundViewProps) {
  return (
    <BackgroundFrame name="orbits" {...props}>
      <OrbitsScene />
    </BackgroundFrame>
  );
}
