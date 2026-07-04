import type { Metadata } from 'next';

import { LoginForm } from '@/features/auth/components/forms/login-form';

export const metadata: Metadata = { title: 'Sign in' };

export default function LoginPage() {
  return <LoginForm />;
}
