import type { Metadata } from 'next';

import { VerifyEmailView } from '@/features/auth/components/forms/verify-email-view';

export const metadata: Metadata = { title: 'Verify email' };

interface VerifyEmailPageProps {
  searchParams: Promise<{ token?: string; status?: string; email?: string }>;
}

export default async function VerifyEmailPage({ searchParams }: VerifyEmailPageProps) {
  const { token = '', status = '', email = '' } = await searchParams;
  return <VerifyEmailView token={token} status={status} email={email} />;
}
