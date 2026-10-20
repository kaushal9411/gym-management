import { logger } from '../../../core/logging/logger';
import { getTenantScopedClient } from '../../../infrastructure/database/tenant-scoped-client';
import { buildMemberWhere } from '../utils/audience-where.util';
import { utcDayStart } from '../utils/automation-timing.util';

import { AutomationEngine } from './automation-engine.service';

export type ClassChangeKind = 'SCHEDULE_UPDATED' | 'CANCELLED' | 'NEW_CLASS';

/** Edits made within this window collapse into one notification per member (the dedupe key carries the bucket). */
const COALESCE_MS = 10 * 60_000;
/** A brand-new class is announced to its branch's members - capped so one click can never blast a huge gym. */
const NEW_CLASS_MAX_MEMBERS = 2000;

const FALLBACK: Record<ClassChangeKind, { title: string; body: string }> = {
  SCHEDULE_UPDATED: {
    title: 'Class timetable updated: {{className}}',
    body: 'Hi {{firstName}}, the timetable for {{className}} has changed. You have a booking - open the app to check the new times.',
  },
  CANCELLED: {
    title: 'Class cancelled: {{className}}',
    body: 'Hi {{firstName}}, {{className}} has been cancelled. Your booking will not go ahead - open the app to book another class.',
  },
  NEW_CLASS: {
    title: 'New class: {{className}}',
    body: 'Hi {{firstName}}, {{className}} is now on the timetable at {{gymName}}. Open the app to book your spot.',
  },
};

/**
 * Event hook for the `CLASS_SCHEDULED_OR_CHANGED` automation rule (called by `GroupClassService`):
 *  - SCHEDULE_UPDATED / CANCELLED -> members holding a BOOKED seat in an upcoming session of that class (own-account
 *    update: ignores promotional opt-out);
 *  - NEW_CLASS (a class's first timetable) -> ACTIVE members of the class's branch (an announcement: respects opt-out).
 * Never throws - a failed notification must not fail the staff action that triggered it.
 */
export async function notifyClassChange(tenantId: string, groupClassId: string, kind: ClassChangeKind): Promise<void> {
  try {
    const engine = new AutomationEngine(tenantId);
    const rule = await engine.rule('CLASS_SCHEDULED_OR_CHANGED');
    if (!rule.enabled) return;

    const db = getTenantScopedClient(tenantId);
    const groupClass = await db.groupClass.findFirst({ where: { id: groupClassId, tenantId }, select: { name: true, branchId: true } });
    if (!groupClass) return;

    const today = utcDayStart(new Date());
    let memberIds: string[];
    if (kind === 'NEW_CLASS') {
      const members = await db.member.findMany({
        where: buildMemberWhere(tenantId, { branchIds: [groupClass.branchId] }, { today, scopeBranchIds: null }),
        select: { id: true },
        take: NEW_CLASS_MAX_MEMBERS,
      });
      memberIds = members.map((m) => m.id);
    } else {
      const bookings = await db.classBooking.findMany({
        where: { tenantId, status: 'BOOKED', classSession: { groupClassId, status: 'SCHEDULED', sessionDate: { gte: today } } },
        select: { memberId: true },
        distinct: ['memberId'],
      });
      memberIds = bookings.map((b) => b.memberId);
    }

    const bucket = Math.floor(Date.now() / COALESCE_MS);
    for (const memberId of memberIds) {
      // eslint-disable-next-line no-await-in-loop -- sequential, bounded fan-out
      await engine.dispatch({
        rule,
        memberId,
        subjectId: groupClassId,
        offsetKey: `${kind}-${bucket}`,
        vars: { className: groupClass.name },
        fallbackText: FALLBACK[kind],
        respectOptOut: kind === 'NEW_CLASS',
        pushData: { type: 'class_update', groupClassId },
      });
    }
  } catch (error) {
    logger.warn('Class change notification failed', { tenantId, groupClassId, kind, error: error instanceof Error ? error.message : String(error) });
  }
}
