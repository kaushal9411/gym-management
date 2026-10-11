'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { UserPlus } from 'lucide-react';
import { toast } from 'sonner';

import { PanelCard } from '@/features/finance/components/payments/payments-ui';
import { toLeadError, useCreateLead } from '../../hooks/use-leads';
import type { CreateLeadPayload } from '../../types';
import { LeadForm } from '../shared/lead-form';

/** Inline "New lead" panel (no modal). Duplicate matches (409) show as a banner with links, inside the form. */
export function CreateLeadPanel({ canAssign, onClose }: { canAssign: boolean; onClose: () => void }) {
  const create = useCreateLead();
  const router = useRouter();
  const submit = async (p: CreateLeadPayload) => {
    try {
      const lead = await create.mutateAsync(p);
      toast.success(`Lead ${lead.name} created.`);
      onClose();
      router.push(`/leads/${lead.id}`);
    } catch (e) {
      throw toLeadError(e);
    }
  };
  return (
    <PanelCard
      title={<span className="inline-flex items-center gap-2"><UserPlus className="size-[18px]" aria-hidden />New lead</span>}
      subtitle="Capture an enquiry. Phone and email are checked against open leads and members."
    >
      <LeadForm mode="create" canAssign={canAssign} onSubmit={submit} onCancel={onClose} />
    </PanelCard>
  );
}
