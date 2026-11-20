import type { Prisma } from '@prisma/client';

import { AppError, ConflictError, NotFoundError } from '../../../core/errors/app-error';
import { ErrorCode } from '../../../core/errors/error-codes';
import { getTenantScopedClient, type TenantScopedPrisma } from '../../../infrastructure/database/tenant-scoped-client';
import { assertBranchAccess } from '../../authentication/middlewares/branch-access.middleware';
import { AuditLogRepository } from '../../authentication/repositories/audit-log.repository';
import type { IamActor } from '../../authentication/utils/actor.util';
import { MemberBalanceService } from '../../finance/services/member-balance.service';
import type { MembershipTransferDto, MembershipTransferPreviewDto, TransferMembershipInput } from '../dto/member.dto';
import { MemberRepository, type MemberRow } from '../repositories/member.repository';
import { MembershipRepository } from '../repositories/membership.repository';
import { addDuration } from '../utils/duration.util';

const DAY_MS = 86_400_000;

const TRANSFER_INCLUDE = {
  fromMember: { select: { id: true, memberId: true, firstName: true, lastName: true } },
  toMember: { select: { id: true, memberId: true, firstName: true, lastName: true } },
  transferredByUser: { select: { name: true } },
} satisfies Prisma.MembershipTransferInclude;

type TransferRow = Prisma.MembershipTransferGetPayload<{ include: typeof TRANSFER_INCLUDE }>;

function toDto(row: TransferRow): MembershipTransferDto {
  const ref = (m: { id: string; memberId: string; firstName: string; lastName: string }) => ({
    id: m.id,
    memberId: m.memberId,
    name: `${m.firstName} ${m.lastName}`.trim(),
  });
  return {
    id: row.id,
    fromMember: ref(row.fromMember),
    toMember: ref(row.toMember),
    fromMembershipId: row.fromMembershipId,
    toMembershipId: row.toMembershipId,
    planId: row.planId,
    planName: row.planName,
    originalStartDate: row.originalStartDate.toISOString(),
    originalEndDate: row.originalEndDate.toISOString(),
    daysUsed: row.daysUsed,
    daysRemaining: row.daysRemaining,
    priceAtAssignment: row.priceAtAssignment.toString(),
    fee: row.fee.toString(),
    reason: row.reason,
    transferredByName: row.transferredByUser?.name ?? null,
    transferredAt: row.transferredAt.toISOString(),
  };
}

/**
 * Hands a member's current ACTIVE membership to another member of the same
 * gym. The sender's membership flips to CANCELLED, the receiver gets a fresh
 * ACTIVE one on the same plan with the FULL plan period restarting today, and
 * a `MembershipTransfer` row links the two and snapshots what moved (plan,
 * days used/remaining, price, fee, reason) so the history survives later plan
 * edits. The fee is a record only — no payment/income is created for it.
 *
 * The receiver's balance is never invoiced (the sender already paid for this
 * package): `MemberBalanceService` skips any membership that is the target
 * of a transfer.
 */
export class MembershipTransferService {
  private readonly db: TenantScopedPrisma;
  private readonly members: MemberRepository;
  private readonly memberships: MembershipRepository;
  private readonly auditLog: AuditLogRepository;

  constructor(private readonly tenantId: string) {
    this.db = getTenantScopedClient(tenantId);
    this.members = new MemberRepository(this.db);
    this.memberships = new MembershipRepository(this.db);
    this.auditLog = new AuditLogRepository(this.db);
  }

  /** What the transfer dialog needs before submitting: the package that would move, the gym's default fee, and whether the sender can transfer at all. */
  async preview(fromMemberId: string, actor: IamActor): Promise<MembershipTransferPreviewDto> {
    const from = await this.mustFindMember(fromMemberId, actor.userId);
    const current = from.memberships.find((m) => m.status === 'ACTIVE') ?? null;
    const defaultFee = await this.defaultFee();
    if (!current) {
      return { membership: null, defaultFee, blockedReason: 'This member has no active membership to transfer.' };
    }
    const now = new Date();
    return {
      membership: {
        id: current.id,
        planId: current.planId,
        planName: current.plan.name,
        startDate: current.startDate.toISOString(),
        endDate: current.endDate.toISOString(),
        durationDays: current.durationDays,
        priceAtAssignment: current.priceAtAssignment.toString(),
        ...this.usage(current.startDate, current.endDate, now),
      },
      // Same clamp as `transfer()` — the dialog never prefills a fee above this membership's price.
      defaultFee: Math.min(Number(defaultFee), Number(current.priceAtAssignment)).toString(),
      blockedReason: await this.senderBlockedReason(from, current.id),
    };
  }

