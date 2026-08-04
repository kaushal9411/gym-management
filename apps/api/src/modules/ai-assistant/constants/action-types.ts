import { z } from 'zod';

export const AI_ACTION_TYPES = ['create_member', 'renew_membership', 'assign_workout', 'assign_diet', 'generate_report', 'send_notification'] as const;
export type AiActionType = (typeof AI_ACTION_TYPES)[number];

/** The exact permission the CONFIRMING user must hold — reuses the real domain permission each action's underlying service call already requires everywhere else, rather than inventing a separate blanket "AI actions" permission. */
export const ACTION_PERMISSIONS: Record<AiActionType, string> = {
  create_member: 'members:create',
  renew_membership: 'memberships:renew',
  assign_workout: 'workouts:assign',
  assign_diet: 'diets:assign',
  generate_report: 'reports:export',
  send_notification: 'notifications:manage',
};

export const actionParamsSchemas: Record<AiActionType, z.ZodTypeAny> = {
  create_member: z.object({
    firstName: z.string().trim().min(1),
    lastName: z.string().trim().min(1),
    email: z.string().trim().email().optional(),
    phone: z.string().trim().optional(),
    branchId: z.string().uuid(),
    planId: z.string().uuid().optional(),
  }),
  renew_membership: z.object({
    memberId: z.string().uuid(),
    planId: z.string().uuid().optional(),
  }),
  assign_workout: z.object({
    memberId: z.string().uuid(),
    planId: z.string().uuid(),
    startDate: z.string().min(1),
    endDate: z.string().optional(),
  }),
  assign_diet: z.object({
    memberId: z.string().uuid(),
    planId: z.string().uuid(),
    startDate: z.string().min(1),
    endDate: z.string().optional(),
  }),
  generate_report: z.object({
    reportType: z.enum([
      'membership', 'attendance', 'revenue', 'expenses', 'payments', 'staff', 'trainer-performance',
      'member-progress', 'branch-performance', 'expiring-memberships', 'active-vs-inactive',
      'analytics-revenue-trends', 'analytics-attendance-trends', 'analytics-membership-growth', 'analytics-new-member-growth',
    ]),
    branchId: z.string().uuid().optional(),
  }),
  send_notification: z.object({
    title: z.string().trim().min(1).max(200),
    body: z.string().trim().min(1),
    category: z.enum(['ANNOUNCEMENT', 'SYSTEM', 'GENERAL', 'MEMBER', 'MEMBERSHIP', 'PAYMENT', 'ATTENDANCE', 'WORKOUT', 'DIET', 'STAFF']).default('GENERAL'),
  }),
};

export interface AiActionProposal {
  type: AiActionType;
  params: Record<string, unknown>;
  summary: string;
}

const proposalShape = z.object({
  type: z.enum(AI_ACTION_TYPES),
  params: z.record(z.unknown()),
  summary: z.string().trim().min(1).max(300),
});

const ACTION_BLOCK_PATTERN = /```ai-action\s*\n([\s\S]*?)\n```/;

/**
 * Parses a proposed action out of the assistant's raw reply text (if any)
 * and returns the reply with that fenced block stripped — the model is
 * instructed (system prompt) to end a message proposing an action with a
 * ```ai-action fenced JSON block; this never executes anything on its own,
 * it just extracts a candidate for the separate confirm/cancel endpoints.
 * Malformed/unrecognized JSON is silently treated as "no action" rather
 * than surfaced as an error — a model hallucinating a broken block should
 * degrade to plain text, not break the chat.
 */
export function extractActionProposal(rawContent: string): { content: string; action: AiActionProposal | null } {
  const match = rawContent.match(ACTION_BLOCK_PATTERN);
  if (!match) return { content: rawContent, action: null };

  const strippedContent = rawContent.replace(ACTION_BLOCK_PATTERN, '').trim();

  try {
    const parsed = proposalShape.parse(JSON.parse(match[1]!));
    const paramsSchema = actionParamsSchemas[parsed.type];
    const paramsResult = paramsSchema.safeParse(parsed.params);
    if (!paramsResult.success) return { content: strippedContent, action: null };
    return { content: strippedContent, action: { type: parsed.type, params: paramsResult.data as Record<string, unknown>, summary: parsed.summary } };
  } catch {
    return { content: strippedContent, action: null };
  }
}
