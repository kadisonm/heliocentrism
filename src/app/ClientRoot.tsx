'use client';

import React from 'react';
// import OnboardingGate from '../components/pages/onboarding-gate';

export default function ClientRoot({ children }: { children: React.ReactNode }) {
  // Place any client-only providers/hooks here to avoid marking layout as a client component.
  // TEMP QA BYPASS: return <OnboardingGate>{children}</OnboardingGate>;
  return <>{children}</>;
}