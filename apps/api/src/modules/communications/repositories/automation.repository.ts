import { Prisma, type AutomationRuleKey, type TenantNotificationChannel } from '@prisma/client';

import type { TenantScopedPrisma } from '../../../infrastructure/database/tenant-scoped-client';

export class AutomationRepository {
  constructor(private readonly db: TenantScopedPrisma) {}

  async listRules(tenantId: string) {
    return this.db.notificationAutomationRule.findMany({ where: { tenantId } });
  }

  async findRule(tenantId: string, key: AutomationRuleKey) {
    return this.db.notificationAutomationRule.findUnique({ where: { tenantId_key: { tenantId, key } } });
  }

  async upsertRule(
    tenantId: string,
    key: AutomationRuleKey,
    data: { enabled: boolean; offsets: number[]; channels: TenantNotificationChannel[]; titleTemplate: string | null; bodyTemplate: string | null; updatedBy: string },
  ) {
    const fields = {
      enabled: data.enabled,
      offsets: data.offsets as Prisma.InputJsonValue,
      channels: { set: data.channels },
      titleTemplate: data.titleTemplate,
      bodyTemplate: data.bodyTemplate,
      updatedBy: data.updatedBy,
    };
    return this.db.notificationAutomationRule.upsert({
      where: { tenantId_key: { tenantId, key } },
      create: { tenantId, key, ...fields, channels: data.channels },
      update: fields,
    });
  }

  /** Sends per rule in the last 7 days (one ledger row = one member reminded). */
  async sentSince(tenantId: string, since: Date) {
    const rows = await this.db.automationDispatch.groupBy({
      by: ['ruleKey'],
      where: { tenantId, sentAt: { gte: since } },
      _count: { _all: true },
      _max: { sentAt: true },
    });
    return rows.map((r) => ({ key: r.ruleKey, count: r._count._all, lastSentAt: r._max.sentAt }));
  }

  async lastSent(tenantId: string) {
    const rows = await this.db.automationDispatch.groupBy({ by: ['ruleKey'], where: { tenantId }, _max: { sentAt: true } });
    return new Map(rows.map((r) => [r.ruleKey, r._max.sentAt]));
  }

  /**
   * Inserts the dedupe ledger row BEFORE anything is sent. Returns `false` when the same
   * (rule, member, subject, offset) was already dispatched - the unique constraint is the lock.
   */
  async claimDispatch(tenantId: string, input: { ruleKey: AutomationRuleKey; memberId: string; subjectId: string; offsetKey: string }): Promise<{ id: string } | null> {
    try {
      const row = await this.db.automationDispatch.create({ data: { tenantId, ...input }, select: { id: true } });
      return row;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return null;
      throw error;
    }
  }

  /** Gives the claim back so the next run can retry (only when nothing was handed to any channel). */
  async releaseDispatch(id: string): Promise<void> {
    await this.db.automationDispatch.deleteMany({ where: { id } });
  }
}
