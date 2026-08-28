import type { MetadataRoute } from 'next';

// Required under next.config.ts's output: "export" — a manifest route is
// dynamic by default, which static export can't serve at all.
export const dynamic = 'force-static';

// GitHub Pages serves this app from /<repo>/, not the domain root — plain
// root-relative paths aren't rewritten by Next's basePath automatically, so
// this (mirroring next.config.ts's basePath) has to be prepended by hand,
// same as nav/index.tsx.
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

// Lets Android/Chrome install the dashboard as a standalone app (and is part
// of what modern iOS Safari also checks for "Add to Home Screen") — without
// display: 'standalone', an installed/home-screen shortcut just opens the
// URL in the regular browser chrome instead of behaving like a native app.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Heliocentrism',
    short_name: 'Heliocentrism',
    description: 'Heliocentrism: the earth still orbits the sun.',
    start_url: `${BASE_PATH}/`,
    display: 'standalone',
    background_color: '#0b0b0b',
    theme_color: '#0b0b0b',
    icons: [
      { src: `${BASE_PATH}/icons/icon-192.png`, sizes: '192x192', type: 'image/png' },
      { src: `${BASE_PATH}/icons/icon-512.png`, sizes: '512x512', type: 'image/png' },
    ],
  };
}
