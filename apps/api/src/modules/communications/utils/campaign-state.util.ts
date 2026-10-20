import type { CampaignStatus } from '@prisma/client';

import { AppError } from '../../../core/errors/app-error';
import { ErrorCode } from '../../../core/errors/error-codes';

export type CampaignAction = 'edit' | 'send' | 'cancel' | 'retry';

const ALLOWED: Record<CampaignAction, readonly CampaignStatus[]> = {
  edit: ['DRAFT', 'SCHEDULED'],
  send: ['DRAFT'],
  cancel: ['DRAFT', 'SCHEDULED', 'SENDING'],
  retry: ['SENT', 'PARTIAL', 'FAILED'],
};

const VERB: Record<CampaignAction, string> = {
  edit: 'edited',
  send: 'sent',
  cancel: 'cancelled',
  retry: 'retried',
};

export function canTransition(status: CampaignStatus, action: CampaignAction): boolean {
  return ALLOWED[action].includes(status);
}

/** Throws the standard 409 INVALID_STATE with a sentence that tells the user why. */
export function assertCanTransition(status: CampaignStatus, action: CampaignAction): void {
  if (canTransition(status, action)) return;
  const hint: Record<CampaignAction, string> = {
    edit: 'Only draft or scheduled campaigns can be edited.',
    send: 'Only a draft can be sent from here.',
    cancel: 'Only draft, scheduled or sending campaigns can be cancelled.',
    retry: 'Only finished campaigns with failed messages can be retried.',
  };
  throw new AppError(ErrorCode.INVALID_STATE, `This campaign is ${status.toLowerCase()} and cannot be ${VERB[action]}. ${hint[action]}`, 409);
}

export interface FinalCounts {
  total: number;
  sent: number;
  failed: number;
  /** Skips that point at a problem (quota used up / channel off), as opposed to expected ones (opted out, no contact). */
  skippedProblem: number;
}

/** Terminal status once nothing is left in flight. */
export function finalStatus(c: FinalCounts): 'SENT' | 'PARTIAL' | 'FAILED' {
  if (c.sent === 0) return 'FAILED';
  if (c.failed > 0 || c.skippedProblem > 0) return 'PARTIAL';
  return 'SENT';
}

export function failureReasonFor(c: FinalCounts & { skipped: number }): string | null {
  if (c.sent > 0) return null;
  if (c.failed > 0) return 'No message was delivered successfully. Check the failed recipients for the reason.';
  if (c.skipped > 0) return 'No message was sent: every recipient was skipped (opted out, no contact details, or channel/quota unavailable).';
  return 'No messages were created for this campaign.';
}
