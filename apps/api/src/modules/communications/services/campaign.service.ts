import { Prisma, type CampaignRecipientStatus, type CampaignStatus, type TenantNotificationChannel } from '@prisma/client';

import { AppError, NotFoundError, RateLimitedError, ValidationError } from '../../../core/errors/app-error';
import { ErrorCode } from '../../../core/errors/error-codes';
import { getTenantScopedClient, type TenantScopedPrisma } from '../../../infrastructure/database/tenant-scoped-client';
import { enqueueCampaignBatch, enqueueCampaignStart } from '../../../infrastructure/queue/communications.queue';
import { AuditLogRepository } from '../../authentication/repositories/audit-log.repository';
import type { IamActor } from '../../authentication/utils/actor.util';
import { LARGE_SEND_THRESHOLD, MAX_CAMPAIGNS_PER_HOUR, MAX_RECIPIENTS, WHATSAPP_NOTICE } from '../constants/limits';
import { CampaignRepository, type CampaignRow } from '../repositories/campaign.repository';
import { describeFilter, type AudienceFilter } from '../utils/audience-where.util';
import { assertCanTransition } from '../utils/campaign-state.util';
import { describeShortChannels, disabledChannels, shortChannels } from '../utils/quota.util';
import {
  messageIssues,
  scheduleIssue,
  type CreateCampaignInput,
  type UpdateCampaignInput,
} from '../validators/communications.validators';

import { AudienceService, type AudienceSpec } from './audience.service';
import { syncCampaignCounters } from './recipient-finalizer.service';

const HOUR_MS = 3_600_000;

export interface CampaignDto {
  id: string;
  name: string;
  title: string;
  body: string;
  channels: TenantNotificationChannel[];
  audienceMode: 'FILTERS' | 'PICKED';
  audienceFilter: AudienceFilter;
  pickedCount: number;
  templateKey: string | null;
  status: CampaignStatus;
  scheduledAt: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  holdQuietHours: boolean;
  recipientCount: number;
  messageCount: number;
  queuedCount: number;
  sentCount: number;
  failedCount: number;
  skippedCount: number;
  cancelledCount: number;
  failureReason: string | null;
  createdBy: { id: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
  notices: string[];
}

const iso = (d: Date | null): string | null => (d ? d.toISOString() : null);
const asIds = (value: Prisma.JsonValue | null): string[] => (Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []);

export function toCampaignDto(row: CampaignRow): CampaignDto {
  const queued = Math.max(0, row.messageCount - row.sentCount - row.failedCount - row.skippedCount - row.cancelledCount);
  const notices: string[] = [];
  if (row.channels.includes('WHATSAPP')) notices.push(WHATSAPP_NOTICE);
  if (row.channels.includes('SMS')) notices.push('SMS delivery depends on the platform SMS provider and India DLT sender/template registration; provider rejections are listed per recipient.');
  return {
    id: row.id,
    name: row.name,
    title: row.title,
    body: row.body,
    channels: row.channels,
    audienceMode: row.audienceMode,
    audienceFilter: (row.audienceFilter ?? {}) as AudienceFilter,
    pickedCount: asIds(row.pickedMemberIds).length,
    templateKey: row.templateKey,
    status: row.status,
    scheduledAt: iso(row.scheduledAt),
    startedAt: iso(row.startedAt),
    finishedAt: iso(row.finishedAt),
    holdQuietHours: row.holdQuietHours,
    recipientCount: row.recipientCount,
    messageCount: row.messageCount,
    queuedCount: queued,
    sentCount: row.sentCount,
    failedCount: row.failedCount,
    skippedCount: row.skippedCount,
    cancelledCount: row.cancelledCount,
    failureReason: row.failureReason,
    createdBy: row.creator ? { id: row.creator.id, name: row.creator.name } : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    notices,
  };
}

export function specFromRow(row: CampaignRow): AudienceSpec {
  const scope = row.scopeBranchIds;
  return {
    mode: row.audienceMode,
    filter: (row.audienceFilter ?? {}) as AudienceFilter,
    pickedIds: asIds(row.pickedMemberIds),
    scopeBranchIds: Array.isArray(scope) ? asIds(scope as Prisma.JsonValue) : null,
  };
}

/** Staff-facing campaign lifecycle: create / edit / send / cancel / retry and the read models. */
export class CampaignService {
  private readonly db: TenantScopedPrisma;
  private readonly repo: CampaignRepository;
  private readonly audience: AudienceService;
  private readonly auditLog: AuditLogRepository;

