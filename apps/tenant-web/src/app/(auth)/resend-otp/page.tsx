import type { Metadata } from 'next';

import { ResendOtpForm } from '@/features/auth/components/forms/resend-otp-form';

export const metadata: Metadata = { title: 'Resend code' };

interface ResendOtpPageProps {
  searchParams: Promise<{ email?: string }>;
}

export default async function ResendOtpPage({ searchParams }: ResendOtpPageProps) {
  const { email = '' } = await searchParams;
  return <ResendOtpForm initialEmail={email} />;
}
