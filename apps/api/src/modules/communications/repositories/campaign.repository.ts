import type { CampaignRecipientStatus, CampaignStatus, Prisma, TenantNotificationChannel } from '@prisma/client';

import type { TenantScopedPrisma } from '../../../infrastructure/database/tenant-scoped-client';

const creatorSelect = { select: { id: true, name: true } } as const;
export type CampaignRow = Prisma.NotificationCampaignGetPayload<{ include: { creator: typeof creatorSelect } }>;

export type RecipientListRow = Prisma.NotificationCampaignRecipientGetPayload<{
  include: { member: { select: { id: true; memberId: true; firstName: true; lastName: true } } };
}>;

export interface RecipientSeed {
  memberId: string;
  channel: TenantNotificationChannel;
  status: CampaignRecipientStatus;
  error?: string | null;
  deliverAfter?: Date | null;
}

/** Tenant-scoped persistence for campaigns and their per-recipient message rows. */
export class CampaignRepository {
  constructor(private readonly db: TenantScopedPrisma) {}

  // ── campaigns ───────────────────────────────────────────────────────────

  async create(data: Prisma.NotificationCampaignUncheckedCreateInput): Promise<CampaignRow> {
    return this.db.notificationCampaign.create({ data, include: { creator: creatorSelect } });
  }

  async findById(tenantId: string, id: string): Promise<CampaignRow | null> {
    return this.db.notificationCampaign.findFirst({ where: { id, tenantId }, include: { creator: creatorSelect } });
  }

  async findByIdempotencyKey(tenantId: string, key: string): Promise<CampaignRow | null> {
    return this.db.notificationCampaign.findFirst({ where: { tenantId, idempotencyKey: key }, include: { creator: creatorSelect } });
  }

  async list(tenantId: string, params: { status?: CampaignStatus; search?: string; skip: number; take: number }) {
    const where: Prisma.NotificationCampaignWhereInput = {
      tenantId,
      ...(params.status ? { status: params.status } : {}),
      ...(params.search
        ? { OR: [{ name: { contains: params.search, mode: 'insensitive' } }, { title: { contains: params.search, mode: 'insensitive' } }] }
        : {}),
    };
    const [total, items] = await Promise.all([
      this.db.notificationCampaign.count({ where }),
      this.db.notificationCampaign.findMany({ where, orderBy: { createdAt: 'desc' }, skip: params.skip, take: params.take, include: { creator: creatorSelect } }),
    ]);
    return { total, items };
  }

  async statusCounts(tenantId: string, search?: string): Promise<Array<{ status: CampaignStatus; count: number }>> {
    const rows = await this.db.notificationCampaign.groupBy({
      by: ['status'],
      where: {
        tenantId,
        ...(search ? { OR: [{ name: { contains: search, mode: 'insensitive' } }, { title: { contains: search, mode: 'insensitive' } }] } : {}),
      },
      _count: { _all: true },
    });
    return rows.map((r) => ({ status: r.status, count: r._count._all }));
  }

  async recent(tenantId: string, take: number): Promise<CampaignRow[]> {
    return this.db.notificationCampaign.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' }, take, include: { creator: creatorSelect } });
  }

  /** Non-draft campaigns created since `since` - the hourly send cap. */
  async countSentSince(tenantId: string, since: Date): Promise<number> {
    return this.db.notificationCampaign.count({ where: { tenantId, createdAt: { gte: since }, status: { not: 'DRAFT' } } });
  }

  /** Compare-and-set on status; `count === 0` means somebody else got there first. */
  async updateIfStatus(id: string, tenantId: string, from: CampaignStatus[], data: Prisma.NotificationCampaignUncheckedUpdateManyInput): Promise<number> {
    const result = await this.db.notificationCampaign.updateMany({ where: { id, tenantId, status: { in: from } }, data });
    return result.count;
  }

  async update(id: string, data: Prisma.NotificationCampaignUncheckedUpdateInput): Promise<void> {
    await this.db.notificationCampaign.update({ where: { id }, data });
  }

  async increment(id: string, field: 'sentCount' | 'failedCount' | 'skippedCount' | 'cancelledCount', by = 1): Promise<void> {
    await this.db.notificationCampaign.update({ where: { id }, data: { [field]: { increment: by } } });
  }

  // ── recipients ──────────────────────────────────────────────────────────

  /** Idempotent: a (campaign, member, channel) row that exists is left alone. */
  async seedRecipients(tenantId: string, campaignId: string, rows: RecipientSeed[]): Promise<void> {
    const CHUNK = 1000;
    for (let i = 0; i < rows.length; i += CHUNK) {
      // eslint-disable-next-line no-await-in-loop -- sequential chunks keep the tenant-scoped client simple and the batch size bounded
      await this.db.notificationCampaignRecipient.createMany({
        skipDuplicates: true,
        data: rows.slice(i, i + CHUNK).map((r) => ({
          tenantId,
          campaignId,
          memberId: r.memberId,
          channel: r.channel,
          status: r.status,
          error: r.error ?? null,
          deliverAfter: r.deliverAfter ?? null,
        })),
      });
    }
  }

  async recipientStatusGroups(campaignId: string): Promise<Array<{ channel: TenantNotificationChannel; status: CampaignRecipientStatus; count: number }>> {
    const rows = await this.db.notificationCampaignRecipient.groupBy({ by: ['channel', 'status'], where: { campaignId }, _count: { _all: true } });
    return rows.map((r) => ({ channel: r.channel, status: r.status, count: r._count._all }));
  }