  async transfer(fromMemberId: string, input: TransferMembershipInput, actor: IamActor): Promise<MembershipTransferDto> {
    if (input.toMemberId === fromMemberId) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'Choose a different member to transfer the membership to.', 422);
    }
    const from = await this.mustFindMember(fromMemberId, actor.userId);
    const to = await this.mustFindMember(input.toMemberId, actor.userId);

    const current = from.memberships.find((m) => m.status === 'ACTIVE');
    if (!current) throw new AppError(ErrorCode.VALIDATION_ERROR, 'This member has no active membership to transfer.', 422);
    const blocked = await this.senderBlockedReason(from, current.id);
    if (blocked) throw new AppError(ErrorCode.VALIDATION_ERROR, blocked, 422);

    if (to.status !== 'ACTIVE') {
      throw new AppError(ErrorCode.VALIDATION_ERROR, `${to.firstName} ${to.lastName}`.trim() + ' is not an active member, so they cannot receive a membership.', 422);
    }
    if (to.memberships.some((m) => m.status === 'ACTIVE' || m.status === 'PENDING')) {
      throw new ConflictError(
        ErrorCode.CONFLICT,
        'The receiving member already has an active or upcoming membership — cancel it first, or choose another member.',
      );
    }

    const plan = await this.db.membershipPlan.findFirst({ where: { id: current.planId, tenantId: this.tenantId } });
    if (!plan) throw new NotFoundError('The membership plan for this membership no longer exists.');
    const now = new Date();
    const endDate = addDuration(now, plan.durationValue, plan.durationType);
    const { daysUsed, daysRemaining } = this.usage(current.startDate, current.endDate, now);
    // The fee can never exceed what the membership itself cost — a default set higher than this plan's price is clamped, an explicit higher fee is rejected.
    const price = Number(current.priceAtAssignment);
    if (input.fee !== undefined && input.fee > price) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, `The transfer fee can't be more than the membership amount (${price}).`, 422);
    }
    const fee = input.fee ?? Math.min(Number(await this.defaultFee()), price);

    // Receiver first, then retire the sender's, then link them — the worst a
    // mid-way failure can do is leave the receiver with a membership and no
    // link row, never strand the sender without theirs.
    const received = await this.memberships.create({
      tenantId: this.tenantId,
      memberId: to.id,
      planId: current.planId,
      startDate: now,
      endDate,
      durationDays: Math.max(1, Math.round((endDate.getTime() - now.getTime()) / DAY_MS)),
      priceAtAssignment: current.priceAtAssignment,
      status: 'ACTIVE',
      autoRenew: false,
    });
    await this.memberships.cancel(current.id);

    const row = await this.db.membershipTransfer.create({
      data: {
        tenantId: this.tenantId,
        fromMemberId: from.id,
        toMemberId: to.id,
        fromMembershipId: current.id,
        toMembershipId: received.id,
        planId: current.planId,
        planName: plan.name,
        originalStartDate: current.startDate,
        originalEndDate: current.endDate,
        daysUsed,
        daysRemaining,
        priceAtAssignment: current.priceAtAssignment,
        fee,
        reason: input.reason ?? null,
        transferredBy: actor.userId,
        transferredAt: now,
      },
      include: TRANSFER_INCLUDE,
    });

    await this.audit(actor, 'member.membership_transferred_out', from.id);
    await this.audit(actor, 'member.membership_transferred_in', to.id);
    // Voids the sender's open balance (none by rule) and, because the link row now exists, leaves the receiver un-invoiced.
    const balance = new MemberBalanceService(this.tenantId);
    await balance.reconcileForMember(from.id);
    await balance.reconcileForMember(to.id);
    return toDto(row);
  }

  /** Every transfer this member took part in (sent or received), newest first. */
  async listForMember(memberId: string): Promise<MembershipTransferDto[]> {
    const rows = await this.findRows(memberId);
    return rows.map(toDto);
  }

  async findRows(memberId: string) {
    return this.db.membershipTransfer.findMany({
      where: { tenantId: this.tenantId, OR: [{ fromMemberId: memberId }, { toMemberId: memberId }] },
      include: TRANSFER_INCLUDE,
      orderBy: { transferredAt: 'desc' },
    });
  }

  // ── helpers ────────────────────────────────────────────────────────────

  private async mustFindMember(id: string, actorUserId: string): Promise<MemberRow> {
    const member = await this.members.findDetail(this.tenantId, id);
    if (!member) throw new NotFoundError('Member not found.');
    await assertBranchAccess(this.tenantId, actorUserId, member.branchId);
    return member;
  }

  private usage(startDate: Date, endDate: Date, now: Date): { daysUsed: number; daysRemaining: number } {
    return {
      daysUsed: Math.max(0, Math.floor((now.getTime() - startDate.getTime()) / DAY_MS)),
      daysRemaining: Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / DAY_MS)),
    };
  }

  private async defaultFee(): Promise<string> {
    const settings = await this.db.tenantSettings.findFirst({ where: { tenantId: this.tenantId }, select: { membershipTransferFee: true } });
    return (settings?.membershipTransferFee ?? 0).toString();
  }

  /** Reasons the SENDER's membership can't leave right now, or null. */
  private async senderBlockedReason(from: MemberRow, membershipId: string): Promise<string | null> {
    if (from.status === 'FROZEN') return 'This membership is frozen — resume it before transferring.';
    const open = await new MemberBalanceService(this.tenantId).findOpenBalanceInvoice(membershipId);
    if (open) return `This membership still has an unpaid balance of ${open.totalAmount.toString()} — settle it before transferring.`;
    return null;
  }

  private async audit(actor: IamActor, action: string, entityId: string): Promise<void> {
    await this.auditLog.record({
      tenantId: this.tenantId,
      actorUserId: actor.userId,
      actorRole: actor.role,
      action,
      entityType: 'member',
      entityId,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });
  }
}

