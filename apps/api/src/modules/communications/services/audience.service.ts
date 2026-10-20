import type { Prisma, TenantNotificationChannel } from '@prisma/client';

import { ForbiddenError, NotFoundError, ValidationError } from '../../../core/errors/app-error';
import { getTenantScopedClient, type TenantScopedPrisma } from '../../../infrastructure/database/tenant-scoped-client';
import { getBranchAccess } from '../../authentication/middlewares/branch-access.middleware';
import { ALL_CHANNELS, MAX_RECIPIENTS, LARGE_SEND_THRESHOLD, OPT_OUT_CHANNELS } from '../constants/limits';
import { AudienceRepository } from '../repositories/audience.repository';
import { buildMemberWhere, buildPickedWhere, type AudienceFilter } from '../utils/audience-where.util';
import { isBirthdayWithin, utcDayStart } from '../utils/automation-timing.util';
import { renderPlaceholders, SAMPLE_VARS } from '../utils/placeholder.util';
import { computeQuota, type ChannelQuotaView } from '../utils/quota.util';
import { smsInfo } from '../utils/sms-segments.util';
import type { PreviewInput } from '../validators/communications.validators';

import { getChannelStates } from './channel-state.service';

export interface AudienceSpec {
  mode: 'FILTERS' | 'PICKED';
  filter: AudienceFilter;
  pickedIds: string[];
  /** Branch ids the acting staff user may reach; `null` = all. */
  scopeBranchIds: string[] | null;
}

export interface ChannelPreview {
  channel: TenantNotificationChannel;
  contactable: number;
  optedOut: number;
  willReceive: number;
  quota: ChannelQuotaView;
}

/** Resolves "who is this campaign for" - shared by the preview, the create-time checks and the send-time materialisation. */
export class AudienceService {
  private readonly db: TenantScopedPrisma;
  private readonly repo: AudienceRepository;

  constructor(private readonly tenantId: string) {
    this.db = getTenantScopedClient(tenantId);
    this.repo = new AudienceRepository(this.db);
  }

  /** `null` = the user can reach every branch; otherwise the branch ids they may message. */
  async scopeFor(actorUserId: string): Promise<string[] | null> {
    const access = await getBranchAccess(this.tenantId, actorUserId);
    return access.allBranches ? null : access.branchIds;
  }

  /** Plans / branches / trainers / class session referenced by a filter must belong to this gym. */
  async assertFilterRefs(filter: AudienceFilter): Promise<void> {
    const check = async (label: string, wanted: string[] | undefined, count: (ids: string[]) => Promise<number>): Promise<void> => {
      if (!wanted?.length) return;
      const unique = [...new Set(wanted)];
      if ((await count(unique)) !== unique.length) throw new NotFoundError(`One or more selected ${label} were not found.`);
    };
    await check('plans', filter.planIds, (ids) => this.db.membershipPlan.count({ where: { tenantId: this.tenantId, id: { in: ids }, deletedAt: null } }));
    await check('branches', filter.branchIds, (ids) => this.db.branch.count({ where: { tenantId: this.tenantId, id: { in: ids } } }));
    await check('trainers', filter.trainerIds, (ids) => this.db.user.count({ where: { tenantId: this.tenantId, id: { in: ids }, deletedAt: null } }));
    if (filter.bookedClassSessionId) {
      const found = await this.db.classSession.count({ where: { tenantId: this.tenantId, id: filter.bookedClassSessionId } });
      if (found === 0) throw new NotFoundError('The selected class session was not found.');
    }
  }

  /** Every picked id must exist here, be messageable and sit in a branch the actor can reach. */
  async assertPicked(ids: string[], scopeBranchIds: string[] | null): Promise<void> {
    const found = await this.repo.findPicked(this.tenantId, ids);
    if (found.length !== ids.length) {
      throw new NotFoundError(`${ids.length - found.length} of the selected members could not be found.`);
    }
    if (scopeBranchIds) {
      const outside = found.filter((m) => !scopeBranchIds.includes(m.branchId));
      if (outside.length) throw new ForbiddenError(`${outside.length} of the selected members belong to a branch you do not have access to.`);
    }
    const inactive = found.filter((m) => m.status === 'INACTIVE');
    if (inactive.length) throw new ValidationError(`${inactive.length} of the selected members are inactive and cannot be messaged.`, { fields: [{ field: 'pickedMemberIds', message: 'Remove inactive members from the selection.' }] });
  }

  private async whereFor(spec: AudienceSpec): Promise<Prisma.MemberWhereInput> {
    if (spec.mode === 'PICKED') return buildPickedWhere(this.tenantId, spec.pickedIds, spec.scopeBranchIds);
    const today = utcDayStart(new Date());
    let birthdayMemberIds: string[] | undefined;
    if (spec.filter.birthdayThisWeek) {
      const candidates = await this.repo.birthdayCandidates(this.tenantId, spec.scopeBranchIds);
      birthdayMemberIds = candidates.filter((c) => c.dateOfBirth && isBirthdayWithin(c.dateOfBirth, today, 7)).map((c) => c.id);
    }
    return buildMemberWhere(this.tenantId, spec.filter, { today, scopeBranchIds: spec.scopeBranchIds, birthdayMemberIds });
  }

