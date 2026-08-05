import type { Metadata } from 'next';

import { MfaSetupForm } from '@/features/auth/components/forms/mfa-setup-form';

export const metadata: Metadata = { title: 'Set up two-factor authentication' };

interface MfaSetupPageProps {
  searchParams: Promise<{ email?: string; setupToken?: string }>;
}

/** Reached only from a `mfa_setup_required` login challenge — the tenant now requires 2FA for this role and it isn't set up yet. */
export default async function MfaSetupPage({ searchParams }: MfaSetupPageProps) {
  const { email = '', setupToken = '' } = await searchParams;
  return <MfaSetupForm email={email} setupToken={setupToken} />;
}
