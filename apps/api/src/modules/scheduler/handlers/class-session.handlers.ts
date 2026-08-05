import { prisma } from '../../../infrastructure/database/prisma';
import { ClassSessionService } from '../../classes/services/class-session.service';
import type { JobHandler } from '../types';

/**
 * Rolling 4-week lookahead generation, run across every tenant. Idempotent
 * per-tenant (see `ClassSessionService#generateUpcomingSessions`'s
 * `@@unique([groupClassId, sessionDate, startTime])` safety net), so a retry
 * or an overlapping on-demand "regenerate now" call is always safe.
 */
export const classSessionGeneration: JobHandler = async () => {
  // Trial tenants use the product too, before conversion — only truly terminated tenants are excluded.
  const tenants = await prisma.tenant.findMany({ where: { status: { notIn: ['SUSPENDED', 'CANCELLED'] } }, select: { id: true } });
  let totalCreated = 0;

  for (const tenant of tenants) {
    // eslint-disable-next-line no-await-in-loop -- sequential across tenants, a low-frequency daily sweep with no throughput requirement
    const { created } = await new ClassSessionService(tenant.id).generateUpcomingSessions();
    totalCreated += created;
  }

  return { tenantsScanned: tenants.length, sessionsCreated: totalCreated };
};
