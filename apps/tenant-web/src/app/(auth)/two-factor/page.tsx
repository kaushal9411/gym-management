import type { Metadata } from 'next';

import { OtpForm } from '@/features/auth/components/forms/otp-form';

export const metadata: Metadata = { title: 'Two-factor authentication' };

interface TwoFactorPageProps {
  searchParams: Promise<{ email?: string }>;
}

/** Future-ready TOTP challenge — same engine as OTP, authenticator copy. */
export default async function TwoFactorPage({ searchParams }: TwoFactorPageProps) {
  const { email = '' } = await searchParams;
  return <OtpForm email={email} flow="2fa" variant="2fa" />;
}
