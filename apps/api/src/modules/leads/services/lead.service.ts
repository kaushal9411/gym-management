import type { Prisma } from '@prisma/client';

import { AppError, ConflictError, NotFoundError, ValidationError } from '../../../core/errors/app-error';
import { ErrorCode } from '../../../core/errors/error-codes';
import { getTenantScopedClient, type TenantScopedPrisma } from '../../../infrastructure/database/tenant-scoped-client';
import { assertBranchAccess, getBranchAccess } from '../../authentication/middlewares/branch-access.middleware';
import { AuditLogRepository } from '../../authentication/repositories/audit-log.repository';
import type { IamActor } from '../../authentication/utils/actor.util';
import { MemberService } from '../../members/services/member.service';
import { decryptMemberField, hashEmail } from '../../members/utils/member-pii.util';
import { permissionEngine } from '../../permissions/services/permission-engine.service';
import type { LeadActivityDto, LeadAnalyticsDto, LeadDetailDto, LeadDuplicateMatch, LeadListItemDto } from '../dto/lead.dto';
import { buildLeadWhere, LeadRepository, type LeadActivityRow, type LeadRow, type LeadScope } from '../repositories/lead.repository';
import { assembleLeadAnalytics, resolveLeadRanges } from '../utils/lead-analytics.util';
import {
  awarenessSourceFor,
  csvCell,
  followUpBoundaries,
  followUpBucket,
  isBlockingLeadStatus,
  isOpenStatus,
  normalizeLeadEmail,
  OPEN_STATUSES,
  phoneKeyOf,
  splitName,
  statusTransitionError,
} from '../utils/lead-rules.util';
import type {
  AddActivityInput,
  AssignLeadInput,
  ChangeStatusInput,
  ConvertLeadInput,
  CreateLeadInput,
  ExportLeadsQuery,
  FollowUpsQuery,
  LeadAnalyticsQuery,
  LeadStatusValue,
  ListLeadsQuery,
  UpdateLeadInput,
} from '../validators/lead.validators';

const EXPORT_LIMIT = 10_000;

const day = (d: Date | null): string | null => (d ? d.toISOString().slice(0, 10) : null);
const iso = (d: Date | null): string | null => (d ? d.toISOString() : null);