  async countQueued(campaignId: string): Promise<number> {
    return this.db.notificationCampaignRecipient.count({ where: { campaignId, status: 'QUEUED' } });
  }

  async countRecipients(campaignId: string): Promise<number> {
    return this.db.notificationCampaignRecipient.count({ where: { campaignId } });
  }

  async distinctMemberCount(campaignId: string): Promise<number> {
    const rows = await this.db.notificationCampaignRecipient.groupBy({ by: ['memberId'], where: { campaignId } });
    return rows.length;
  }

  async heldSummary(campaignId: string): Promise<{ count: number; next: Date | null }> {
    const where = { campaignId, status: 'QUEUED' as const, dispatchedAt: null, deliverAfter: { gt: new Date() } };
    const [count, first] = await Promise.all([
      this.db.notificationCampaignRecipient.count({ where }),
      this.db.notificationCampaignRecipient.findFirst({ where, orderBy: { deliverAfter: 'asc' }, select: { deliverAfter: true } }),
    ]);
    return { count, next: first?.deliverAfter ?? null };
  }

  async listRecipients(
    campaignId: string,
    params: { status?: CampaignRecipientStatus; channel?: TenantNotificationChannel; search?: string; skip: number; take: number },
  ): Promise<{ total: number; items: RecipientListRow[] }> {
    const where: Prisma.NotificationCampaignRecipientWhereInput = {
      campaignId,
      ...(params.status ? { status: params.status } : {}),
      ...(params.channel ? { channel: params.channel } : {}),
      ...(params.search
        ? {
            member: {
              OR: [
                { firstName: { contains: params.search, mode: 'insensitive' } },
                { lastName: { contains: params.search, mode: 'insensitive' } },
                { memberId: { contains: params.search, mode: 'insensitive' } },
              ],
            },
          }
        : {}),
    };
    const [total, items] = await Promise.all([
      this.db.notificationCampaignRecipient.count({ where }),
      this.db.notificationCampaignRecipient.findMany({
        where,
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        skip: params.skip,
        take: params.take,
        include: { member: { select: { id: true, memberId: true, firstName: true, lastName: true } } },
      }),
    ]);
    return { total, items };
  }

  /** Messages ready to go: still queued, never handed over, and not held for quiet hours any more. */
  async findDispatchable(campaignId: string, take: number, now: Date) {
    return this.db.notificationCampaignRecipient.findMany({
      where: { campaignId, status: 'QUEUED', dispatchedAt: null, OR: [{ deliverAfter: null }, { deliverAfter: { lte: now } }] },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take,
    });
  }

  async hasDispatchable(campaignId: string, now: Date): Promise<boolean> {
    const n = await this.db.notificationCampaignRecipient.count({
      where: { campaignId, status: 'QUEUED', dispatchedAt: null, OR: [{ deliverAfter: null }, { deliverAfter: { lte: now } }] },
    });
    return n > 0;
  }

  /** At-most-once claim: exactly one caller gets `true` per row. */
  async claimRecipient(id: string): Promise<boolean> {
    const result = await this.db.notificationCampaignRecipient.updateMany({
      where: { id, status: 'QUEUED', dispatchedAt: null },
      data: { dispatchedAt: new Date() },
    });
    return result.count === 1;
  }

  /** Puts a claimed-but-unsent message back on hold until `until` (quiet hours began while the campaign was running). */
  async hold(id: string, until: Date): Promise<void> {
    await this.db.notificationCampaignRecipient.updateMany({ where: { id, status: 'QUEUED' }, data: { dispatchedAt: null, deliverAfter: until } });
  }

  /** Moves a QUEUED row to its outcome. Returns whether THIS call made the transition (so counters move exactly once). */
  async finalizeRecipient(
    id: string,
    outcome: { status: Exclude<CampaignRecipientStatus, 'QUEUED'>; error?: string | null; deliveryLogId?: string | null },
  ): Promise<boolean> {
    const result = await this.db.notificationCampaignRecipient.updateMany({
      where: { id, status: 'QUEUED' },
      data: {
        status: outcome.status,
        error: outcome.error ?? null,
        deliveryLogId: outcome.deliveryLogId ?? null,
        sentAt: outcome.status === 'SENT' ? new Date() : null,
      },
    });
    return result.count === 1;
  }

  async findRecipient(id: string) {
    return this.db.notificationCampaignRecipient.findUnique({ where: { id } });
  }

  /** Cancels everything not yet handed to a channel queue (held rows included). */
  async cancelUndispatched(campaignId: string): Promise<number> {
    const result = await this.db.notificationCampaignRecipient.updateMany({
      where: { campaignId, status: 'QUEUED', dispatchedAt: null },
      data: { status: 'CANCELLED', error: 'Cancelled before it was sent.' },
    });
    return result.count;
  }

  /** Puts every FAILED message back in the queue for another go. */
  async resetFailed(campaignId: string): Promise<number> {
    const result = await this.db.notificationCampaignRecipient.updateMany({
      where: { campaignId, status: 'FAILED' },
      data: { status: 'QUEUED', error: null, deliveryLogId: null, sentAt: null, dispatchedAt: null, deliverAfter: null },
    });
    return result.count;
  }
}
