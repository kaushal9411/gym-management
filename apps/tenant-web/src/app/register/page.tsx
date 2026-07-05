import type { Metadata } from 'next';

import { RegistrationWizard } from '@/features/onboarding/components/registration-wizard';

export const metadata: Metadata = { title: 'Create your gym' };

/**
 * Gym-owner onboarding — the 7-step automatic provisioning wizard (Prompt
 * 7). Supersedes the earlier single-step form (Prompt 4/6's RegisterForm,
 * still present in features/auth for reference but no longer routed here).
 * Lives in its own top-level segment (not `(auth)`) since the wizard needs
 * more width than that group's shared `max-w-md` shell (see register/layout.tsx).
 */
export default function RegisterPage() {
  return <RegistrationWizard />;
}
