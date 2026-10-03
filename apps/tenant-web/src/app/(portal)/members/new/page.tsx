'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { AddMemberWizard } from '@/features/members/components/add-member-wizard/add-member-wizard';

export default function NewMemberPage() {
  return (
    <div className="w-full space-y-4">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/members">
          <ArrowLeft className="size-4" /> Back to members
        </Link>
      </Button>

      <AddMemberWizard />
    </div>
  );
}
