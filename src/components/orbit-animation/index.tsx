// Both ellipses are centered at (140, 90), traced starting from their
// topmost point — these exact path strings are shared by the visible orbit
// rings and each planet's offset-path so they can never drift apart.
const ORBIT_PATH_INNER = 'M 140,30 A 100,60 0 1 1 139.99,30 Z';
const ORBIT_PATH_OUTER = 'M 140,12 A 130,78 0 1 1 139.99,12 Z';

export default function OrbitAnimation() {
  return (
    <svg className="orbit-scene" viewBox="0 0 280 180" aria-hidden="true">
      <path className="orbit-path orbit-path--inner" fill="none" d={ORBIT_PATH_INNER} />
      <path className="orbit-path orbit-path--outer" fill="none" d={ORBIT_PATH_OUTER} />

      {/*
        The outer planet is rendered twice at identical, perfectly
        synchronized positions (same offset-path + motion animation) — SVG
        has no reliable z-index-based stacking for plain shapes, only DOM
        order, so going behind/in front of the inner planet means literally
        being earlier/later in the markup. Each copy's visibility is
        toggled to the opposite portion of the orbit, so only one is ever
        actually shown at a time.
      */}
      <circle className="orbit-planet orbit-planet--outer orbit-planet--outer-behind" r="18" />
      <circle className="orbit-planet orbit-planet--inner" r="16" />
      <circle className="orbit-planet orbit-planet--outer orbit-planet--outer-front" r="18" />

      <circle className="orbit-sun" cx="140" cy="80" r="44" />
    </svg>
  );
}
