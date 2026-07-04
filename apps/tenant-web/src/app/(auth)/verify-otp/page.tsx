import type { Metadata } from 'next';

import { OtpForm } from '@/features/auth/components/forms/otp-form';
import type { OtpFlow } from '@/features/auth/types';

export const metadata: Metadata = { title: 'Verify code' };

interface VerifyOtpPageProps {
  searchParams: Promise<{ email?: string; flow?: string }>;
}

export default async function VerifyOtpPage({ searchParams }: VerifyOtpPageProps) {
  const { email = '', flow = 'login' } = await searchParams;
  const safeFlow: OtpFlow = flow === '2fa' || flow === 'register' ? flow : 'login';
  return <OtpForm email={email} flow={safeFlow} variant="otp" />;
}
