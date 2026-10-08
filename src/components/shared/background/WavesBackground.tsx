import BackgroundFrame, { type BackgroundViewProps } from './BackgroundFrame';

const WIDTH = 1200;
const HEIGHT = 800;
const WAVELENGTH = 300; // each line slides by exactly one wavelength, so the loop is seamless
const LINE_COUNT = 14;

// A sine line from just off the left edge to one wavelength past the right, as smooth quadratic segments.
function wavePath(y: number, amplitude: number): string {
  let d = `M ${-WAVELENGTH},${y}`;
  for (let x = -WAVELENGTH; x < WIDTH + WAVELENGTH; x += WAVELENGTH / 2) {
    const direction = (x / (WAVELENGTH / 2)) % 2 === 0 ? -1 : 1;
    d += ` Q ${x + WAVELENGTH / 4},${y + direction * amplitude} ${x + WAVELENGTH / 2},${y}`;
  }
  return d;
}

// Thin parallel lines rippling sideways at slightly different speeds, like contour lines or sound waves.
export default function WavesBackground(props: BackgroundViewProps) {
  return (
    <BackgroundFrame name="waves" {...props}>
      <svg className="waves-background__svg" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="xMidYMid slice">
        {Array.from({ length: LINE_COUNT }, (_, index) => (
          <path
            key={index}
            className={`waves-background__line waves-background__line--${index % 2 === 0 ? 'primary' : 'accent'}`}
            d={wavePath(40 + index * 55, 14 + (index % 4) * 6)}
            style={{ animationDuration: `${18 + (index % 5) * 6}s` }}
          />
        ))}
      </svg>
    </BackgroundFrame>
  );
}
