import type { Metadata } from 'next';
import Link from 'next/link';
import { ShieldX } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { StatusScreen } from '@/features/auth/components/status-screen';
import { AUTH_ROUTES } from '@/features/auth/constants';

export const metadata: Metadata = { title: 'Access denied' };

export default function AccessDeniedPage() {
  return (
    <StatusScreen
      icon={ShieldX}
      tone="destructive"
      title="You don't have access to this page"
      description="Your role doesn't include permission for this area. If you believe this is a mistake, ask your gym owner or manager to update your access."
      footnote="Error code: 403 · FORBIDDEN"
    >
      <Button asChild className="w-full sm:w-auto">
        <Link href={AUTH_ROUTES.login}>Back to login</Link>
      </Button>
    </StatusScreen>
  );
}
