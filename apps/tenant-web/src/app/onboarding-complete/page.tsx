import type { Metadata } from 'next';

import { OnboardingHandoff } from '@/features/onboarding/components/onboarding-handoff';

export const metadata: Metadata = { title: 'Setting up your account' };

/**
 * Cross-origin token handoff target — reached via the registration wizard's success step and the bare-host login.
 * Own top-level segment (not under `(auth)`) — same reason as `/login`: `OnboardingHandoff` renders a complete,
 * self-contained neon-glass page shell, so the shared `(auth)/layout.tsx` split-screen must not mount under it.
 */
export default function OnboardingCompletePage() {
  return <OnboardingHandoff />;
}
