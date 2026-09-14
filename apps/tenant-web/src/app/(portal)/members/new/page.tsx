'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { AddMemberWizard } from '@/features/members/components/add-member-wizard/add-member-wizard';

export default function NewMemberPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/members">
          <ArrowLeft className="size-4" /> Back to members
        </Link>
      </Button>

      <h1 className="text-lg font-semibold">Add a member</h1>

      <AddMemberWizard />
    </div>
  );
}
