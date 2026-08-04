import { redis } from '../../../infrastructure/cache/redis';
import { prisma } from '../../../infrastructure/database/prisma';
import type { JobHandler } from '../types';

const DAY_MS = 86_400_000;

/** Revoked/expired refresh tokens, kept 7 days past expiry for forensic/audit lookups before actually deleting them. */
export const clearExpiredSessions: JobHandler = async () => {
  const cutoff = new Date(Date.now() - 7 * DAY_MS);
  const result = await prisma.refreshToken.deleteMany({ where: { expiresAt: { lt: cutoff } } });
  return { deleted: result.count };
};

/** No temporary-file storage exists in this deployment (uploads go straight to configured object storage, never a local temp dir) — an honest no-op rather than a fabricated "cleaned" result. */
export const cleanupTemporaryFiles: JobHandler = async () => {
  return { skipped: true, reason: 'No temporary file storage is configured in this deployment.' };
};

/** Tenant-facing in-portal notifications older than 90 days — read receipts and history beyond that aren't surfaced anywhere in the UI. */
export const cleanupOldNotifications: JobHandler = async () => {
  const cutoff = new Date(Date.now() - 90 * DAY_MS);
  const [tenantNotifications, platformNotifications] = await Promise.all([
    prisma.tenantNotification.deleteMany({ where: { createdAt: { lt: cutoff } } }),
    prisma.notification.deleteMany({ where: { createdAt: { lt: cutoff }, sentAt: { not: null } } }),
  ]);
  return { tenantNotificationsDeleted: tenantNotifications.count, platformNotificationsDeleted: platformNotifications.count };
};

/** Audit trails older than 180 days — both the tenant-plane and admin-plane logs, a standard retention window. */
export const cleanupAuditLogs: JobHandler = async () => {
  const cutoff = new Date(Date.now() - 180 * DAY_MS);
  const [tenantAudit, adminAudit] = await Promise.all([
    prisma.auditLog.deleteMany({ where: { createdAt: { lt: cutoff } } }),
    prisma.adminAuditLog.deleteMany({ where: { createdAt: { lt: cutoff } } }),
  ]);
  return { tenantAuditLogsDeleted: tenantAudit.count, adminAuditLogsDeleted: adminAudit.count };
};

/** No upload-attempt tracking table exists to identify a "failed" upload after the fact — same honest no-op reasoning as `cleanupTemporaryFiles`. */
export const cleanupFailedUploads: JobHandler = async () => {
  return { skipped: true, reason: 'No upload-attempt tracking table exists in this deployment.' };
};

const REFRESHABLE_CACHE_PREFIXES = ['perm:', 'admin-perm:', 'tenant:'];

/** Forces every permission/tenant-resolution cache entry to be recomputed on next access — a deliberate invalidation, not a Redis flush (Redis also holds BullMQ + rate-limit state this must not touch). */
export const cacheRefresh: JobHandler = async () => {
  let cleared = 0;
  for (const prefix of REFRESHABLE_CACHE_PREFIXES) {
    // eslint-disable-next-line no-await-in-loop -- a handful of known prefixes, sequential is simplest
    const keys = await redis.keys(`${prefix}*`);
    if (keys.length > 0) {
      // eslint-disable-next-line no-await-in-loop
      await redis.del(...keys);
      cleared += keys.length;
    }
  }
  return { prefixesCleared: REFRESHABLE_CACHE_PREFIXES, keysCleared: cleared };
};

/** Lightweight `ANALYZE` to refresh the query planner's statistics — deliberately not `VACUUM FULL`/`REINDEX`, which lock tables and are an operator's call, not an unattended job's. */
export const databaseOptimization: JobHandler = async () => {
  await prisma.$executeRawUnsafe('ANALYZE');
  return { ran: 'ANALYZE' };
};