  constructor(private readonly tenantId: string) {
    this.db = getTenantScopedClient(tenantId);
    this.repo = new CampaignRepository(this.db);
    this.audience = new AudienceService(tenantId);
    this.auditLog = new AuditLogRepository(this.db);
  }

  // ── reads ───────────────────────────────────────────────────────────────

  async list(query: { status?: CampaignStatus; search?: string; page: number; limit: number }) {
    const [{ total, items }, groups] = await Promise.all([
      this.repo.list(this.tenantId, { status: query.status, search: query.search, skip: (query.page - 1) * query.limit, take: query.limit }),
      this.repo.statusCounts(this.tenantId, query.search),
    ]);
    const by = new Map(groups.map((g) => [g.status, g.count]));
    const n = (s: CampaignStatus): number => by.get(s) ?? 0;
    return {
      items: items.map(toCampaignDto),
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.limit)),
      counts: {
        all: groups.reduce((sum, g) => sum + g.count, 0),
        draft: n('DRAFT'),
        scheduled: n('SCHEDULED'),
        sending: n('SENDING'),
        sent: n('SENT'),
        partial: n('PARTIAL'),
        failed: n('FAILED'),
        cancelled: n('CANCELLED'),
      },
    };
  }

  async getById(id: string) {
    const row = await this.mustFind(id);
    const [groups, held] = await Promise.all([this.repo.recipientStatusGroups(id), this.repo.heldSummary(id)]);
    const channels = [...new Set(groups.map((g) => g.channel))];
    const breakdown = channels.map((channel) => {
      const mine = groups.filter((g) => g.channel === channel);
      const c = (pred: (s: string) => boolean): number => mine.filter((g) => pred(g.status)).reduce((s, g) => s + g.count, 0);
      return {
        channel,
        total: c(() => true),
        queued: c((s) => s === 'QUEUED'),
        sent: c((s) => s === 'SENT'),
        failed: c((s) => s === 'FAILED'),
        skipped: c((s) => s.startsWith('SKIPPED_')),
        cancelled: c((s) => s === 'CANCELLED'),
      };
    });
    const reason = (status: string): number => groups.filter((g) => g.status === status).reduce((s, g) => s + g.count, 0);
    return {
      ...toCampaignDto(row),
      breakdown,
      skippedByReason: {
        SKIPPED_OPTED_OUT: reason('SKIPPED_OPTED_OUT'),
        SKIPPED_NO_CONTACT: reason('SKIPPED_NO_CONTACT'),
        SKIPPED_QUOTA: reason('SKIPPED_QUOTA'),
        SKIPPED_DISABLED: reason('SKIPPED_DISABLED'),
      },
      heldCount: held.count,
      nextReleaseAt: iso(held.next),
      ...(row.audienceMode === 'PICKED' ? { pickedMemberIds: asIds(row.pickedMemberIds) } : {}),
    };
  }

  async listRecipients(id: string, query: { status?: CampaignRecipientStatus; channel?: TenantNotificationChannel; search?: string; page: number; limit: number }) {
    await this.mustFind(id);
    const { total, items } = await this.repo.listRecipients(id, {
      status: query.status,
      channel: query.channel,
      search: query.search,
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });
    return {
      items: items.map((r) => ({
        id: r.id,
        memberId: r.member.id,
        memberCode: r.member.memberId,
        memberName: `${r.member.firstName} ${r.member.lastName}`.trim(),
        channel: r.channel,
        status: r.status,
        error: r.error,
        sentAt: iso(r.sentAt),
        heldUntil: r.status === 'QUEUED' && r.deliverAfter && r.deliverAfter.getTime() > Date.now() ? r.deliverAfter.toISOString() : null,
      })),
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.limit)),
    };
  }

  // ── writes ──────────────────────────────────────────────────────────────

  async create(input: CreateCampaignInput, actor: IamActor, idempotencyKey?: string): Promise<{ campaign: CampaignDto; replay: boolean }> {
    if (idempotencyKey) {
      const existing = await this.repo.findByIdempotencyKey(this.tenantId, idempotencyKey);
      if (existing) return { campaign: toCampaignDto(existing), replay: true };
    }

    const scopeBranchIds = await this.audience.scopeFor(actor.userId);
    const spec = this.specFromInput(input, scopeBranchIds);
    await this.assertAudienceRefs(spec);

    let recipientCount = 0;
    if (input.sendMode !== 'DRAFT') {
      await this.assertHourlyCap();
      recipientCount = await this.assertSendable(spec, input.channels as TenantNotificationChannel[], input.confirmLargeSend);
    }

    const status: CampaignStatus = input.sendMode === 'DRAFT' ? 'DRAFT' : input.sendMode === 'SCHEDULE' ? 'SCHEDULED' : 'SENDING';
    let row: CampaignRow;
    try {
      row = await this.repo.create({
        tenantId: this.tenantId,
        name: input.name ?? input.title.slice(0, 120),
        title: input.title,
        body: input.body,
        channels: input.channels as TenantNotificationChannel[],
        audienceMode: input.audienceMode,
        audienceFilter: (input.audienceFilter ?? {}) as Prisma.InputJsonValue,
        pickedMemberIds: input.audienceMode === 'PICKED' ? (input.pickedMemberIds as Prisma.InputJsonValue) : Prisma.JsonNull,
        scopeBranchIds: scopeBranchIds ? (scopeBranchIds as Prisma.InputJsonValue) : Prisma.JsonNull,
        templateKey: input.templateKey ?? null,
        status,
        scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
        startedAt: status === 'SENDING' ? new Date() : null,
        holdQuietHours: input.holdQuietHours,
        recipientCount,
        idempotencyKey: idempotencyKey ?? null,
        createdBy: actor.userId,
      });
    } catch (error) {
      // Two concurrent requests with the same Idempotency-Key: the loser returns the winner's campaign.
      if (idempotencyKey && error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const existing = await this.repo.findByIdempotencyKey(this.tenantId, idempotencyKey);
        if (existing) return { campaign: toCampaignDto(existing), replay: true };
      }
      throw error;
    }

    if (status === 'SENDING') await enqueueCampaignStart(this.tenantId, row.id);
    await this.audit(actor, 'communications.campaign_created', row.id, {
      status,
      channels: row.channels,
      audienceMode: row.audienceMode,
      recipientCount,
      filters: describeFilter((input.audienceFilter ?? {}) as AudienceFilter),
      pickedCount: input.pickedMemberIds?.length ?? 0,
      scheduledAt: row.scheduledAt?.toISOString() ?? null,
    });
    return { campaign: toCampaignDto(row), replay: false };
  }

  async update(id: string, input: UpdateCampaignInput, actor: IamActor): Promise<CampaignDto> {
    const row = await this.mustFind(id);
    assertCanTransition(row.status, 'edit');

    const title = input.title ?? row.title;
    const body = input.body ?? row.body;
    const channels = (input.channels ?? row.channels) as TenantNotificationChannel[];
    const audienceMode = input.audienceMode ?? row.audienceMode;
    const filter = (input.audienceFilter ?? (row.audienceFilter as AudienceFilter) ?? {}) as AudienceFilter;
    const pickedIds = input.pickedMemberIds ?? asIds(row.pickedMemberIds);

    const issues: Array<{ field: string; message: string }> = messageIssues(title, body, channels).map((i) => ({ field: i.path, message: i.message }));
    if (audienceMode === 'PICKED' && pickedIds.length === 0) issues.push({ field: 'pickedMemberIds', message: 'Pick at least one member.' });
    if (audienceMode === 'FILTERS' && input.pickedMemberIds) issues.push({ field: 'pickedMemberIds', message: 'pickedMemberIds can only be used with audienceMode PICKED.' });
    if (audienceMode === 'PICKED' && input.audienceFilter && Object.keys(input.audienceFilter).length) issues.push({ field: 'audienceFilter', message: 'audienceFilter cannot be combined with audienceMode PICKED.' });
    const scheduledAt = input.scheduledAt ? new Date(input.scheduledAt) : row.scheduledAt;
    if (row.status === 'SCHEDULED') {
      if (!scheduledAt) issues.push({ field: 'scheduledAt', message: 'A scheduled campaign needs a scheduledAt.' });
      else if (input.scheduledAt === undefined) {
        const problem = scheduleIssue(scheduledAt.toISOString());
        if (problem) issues.push({ field: 'scheduledAt', message: 'The saved send time has already passed - choose a new scheduledAt.' });
      }
    }
    if (issues.length) throw new ValidationError('Request validation failed', { fields: issues });

    const scopeBranchIds = await this.audience.scopeFor(actor.userId);
    const spec: AudienceSpec = { mode: audienceMode, filter: audienceMode === 'PICKED' ? {} : filter, pickedIds: audienceMode === 'PICKED' ? pickedIds : [], scopeBranchIds };
    await this.assertAudienceRefs(spec);

    let recipientCount = row.recipientCount;
    if (row.status === 'SCHEDULED') {
      recipientCount = await this.assertSendable(spec, channels, input.confirmLargeSend ?? false);
    }

    const changed = await this.repo.updateIfStatus(id, this.tenantId, ['DRAFT', 'SCHEDULED'], {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.body !== undefined ? { body: input.body } : {}),
      ...(input.channels !== undefined ? { channels: { set: channels } } : {}),
      ...(input.audienceMode !== undefined ? { audienceMode: input.audienceMode } : {}),
      audienceFilter: (audienceMode === 'PICKED' ? {} : filter) as Prisma.InputJsonValue,
      pickedMemberIds: audienceMode === 'PICKED' ? (pickedIds as Prisma.InputJsonValue) : Prisma.JsonNull,
      scopeBranchIds: scopeBranchIds ? (scopeBranchIds as Prisma.InputJsonValue) : Prisma.JsonNull,
      ...(input.templateKey !== undefined ? { templateKey: input.templateKey } : {}),
      ...(input.scheduledAt !== undefined ? { scheduledAt: new Date(input.scheduledAt) } : {}),
      ...(input.holdQuietHours !== undefined ? { holdQuietHours: input.holdQuietHours } : {}),
      recipientCount,
    });
    if (changed === 0) throw new AppError(ErrorCode.INVALID_STATE, 'This campaign has already started or was changed by someone else, so it can no longer be edited.', 409);

    await this.audit(actor, 'communications.campaign_updated', id, { fields: Object.keys(input).filter((k) => k !== 'confirmLargeSend'), recipientCount });
    return toCampaignDto(await this.mustFind(id));
  }

  /** Starts a DRAFT right now. */
  async send(id: string, confirmLargeSend: boolean, actor: IamActor): Promise<CampaignDto> {
    const row = await this.mustFind(id);
    assertCanTransition(row.status, 'send');
    await this.assertHourlyCap();
    const spec = specFromRow(row);
    spec.scopeBranchIds = await this.audience.scopeFor(actor.userId);
    await this.assertAudienceRefs(spec);
    const recipientCount = await this.assertSendable(spec, row.channels, confirmLargeSend);
    const changed = await this.repo.updateIfStatus(id, this.tenantId, ['DRAFT'], {
      status: 'SENDING',
      startedAt: new Date(),
      scheduledAt: null,
      recipientCount,
      scopeBranchIds: spec.scopeBranchIds ? (spec.scopeBranchIds as Prisma.InputJsonValue) : Prisma.JsonNull,
    });
    if (changed === 0) throw new AppError(ErrorCode.INVALID_STATE, 'This campaign was already started or changed.', 409);
    await enqueueCampaignStart(this.tenantId, id);
    await this.audit(actor, 'communications.campaign_updated', id, { action: 'sent_now', recipientCount });
    return toCampaignDto(await this.mustFind(id));
  }

  async cancel(id: string, actor: IamActor): Promise<CampaignDto> {
    const row = await this.mustFind(id);
    assertCanTransition(row.status, 'cancel');
    const changed = await this.repo.updateIfStatus(id, this.tenantId, ['DRAFT', 'SCHEDULED', 'SENDING'], { status: 'CANCELLED', finishedAt: new Date() });
    if (changed === 0) throw new AppError(ErrorCode.INVALID_STATE, 'This campaign finished or changed state just now and can no longer be cancelled.', 409);
    // Everything not yet handed to a channel queue (held quiet-hours messages included) stops here; messages already
    // in a channel queue finish on their own and are still counted.
    const cancelled = await this.repo.cancelUndispatched(id);
    await syncCampaignCounters(this.tenantId, id);
    await this.audit(actor, 'communications.campaign_cancelled', id, { previousStatus: row.status, cancelledMessages: cancelled });
    return toCampaignDto(await this.mustFind(id));
  }

  async retryFailed(id: string, actor: IamActor): Promise<{ retried: number; campaign: CampaignDto }> {
    const row = await this.mustFind(id);
    assertCanTransition(row.status, 'retry');
    const groups = await this.repo.recipientStatusGroups(id);
    if (!groups.some((g) => g.status === 'FAILED')) {
      throw new AppError(ErrorCode.INVALID_STATE, 'There are no failed messages to retry in this campaign.', 409);
    }
    const changed = await this.repo.updateIfStatus(id, this.tenantId, ['SENT', 'PARTIAL', 'FAILED'], { status: 'SENDING', finishedAt: null, failureReason: null });
    if (changed === 0) throw new AppError(ErrorCode.INVALID_STATE, 'This campaign is already being retried.', 409);
    const retried = await this.repo.resetFailed(id);
    await syncCampaignCounters(this.tenantId, id);
    await enqueueCampaignBatch(this.tenantId, id);
    await this.audit(actor, 'communications.campaign_retried', id, { retried });
    return { retried, campaign: toCampaignDto(await this.mustFind(id)) };
  }

  // ── checks ──────────────────────────────────────────────────────────────

  private specFromInput(input: { audienceMode: 'FILTERS' | 'PICKED'; audienceFilter?: unknown; pickedMemberIds?: string[] }, scopeBranchIds: string[] | null): AudienceSpec {
    return {
      mode: input.audienceMode,
      filter: input.audienceMode === 'PICKED' ? {} : ((input.audienceFilter ?? {}) as AudienceFilter),
      pickedIds: input.audienceMode === 'PICKED' ? (input.pickedMemberIds ?? []) : [],
      scopeBranchIds,
    };
  }

  private async assertAudienceRefs(spec: AudienceSpec): Promise<void> {
    if (spec.mode === 'PICKED') await this.audience.assertPicked(spec.pickedIds, spec.scopeBranchIds);
    else await this.audience.assertFilterRefs(spec.filter);
  }

  private async assertHourlyCap(): Promise<void> {
    const recent = await this.repo.countSentSince(this.tenantId, new Date(Date.now() - HOUR_MS));
    if (recent >= MAX_CAMPAIGNS_PER_HOUR) {
      throw new RateLimitedError(`You can send up to ${MAX_CAMPAIGNS_PER_HOUR} campaigns per hour. Try again a little later.`);
    }
  }

  /** Audience size / confirmation / channel availability / quota. Returns the member count. */
  private async assertSendable(spec: AudienceSpec, channels: TenantNotificationChannel[], confirmLargeSend: boolean): Promise<number> {
    const { total, rows } = await this.audience.channelPlan(spec, channels);
    if (total === 0) throw new AppError(ErrorCode.AUDIENCE_EMPTY, 'Nobody matches this audience. Change the filters or pick members.', 422);
    if (total > MAX_RECIPIENTS) {
      throw new AppError(ErrorCode.RECIPIENT_LIMIT_EXCEEDED, `This audience has ${total.toLocaleString('en-IN')} members; a campaign can reach at most ${MAX_RECIPIENTS.toLocaleString('en-IN')}. Narrow the filters.`, 422);
    }
    if (total > LARGE_SEND_THRESHOLD && !confirmLargeSend) {
      throw new AppError(ErrorCode.CONFIRMATION_REQUIRED, `This will message ${total} members. Confirm the audience and message (confirmLargeSend) to continue.`, 409, {
        responseData: { recipientCount: total, threshold: LARGE_SEND_THRESHOLD },
      });
    }
    const disabled = disabledChannels(rows);
    if (disabled.length) {
      throw new AppError(
        ErrorCode.CHANNEL_DISABLED,
        `${disabled.map((d) => d.channel).join(', ')} ${disabled.length === 1 ? 'is' : 'are'} not available for this gym. Turn ${disabled.length === 1 ? 'it' : 'them'} off or ask the platform to enable ${disabled.length === 1 ? 'it' : 'them'}.`,
        409,
        { responseData: { channels: disabled } },
      );
    }
    const short = shortChannels(rows);
    if (short.length) {
      throw new AppError(ErrorCode.QUOTA_EXCEEDED, describeShortChannels(short), 409, { responseData: { shortChannels: short } });
    }
    return total;
  }

  private async mustFind(id: string): Promise<CampaignRow> {
    const row = await this.repo.findById(this.tenantId, id);
    if (!row) throw new NotFoundError('Campaign not found.');
    return row;
  }

  /** Audit metadata carries ids / counts / field names only - never message text or contact data. */
  private async audit(actor: IamActor, action: string, entityId: string, after: Record<string, unknown>): Promise<void> {
    await this.auditLog.record({
      tenantId: this.tenantId,
      actorUserId: actor.userId,
      actorRole: actor.role,
      action,
      entityType: 'notification_campaign',
      entityId,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
      after,
    });
  }
}