  /** Member ids for a send; asks for one more than the cap so the caller can tell "too many". */
  async resolveIds(spec: AudienceSpec, limit = MAX_RECIPIENTS + 1): Promise<string[]> {
    return this.repo.findMemberIds(await this.whereFor(spec), limit);
  }

  async count(spec: AudienceSpec): Promise<number> {
    return this.repo.countMembers(await this.whereFor(spec));
  }

  async preview(input: PreviewInput, actorUserId: string) {
    const scopeBranchIds = await this.scopeFor(actorUserId);
    const filter = (input.audienceFilter ?? {}) as AudienceFilter;
    if (input.audienceMode === 'PICKED') await this.assertPicked(input.pickedMemberIds!, scopeBranchIds);
    else await this.assertFilterRefs(filter);

    const spec: AudienceSpec = { mode: input.audienceMode, filter, pickedIds: input.pickedMemberIds ?? [], scopeBranchIds };
    const channels = (input.channels ?? [...ALL_CHANNELS]) as TenantNotificationChannel[];
    const { total, sample, rows } = await this.channelPlan(spec, channels);

    const sms = channels.includes('SMS') && (input.title || input.body) ? smsInfo(renderPlaceholders(`${input.title ?? ''}\n${input.body ?? ''}`.trim(), SAMPLE_VARS)) : undefined;
    return {
      total,
      sample: sample.map((m) => ({ id: m.id, memberId: m.memberId, name: `${m.firstName} ${m.lastName}`.trim() })),
      maxRecipients: MAX_RECIPIENTS,
      exceedsMax: total > MAX_RECIPIENTS,
      largeSend: total > LARGE_SEND_THRESHOLD,
      largeSendThreshold: LARGE_SEND_THRESHOLD,
      channels: rows,
      overLimit: rows.filter((r) => r.quota.over || (!r.quota.enabled && r.willReceive > 0)).map((r) => r.channel),
      ...(sms ? { sms } : {}),
    };
  }

  /** Audience size, a small sample and the per-channel reach / opt-out / quota picture. */
  async channelPlan(spec: AudienceSpec, channels: TenantNotificationChannel[]) {
    const where = await this.whereFor(spec);
    const [total, sample, states] = await Promise.all([this.repo.countMembers(where), this.repo.sample(where, 5), getChannelStates(this.tenantId)]);
    const rows: ChannelPreview[] = [];
    for (const channel of channels) {
      const reachable: Prisma.MemberWhereInput =
        channel === 'IN_APP' ? {} : channel === 'PUSH' ? { deviceTokens: { some: {} } } : channel === 'EMAIL' ? { email: { not: null } } : { phone: { not: null } };
      // eslint-disable-next-line no-await-in-loop -- at most 5 channels, each a pair of cheap COUNTs
      const contactable = channel === 'IN_APP' ? total : await this.repo.countWith(where, reachable);
      const optedOut = (OPT_OUT_CHANNELS as readonly string[]).includes(channel)
        ? // eslint-disable-next-line no-await-in-loop
          await this.repo.countWith(where, { AND: [reachable, { channelPreferences: { some: { channel, promotionalOptOut: true } } }] })
        : 0;
      const willReceive = Math.max(0, contactable - optedOut);
      const state = states[channel];
      rows.push({
        channel,
        contactable,
        optedOut,
        willReceive,
        quota: computeQuota({ channel, enabled: state.enabled, disabledReason: state.disabledReason, limit: state.limit, used: state.used, wouldUse: willReceive }),
      });
    }
    return { total, sample, rows };
  }

  async searchMembers(query: { search?: string; branchId?: string; page: number; limit: number }, actorUserId: string) {
    const scopeBranchIds = await this.scopeFor(actorUserId);
    const { total, rows } = await this.repo.searchMembers({
      tenantId: this.tenantId,
      scopeBranchIds,
      search: query.search,
      branchId: query.branchId,
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });
    return {
      items: rows.map((m) => {
        const latest = m.memberships[0] ?? null;
        const membershipStatus = m.status === 'FROZEN' ? 'FROZEN' : latest ? (latest.status === 'EXPIRED' ? 'EXPIRED' : latest.status === 'PENDING' ? 'PENDING' : 'ACTIVE') : 'NO_PLAN';
        return {
          id: m.id,
          memberId: m.memberId,
          name: `${m.firstName} ${m.lastName}`.trim(),
          planName: latest?.plan.name ?? null,
          branchId: m.branchId,
          branchName: m.branch.name,
          membershipStatus,
          hasEmail: !!m.email,
          hasPhone: !!m.phone,
          hasDevice: m._count.deviceTokens > 0,
        };
      }),
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.limit)),
    };
  }
}
