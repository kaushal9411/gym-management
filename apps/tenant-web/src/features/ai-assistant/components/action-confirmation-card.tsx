'use client';

import { CircleAlert } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { useCancelAiAction, useConfirmAiAction } from '../hooks/use-ai-assistant';
import type { AiActionProposal } from '../types';

const ACTION_LABELS: Record<AiActionProposal['type'], string> = {
  create_member: 'Create member',
  renew_membership: 'Renew membership',
  assign_workout: 'Assign workout plan',
  assign_diet: 'Assign diet plan',
  generate_report: 'Generate report',
  send_notification: 'Send notification',
};

interface ActionConfirmationCardProps {
  conversationId: string;
  messageId: string;
  action: AiActionProposal;
  /** `null` once resolved — pending PROPOSAL only ever renders the buttons while this is `'PENDING'`. */
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED' | null;
}

/** The one place a proposed AI action becomes real — "Never execute write operations without confirmation" lives here, not in the chat stream. */
export function ActionConfirmationCard({ conversationId, messageId, action, status }: ActionConfirmationCardProps) {
  const confirm = useConfirmAiAction();
  const cancel = useCancelAiAction();

  if (status !== 'PENDING') return null;

  return (
    <div className="mx-auto w-full max-w-[85%] rounded-xl border border-warning/30 bg-warning/5 p-3 text-sm">
      <div className="flex items-start gap-2">
        <CircleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
        <div>
          <p className="font-medium">{ACTION_LABELS[action.type]}</p>
          <p className="text-muted-foreground">{action.summary}</p>
        </div>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={cancel.isPending || confirm.isPending}
          onClick={() => cancel.mutate({ conversationId, messageId }, { onError: () => toast.error('Could not cancel this action.') })}
        >
          Cancel
        </Button>
        <Button
          size="sm"
          disabled={cancel.isPending || confirm.isPending}
          onClick={() =>
            confirm.mutate(
              { conversationId, messageId },
              { onSuccess: () => toast.success('Action completed.'), onError: (err) => toast.error(err instanceof Error ? err.message : 'Action failed.') },
            )
          }
        >
          Confirm
        </Button>
      </div>
    </div>
  );
}
