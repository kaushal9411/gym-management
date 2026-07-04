import type { Metadata } from 'next';

import { RegisterForm } from '@/features/auth/components/forms/register-form';

export const metadata: Metadata = { title: 'Create your gym' };

/** Gym-owner registration — reached from the marketing site's CTA. */
export default function RegisterPage() {
  return <RegisterForm />;
}
