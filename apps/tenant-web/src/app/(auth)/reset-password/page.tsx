import type { Metadata } from 'next';

import { ResetPasswordForm } from '@/features/auth/components/forms/reset-password-form';

export const metadata: Metadata = { title: 'Reset password' };

interface ResetPasswordPageProps {
  searchParams: Promise<{ token?: string }>;
}

export default async function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
  const { token = '' } = await searchParams;
  return <ResetPasswordForm token={token} />;
}
