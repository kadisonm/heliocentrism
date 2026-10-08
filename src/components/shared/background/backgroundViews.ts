import type { ComponentType } from 'react';
import type { BackgroundVariant } from '../../../lib/types';
import type { BackgroundViewProps } from './BackgroundFrame';
import BokehBackground from './BokehBackground';
import { cssBackground } from './cssBackground';
import ImageBackground from './ImageBackground';
import LavaLampBackground from './LavaLampBackground';
import MatrixBackground from './MatrixBackground';
import NebulaBackground from './NebulaBackground';
import OrbitsBackground from './OrbitsBackground';
import PixelSkyBackground from './PixelSkyBackground';
import SynthwaveBackground from './SynthwaveBackground';
import TopographicBackground from './TopographicBackground';
import WavesBackground from './WavesBackground';

// Every background drawn on BackgroundFrame — rendered full-screen by Background and, contained + paused, as its
// own settings swatch. 'none' and 'space' are handled separately (space's starfield doesn't scale into a swatch).
export const BACKGROUND_VIEWS: Partial<Record<BackgroundVariant, ComponentType<BackgroundViewProps>>> = {
  orbits: OrbitsBackground,
  nebula: NebulaBackground,
  image: ImageBackground,
  'lava-lamp': LavaLampBackground,
  waves: WavesBackground,
  bokeh: BokehBackground,
  'dot-grid': cssBackground('dot-grid'),
  'graph-paper': cssBackground('graph-paper'),
  topographic: TopographicBackground,
  synthwave: SynthwaveBackground,
  'pixel-sky': PixelSkyBackground,
  matrix: MatrixBackground,
};