function toListItem(row: LeadRow, now: Date = new Date()): LeadListItemDto {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    gender: row.gender,
    source: row.source,
    sourceDetail: row.sourceDetail,
    status: row.status,
    branch: row.branch,
    interestedPlan: row.interestedPlan,
    interest: row.interest,
    assignedTo: row.assignedTo,
    nextFollowUpAt: iso(row.nextFollowUpAt),
    followUpState: followUpBucket(row.nextFollowUpAt, row.status, now),
    expectedJoinDate: day(row.expectedJoinDate),
    lostReason: row.lostReason,
    lostNote: row.lostNote,
    lostAt: iso(row.lostAt),
    notes: row.notes,
    convertedMemberId: row.convertedMemberId,
    convertedAt: iso(row.convertedAt),
    lastActivityAt: row.lastActivityAt.toISOString(),
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toActivity(a: LeadActivityRow): LeadActivityDto {
  return {
    id: a.id,
    type: a.type,
    note: a.note,
    outcome: a.outcome,
    fromStatus: a.fromStatus,
    toStatus: a.toStatus,
    scheduledFor: iso(a.scheduledFor),
    createdBy: a.createdBy,
    createdAt: a.createdAt.toISOString(),
  };
}

export class LeadService {
  private readonly db: TenantScopedPrisma;
  private readonly leads: LeadRepository;
  private readonly auditLog: AuditLogRepository;

  constructor(private readonly tenantId: string) {
    this.db = getTenantScopedClient(tenantId);
    this.leads = new LeadRepository(this.db);
    this.auditLog = new AuditLogRepository(this.db);
  }

  // ── reads ────────────────────────────────────────────────────────────────

  async list(query: ListLeadsQuery, actorUserId: string) {
    const scope = await this.scopeFor(actorUserId);
    const now = new Date();
    const where = buildLeadWhere(scope, query, { now });
    const orderBy: Prisma.LeadOrderByWithRelationInput[] =
      query.sortBy === 'nextFollowUpAt' || query.sortBy === 'expectedJoinDate'
        ? [{ [query.sortBy]: { sort: query.sortDir, nulls: 'last' } }, { createdAt: 'desc' }]
        : [{ [query.sortBy]: query.sortDir }, { id: 'asc' }];
    const [{ items, total }, byStatus, filteredByStatus] = await Promise.all([
      this.leads.list(where, orderBy, (query.page - 1) * query.limit, query.limit),
      this.leads.countByStatus(buildLeadWhere(scope, query, { ignoreStatus: true, now })),
      this.leads.countByStatus(where),
    ]);

    const counts: Record<string, number> = { all: 0, NEW: 0, CONTACTED: 0, VISIT_SCHEDULED: 0, TRIAL_DONE: 0, NEGOTIATION: 0, CONVERTED: 0, LOST: 0 };
    for (const r of byStatus) {
      counts[r.status] = r.count;
      counts.all! += r.count;
    }
    const f = (s: string) => filteredByStatus.find((r) => r.status === s)?.count ?? 0;
    const { start, end } = followUpBoundaries(now);
    const open = { status: { in: [...OPEN_STATUSES] } } as Prisma.LeadWhereInput;
    const [overdue, dueToday] = await Promise.all([
      this.leads.countWhere({ AND: [where, open, { nextFollowUpAt: { lt: start } }] }),
      this.leads.countWhere({ AND: [where, open, { nextFollowUpAt: { gte: start, lt: end } }] }),
    ]);
    const filteredTotal = filteredByStatus.reduce((s, r) => s + r.count, 0);

    return {
      items: items.map((r) => toListItem(r, now)),
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.max(1, Math.ceil(total / query.limit)),
      counts,
      summary: { total: filteredTotal, open: filteredTotal - f('CONVERTED') - f('LOST'), converted: f('CONVERTED'), lost: f('LOST'), followUpsOverdue: overdue, followUpsDueToday: dueToday },
    };
  }

  async getById(id: string, actorUserId: string): Promise<LeadDetailDto> {
    const lead = await this.mustFind(id, actorUserId);
    const activities = await this.leads.listActivities(this.tenantId, id);
    const m = lead.convertedMember;
    return {
      ...toListItem(lead),
      convertedMember: m ? { id: m.id, memberId: m.memberId, name: `${m.firstName} ${m.lastName}`.trim() } : null,
      activities: activities.map(toActivity),
    };
  }

  async followUps(query: FollowUpsQuery, actorUserId: string) {
    const scope = await this.scopeFor(actorUserId);
    const now = new Date();
    const { start, end } = followUpBoundaries(now);
    const base = buildLeadWhere(scope, { branchId: query.branchId, assignedTo: query.scope === 'mine' ? 'me' : undefined }, { now });
    const open = { status: { in: [...OPEN_STATUSES] } } as Prisma.LeadWhereInput;
    const bucketWhere: Record<string, Prisma.LeadWhereInput> = {
      overdue: { nextFollowUpAt: { lt: start } },
      today: { nextFollowUpAt: { gte: start, lt: end } },
      upcoming: { nextFollowUpAt: { gte: end } },
      due: { nextFollowUpAt: { lt: end } },
    };
    const [items, overdue, today, upcoming] = await Promise.all([
      this.leads.findMany({ AND: [base, open, bucketWhere[query.bucket]!] }, [{ nextFollowUpAt: 'asc' }, { id: 'asc' }], query.limit),
      this.leads.countWhere({ AND: [base, open, bucketWhere.overdue!] }),
      this.leads.countWhere({ AND: [base, open, bucketWhere.today!] }),
      this.leads.countWhere({ AND: [base, open, bucketWhere.upcoming!] }),
    ]);
    return { items: items.map((r) => toListItem(r, now)), counts: { overdue, today, upcoming, due: overdue + today } };
  }

  /** Active staff a lead can be assigned to (backs the assignee picker; needs only leads:view, unlike /staff). */
  async assignees(): Promise<Array<{ id: string; name: string; role: string | null }>> {
    const users = await this.db.user.findMany({
      where: { tenantId: this.tenantId, status: 'ACTIVE', deletedAt: null },
      select: { id: true, name: true, userRoles: { select: { role: { select: { name: true, priority: true } } } } },
      orderBy: { name: 'asc' },
    });
    return users.map((u) => ({ id: u.id, name: u.name, role: [...u.userRoles].sort((a, b) => b.role.priority - a.role.priority)[0]?.role.name ?? null }));
  }

  async analytics(query: LeadAnalyticsQuery, actorUserId: string): Promise<LeadAnalyticsDto> {
    const scope = await this.scopeFor(actorUserId);
    const now = new Date();
    const { range, previousRange } = resolveLeadRanges(query.range, query.dateFrom, query.dateTo, now);
    return assembleLeadAnalytics(await this.leads.analyticsRaw(scope, range, previousRange, query.branchId, now));
  }

  async exportCsv(query: ExportLeadsQuery, actor: IamActor): Promise<string> {
    const scope = await this.scopeFor(actor.userId);
    const rows = await this.leads.findMany(buildLeadWhere(scope, query), [{ createdAt: 'desc' }, { id: 'asc' }], EXPORT_LIMIT);
    const header = ['Name', 'Phone', 'Email', 'Gender', 'Source', 'Source detail', 'Status', 'Branch', 'Interested plan', 'Assigned to', 'Next follow-up', 'Expected join date', 'Lost reason', 'Created at', 'Last activity', 'Notes'];
    const lines = rows.map((r) =>
      [
        r.name, r.phone, r.email, r.gender, r.source, r.sourceDetail, r.status, r.branch?.name, r.interestedPlan?.name, r.assignedTo?.name,
        iso(r.nextFollowUpAt), day(r.expectedJoinDate), r.lostReason, r.createdAt.toISOString(), r.lastActivityAt.toISOString(), r.notes,
      ]
        .map(csvCell)
        .join(','),
    );
    await this.audit(actor, 'lead.exported', undefined, { count: rows.length, filters: Object.keys(query).filter((k) => (query as Record<string, unknown>)[k] !== undefined) });
    return [header.join(','), ...lines].join('\n');
  }

  // ── writes ───────────────────────────────────────────────────────────────

  async create(input: CreateLeadInput, actor: IamActor): Promise<LeadDetailDto> {
    if (input.branchId) await this.assertBranchUsable(input.branchId, actor.userId);
    if (input.interestedPlanId) await this.assertPlanExists(input.interestedPlanId);
    let assignee = actor.userId;
    if (input.assignedToUserId && input.assignedToUserId !== actor.userId) {
      if (!(await permissionEngine.hasPermission(this.tenantId, actor.userId, 'leads:assign'))) {
        throw new AppError(ErrorCode.FORBIDDEN, 'You need the leads:assign permission to assign a lead to someone else.', 403);
      }
      assignee = input.assignedToUserId;
    }
    await this.assertAssigneeValid(assignee);
    const email = input.email ? normalizeLeadEmail(input.email) : null;
    await this.assertNoDuplicate(input.phone, email);

    const now = new Date();
    const id = await this.leads.create({
      tenantId: this.tenantId,
      branchId: input.branchId,
      name: input.name,
      phone: input.phone,
      phoneKey: phoneKeyOf(input.phone),
      email,
      gender: input.gender,
      source: input.source,
      sourceDetail: input.sourceDetail,
      status: 'NEW',
      interestedPlanId: input.interestedPlanId,
      interest: input.interest,
      assignedToUserId: assignee,
      nextFollowUpAt: input.nextFollowUpAt ? new Date(input.nextFollowUpAt) : undefined,
      expectedJoinDate: input.expectedJoinDate ? new Date(input.expectedJoinDate) : undefined,
      notes: input.notes,
      lastActivityAt: now,
      createdByUserId: actor.userId,
    });
    await this.leads.addActivity({ tenantId: this.tenantId, leadId: id, type: 'CREATED', note: `Lead created (${input.source.replace(/_/g, ' ').toLowerCase()})`, toStatus: 'NEW', createdByUserId: actor.userId });
    await this.audit(actor, 'lead.created', id, { source: input.source, assigned: assignee !== actor.userId });
    return this.getById(id, actor.userId);
  }

  async update(id: string, input: UpdateLeadInput, actor: IamActor): Promise<LeadDetailDto> {
    const existing = await this.mustFind(id, actor.userId);
    if (input.nextFollowUpAt && !isOpenStatus(existing.status)) {
      throw new ValidationError('Request validation failed', { fields: [{ field: 'nextFollowUpAt', message: 'A closed (converted / lost) lead cannot have a follow-up.' }] });
    }
    if (input.branchId) await this.assertBranchUsable(input.branchId, actor.userId);
    if (input.interestedPlanId) await this.assertPlanExists(input.interestedPlanId);
    const nextEmail = input.email === undefined ? undefined : input.email ? normalizeLeadEmail(input.email) : null;
    const phoneChanged = input.phone !== undefined && phoneKeyOf(input.phone) !== existing.phoneKey;
    const emailChanged = nextEmail !== undefined && nextEmail !== existing.email;
    if (phoneChanged || emailChanged) {
      await this.assertNoDuplicate(phoneChanged ? input.phone! : null, emailChanged ? nextEmail! : null, id);
    }
    const data: Prisma.LeadUncheckedUpdateInput = {
      name: input.name,
      phone: input.phone,
      phoneKey: input.phone !== undefined ? phoneKeyOf(input.phone) : undefined,
      email: nextEmail,
      gender: input.gender,
      source: input.source,
      sourceDetail: input.sourceDetail,
      branchId: input.branchId,
      interestedPlanId: input.interestedPlanId,
      interest: input.interest,
      nextFollowUpAt: input.nextFollowUpAt === undefined ? undefined : input.nextFollowUpAt ? new Date(input.nextFollowUpAt) : null,
      expectedJoinDate: input.expectedJoinDate === undefined ? undefined : input.expectedJoinDate ? new Date(input.expectedJoinDate) : null,
      notes: input.notes,
    };
    await this.leads.update(id, data);
    await this.audit(actor, 'lead.updated', id, { fields: Object.keys(input) });
    return this.getById(id, actor.userId);
  }

  async softDelete(id: string, actor: IamActor): Promise<void> {
    await this.mustFind(id, actor.userId);
    await this.leads.softDelete(id);
    await this.audit(actor, 'lead.deleted', id);
  }

  async changeStatus(id: string, input: ChangeStatusInput, actor: IamActor): Promise<LeadDetailDto> {
    const lead = await this.mustFind(id, actor.userId);
    const from = lead.status as LeadStatusValue;
    const problem = statusTransitionError(from, input.status, input.lostReason);
    if (problem) {
      const field = input.status === 'LOST' && !input.lostReason ? 'lostReason' : 'status';
      throw new ValidationError(problem, { fields: [{ field, message: problem }] });
    }
    const now = new Date();
    const toLost = input.status === 'LOST';
    await this.leads.update(id, {
      status: input.status,
      lastActivityAt: now,
      ...(toLost
        ? { lostReason: input.lostReason, lostNote: input.lostNote ?? null, lostAt: now, nextFollowUpAt: null }
        : { lostReason: null, lostNote: null, lostAt: null }),
    });
    await this.leads.addActivity({
      tenantId: this.tenantId,
      leadId: id,
      type: 'STATUS_CHANGE',
      note: input.note ?? (toLost ? input.lostNote : undefined),
      outcome: toLost ? input.lostReason : undefined,
      fromStatus: from,
      toStatus: input.status,
      createdByUserId: actor.userId,
    });
    await this.audit(actor, 'lead.status_changed', id, { from, to: input.status, ...(toLost ? { lostReason: input.lostReason } : {}) });
    return this.getById(id, actor.userId);
  }

  async assign(id: string, input: AssignLeadInput, actor: IamActor): Promise<LeadDetailDto> {
    const lead = await this.mustFind(id, actor.userId);
    if (input.assignedToUserId) await this.assertAssigneeValid(input.assignedToUserId);
    if ((lead.assignedTo?.id ?? null) === input.assignedToUserId) return this.getById(id, actor.userId);
    const target = input.assignedToUserId ? await this.db.user.findFirst({ where: { id: input.assignedToUserId, tenantId: this.tenantId }, select: { name: true } }) : null;
    await this.leads.update(id, { assignedToUserId: input.assignedToUserId, lastActivityAt: new Date() });
    await this.leads.addActivity({
      tenantId: this.tenantId,
      leadId: id,
      type: 'ASSIGNMENT',
      note: target ? `Assigned to ${target.name}` : 'Unassigned',
      createdByUserId: actor.userId,
    });
    await this.audit(actor, 'lead.assigned', id, { from: lead.assignedTo?.id ?? null, to: input.assignedToUserId });
    return this.getById(id, actor.userId);
  }

  async addActivity(id: string, input: AddActivityInput, actor: IamActor): Promise<LeadDetailDto> {
    const lead = await this.mustFind(id, actor.userId);
    const nextFollowUp = input.nextFollowUpAt !== undefined ? input.nextFollowUpAt : input.type === 'FOLLOW_UP' && input.scheduledFor ? input.scheduledFor : undefined;
    if (nextFollowUp && !isOpenStatus(lead.status as LeadStatusValue)) {
      throw new ValidationError('Request validation failed', { fields: [{ field: 'nextFollowUpAt', message: 'A closed (converted / lost) lead cannot have a follow-up.' }] });
    }
    await this.leads.addActivity({
      tenantId: this.tenantId,
      leadId: id,
      type: input.type,
      note: input.note,
      outcome: input.outcome,
      scheduledFor: input.scheduledFor ? new Date(input.scheduledFor) : undefined,
      createdByUserId: actor.userId,
    });
    await this.leads.update(id, {
      lastActivityAt: new Date(),
      ...(nextFollowUp !== undefined ? { nextFollowUpAt: nextFollowUp ? new Date(nextFollowUp) : null } : {}),
    });
    await this.audit(actor, 'lead.activity_added', id, { type: input.type, followUpChanged: nextFollowUp !== undefined });
    return this.getById(id, actor.userId);
  }

  /**
   * Converts a lead into a member by reusing `MemberService` (capacity, uniqueness, QR, notifications, audit all apply).
   * Not one DB transaction (the tenant-scoped client can't share one across services), so it is ordered to fail safe:
   * everything that can be validated is checked first; the member is created; the lead flips with a conditional claim;
   * any later failure soft-deletes the member again so the lead is left exactly as it was.
   */
  async convert(id: string, input: ConvertLeadInput, actor: IamActor): Promise<{ lead: LeadDetailDto; member: { id: string; memberId: string; name: string } }> {
    const lead = await this.mustFind(id, actor.userId);
    if (lead.status === 'CONVERTED' || lead.convertedMemberId) throw new ConflictError(ErrorCode.CONFLICT, 'This lead has already been converted to a member.');

    const branchId = input.branchId ?? lead.branchId;
    if (!branchId) throw new ValidationError('Request validation failed', { fields: [{ field: 'branchId', message: 'Choose the branch the member joins (the lead has none).' }] });
    const split = splitName(lead.name);
    const firstName = input.firstName ?? split.firstName;
    const lastName = input.lastName ?? split.lastName;
    if (!lastName) throw new ValidationError('Request validation failed', { fields: [{ field: 'lastName', message: 'The lead has a single-word name — provide lastName for the member.' }] });
    if (input.planId) {
      const plan = await this.db.membershipPlan.findFirst({ where: { id: input.planId, tenantId: this.tenantId, deletedAt: null }, select: { isActive: true, name: true } });
      if (!plan) throw new NotFoundError('Membership plan not found.');
      if (!plan.isActive) throw new ValidationError(`Plan "${plan.name}" is inactive.`);
    }

    const members = new MemberService(this.tenantId);
    // 1. Create the member — any failure (duplicate phone/email, capacity, branch access…) propagates and nothing has changed.
    const member = await members.create(
      {
        firstName,
        lastName,
        phone: lead.phone,
        email: lead.email ?? undefined,
        gender: lead.gender ?? undefined,
        branchId,
        dateOfBirth: input.dateOfBirth,
        trainerId: input.trainerId,
        fitnessGoals: lead.interest ?? undefined,
        notes: input.notes ?? lead.notes ?? undefined,
        joiningDate: input.startDate,
        awarenessSource: awarenessSourceFor(lead.source),
      } as Parameters<MemberService['create']>[0],
      actor,
    );
    try {
      if (input.planId) await members.assignMembership(member.id, { planId: input.planId, startDate: input.startDate }, actor);
      const now = new Date();
      const claimed = await this.leads.markConverted(this.tenantId, id, { convertedMemberId: member.id, convertedAt: now, fromStatus: lead.status });
      if (!claimed) throw new ConflictError(ErrorCode.CONFLICT, 'This lead was converted by someone else just now.');
      await this.leads.addActivity({
        tenantId: this.tenantId,
        leadId: id,
        type: 'CONVERTED',
        note: `Converted to member ${member.memberId}${input.planId ? ' with a membership plan' : ''}`,
        fromStatus: lead.status,
        toStatus: 'CONVERTED',
        createdByUserId: actor.userId,
      });
      await this.audit(actor, 'lead.converted', id, { memberId: member.id, planAssigned: Boolean(input.planId) });
    } catch (err) {
      await members.softDelete(member.id, actor).catch(() => undefined);
      throw err;
    }
    return { lead: await this.getById(id, actor.userId), member: { id: member.id, memberId: member.memberId, name: `${member.firstName} ${member.lastName}`.trim() } };
  }

  // ── internals ────────────────────────────────────────────────────────────

  private async scopeFor(actorUserId: string): Promise<LeadScope> {
    const access = await getBranchAccess(this.tenantId, actorUserId);
    return { tenantId: this.tenantId, actorUserId, restrictToBranchIds: access.allBranches ? undefined : access.branchIds };
  }

  private async mustFind(id: string, actorUserId: string): Promise<LeadRow> {
    const lead = await this.leads.findById(this.tenantId, id);
    if (!lead) throw new NotFoundError('Lead not found.');
    if (lead.branchId) await assertBranchAccess(this.tenantId, actorUserId, lead.branchId);
    return lead;
  }

  private async assertBranchUsable(branchId: string, actorUserId: string): Promise<void> {
    const found = await this.db.branch.count({ where: { id: branchId, tenantId: this.tenantId, isActive: true } });
    if (found === 0) throw new NotFoundError('Selected branch does not exist or is inactive.');
    await assertBranchAccess(this.tenantId, actorUserId, branchId);
  }

  private async assertPlanExists(planId: string): Promise<void> {
    const found = await this.db.membershipPlan.count({ where: { id: planId, tenantId: this.tenantId, deletedAt: null } });
    if (found === 0) throw new NotFoundError('Membership plan not found.');
  }

  private async assertAssigneeValid(userId: string): Promise<void> {
    const found = await this.db.user.count({ where: { id: userId, tenantId: this.tenantId, status: 'ACTIVE', deletedAt: null } });
    if (found === 0) throw new ValidationError('Request validation failed', { fields: [{ field: 'assignedToUserId', message: 'Assignee must be an active staff member of this gym.' }] });
  }

  /** 409 when the phone/email belongs to an OPEN lead or to a (non-deleted) member. Lost / converted leads never block. */
  private async assertNoDuplicate(phone: string | null, email: string | null, excludeLeadId?: string): Promise<void> {
    const matches = await this.findDuplicates(phone, email, excludeLeadId);
    if (matches.length === 0) return;
    const m = matches[0]!;
    const what = m.matchedOn.map((x) => (x === 'phone' ? 'phone number' : 'email')).join(' and ');
    const who = m.type === 'MEMBER' ? `member ${m.name} (${m.memberCode})` : `an open lead (${m.name}, ${m.status})`;
    throw new AppError(ErrorCode.CONFLICT, `This ${what} already belongs to ${who}.`, 409, { responseData: { duplicates: matches } });
  }

  async findDuplicates(phone: string | null, email: string | null, excludeLeadId?: string): Promise<LeadDuplicateMatch[]> {
    const phoneKey = phone ? phoneKeyOf(phone) : null;
    const out: LeadDuplicateMatch[] = [];
    const leadRows = await this.leads.findDuplicateLeads(this.tenantId, phoneKey, email, excludeLeadId);
    for (const l of leadRows) {
      if (!isBlockingLeadStatus(l.status as LeadStatusValue)) continue;
      const matchedOn: Array<'phone' | 'email'> = [];
      if (phoneKey && l.phoneKey === phoneKey) matchedOn.push('phone');
      if (email && l.email && l.email.toLowerCase() === email) matchedOn.push('email');
      out.push({ type: 'LEAD', id: l.id, name: l.name, status: l.status, memberCode: null, matchedOn });
    }
    // Members hold phone/email as ciphertext: email via blind index; phone by decrypting and comparing the normalised key.
    const byId = new Map<string, LeadDuplicateMatch>();
    if (email) {
      const m = await this.db.member.findFirst({ where: { tenantId: this.tenantId, emailHash: hashEmail(email), deletedAt: null }, select: { id: true, memberId: true, firstName: true, lastName: true } });
      if (m) byId.set(m.id, { type: 'MEMBER', id: m.id, name: `${m.firstName} ${m.lastName}`.trim(), status: null, memberCode: m.memberId, matchedOn: ['email'] });
    }
    if (phoneKey && phoneKey.length >= 7) {
      const candidates = await this.db.member.findMany({
        where: { tenantId: this.tenantId, deletedAt: null, phone: { not: null } },
        select: { id: true, memberId: true, firstName: true, lastName: true, phone: true },
      });
      for (const c of candidates) {
        let key = '';
        try {
          key = phoneKeyOf(decryptMemberField(c.phone!));
        } catch {
          continue;
        }
        if (key !== phoneKey) continue;
        const prev = byId.get(c.id);
        if (prev) prev.matchedOn.push('phone');
        else byId.set(c.id, { type: 'MEMBER', id: c.id, name: `${c.firstName} ${c.lastName}`.trim(), status: null, memberCode: c.memberId, matchedOn: ['phone'] });
      }
    }
    return [...out, ...byId.values()];
  }

  private async audit(actor: IamActor, action: string, entityId?: string, after?: Record<string, unknown>): Promise<void> {
    await this.auditLog.record({
      tenantId: this.tenantId,
      actorUserId: actor.userId,
      actorRole: actor.role,
      action,
      entityType: 'lead',
      entityId,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
      after,
    });
  }
}
