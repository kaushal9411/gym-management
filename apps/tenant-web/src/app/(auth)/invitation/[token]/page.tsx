import type { Metadata } from 'next';

import { InvitationView } from '@/features/auth/components/forms/invitation-view';

export const metadata: Metadata = { title: 'Accept invitation' };

interface InvitationPageProps {
  params: Promise<{ token: string }>;
}

export default async function InvitationPage({ params }: InvitationPageProps) {
  const { token } = await params;
  return <InvitationView token={token} />;
}
