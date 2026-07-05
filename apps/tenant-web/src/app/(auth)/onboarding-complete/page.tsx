import type { Metadata } from 'next';

import { OnboardingHandoff } from '@/features/onboarding/components/onboarding-handoff';

export const metadata: Metadata = { title: 'Setting up your account' };

/** Cross-origin token handoff target — reached only via the registration wizard's success step. */
export default function OnboardingCompletePage() {
  return <OnboardingHandoff />;
}
