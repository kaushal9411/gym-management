import type { Metadata } from 'next';

import { StaffActivationView } from '@/features/staff/components/staff-activation-view';

export const metadata: Metadata = { title: 'Activate your account' };

interface StaffActivationPageProps {
  params: Promise<{ token: string }>;
}

export default async function StaffActivationPage({ params }: StaffActivationPageProps) {
  const { token } = await params;
  return <StaffActivationView token={token} />;
}
