'use client';

import React from 'react';

export default function ClientRoot({ children }: { children: React.ReactNode }) {
  // Place any client-only providers/hooks here to avoid marking layout as a client component.
  return <>{children}</>;
}