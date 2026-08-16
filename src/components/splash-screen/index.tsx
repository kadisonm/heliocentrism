'use client';

import { useEffect, useState } from 'react';
import OrbitAnimation from '../orbit-animation';

// Total time one play is on screen: reveal (sun -> orbit paths -> planets),
// a bit of visible orbiting, then the fade-out below finishes.
const VISIBLE_DURATION_MS = 3600;

export default function SplashScreen() {
  const [isMounted, setIsMounted] = useState(true);
  const [loop, setLoop] = useState(false);

  // Visit the page with a `?splash` query param (e.g. localhost:3000/?splash)
  // to replay the sequence forever instead of once, for tweaking it live.
  // Reading window.location is the sanctioned "sync from an external system"
  // effect pattern — it's unavailable during SSR, so it can't be derived
  // during render without desyncing the server/client hydration output.
  useEffect(() => {
    /* eslint-disable-next-line react-hooks/set-state-in-effect */
    setLoop(new URLSearchParams(window.location.search).has('splash'));
  }, []);

  // In loop mode, skip the auto-unmount entirely rather than replaying the
  // whole reveal on a timer — the reveal only needs to run once, and the
  // planet's own orbit animation is already `infinite`, so leaving it alone
  // is what actually lets a full lap (and as many more as you want) play out.
  useEffect(() => {
    if (loop) return;

    const timeout = setTimeout(() => setIsMounted(false), VISIBLE_DURATION_MS);
    return () => clearTimeout(timeout);
  }, [loop]);

  if (!isMounted) return null;

  return (
    <div className={loop ? 'splash-screen splash-screen--loop' : 'splash-screen'}>
      <div className="splash-orbit-frame">
        <OrbitAnimation />
      </div>
    </div>
  );
}
