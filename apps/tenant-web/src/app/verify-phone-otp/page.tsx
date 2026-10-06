import type { Metadata } from 'next';

import { PhoneOtpForm } from '@/features/auth/components/forms/phone-otp-form';

export const metadata: Metadata = { title: 'Verify code' };

interface VerifyPhoneOtpPageProps {
  searchParams: Promise<{ phone?: string; role?: string }>;
}

/**
 * Own top-level segment (not under `(auth)`) — `PhoneOtpForm` renders a
 * complete, self-contained page shell (neon background/header/footer), same
 * reason `/login` and `/register` already live outside `(auth)`: nesting it
 * inside the shared `(auth)/layout.tsx` would leave that layout's own
 * background/chrome still mounted underneath, just visually covered.
 */
export default async function VerifyPhoneOtpPage({ searchParams }: VerifyPhoneOtpPageProps) {
  const { phone = '', role = 'staff' } = await searchParams;
  const safeRole = role === 'member' ? 'member' : 'staff';
  return <PhoneOtpForm phone={phone} role={safeRole} />;
}
