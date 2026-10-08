import BackgroundFrame, { type BackgroundViewProps } from './BackgroundFrame';

// Soft palette-coloured clouds drifting through each other — see nebula-background.scss.
export default function NebulaBackground(props: BackgroundViewProps) {
  return (
    <BackgroundFrame name="nebula" {...props}>
      <div className="nebula-background__clouds" />
      <div className="nebula-background__clouds nebula-background__clouds--counter" />
    </BackgroundFrame>
  );
}
