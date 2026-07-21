import type { InvitationStatus } from '@prisma/client';

import { AppError, ConflictError, NotFoundError } from '../../../core/errors/app-error';
import { ErrorCode } from '../../../core/errors/error-codes';
import { eventBus } from '../../../core/events/event-bus';
import { passwordService } from '../../../core/security/password.service';
import { generateOpaqueToken, hashToken } from '../../../core/security/token.util';
import { getTenantScopedClient } from '../../../infrastructure/database/tenant-scoped-client';
import { AuditLogRepository } from '../../authentication/repositories/audit-log.repository';
import { RoleRepository } from '../../authentication/repositories/role.repository';
import type { IamActor } from '../../authentication/utils/actor.util';
import { RoleManagementRepository } from '../../roles/repositories/role-management.repository';
import { UserManagementRepository } from '../../users/repositories/user-management.repository';
import { InvitationRepository, type InvitationWithRelations } from '../repositories/invitation.repository';

const INVITATION_TTL_HOURS = 48;

export const InvitationEvents = {
  Created: 'iam.invitation_created',
} as const;

export interface InvitationDto {
  id: string;
  email: string;
  role: { id: string; name: string };
  invitedBy: string;
  status: InvitationStatus;
  expiresAt: string;
  acceptedAt: string | null;
  createdAt: string;
}

function toDto(invitation: InvitationWithRelations): InvitationDto {
  return {
    id: invitation.id,
    email: invitation.email,
    role: { id: invitation.role.id, name: invitation.role.name },
    invitedBy: invitation.invitedBy.name,
    status: invitation.status,
    expiresAt: invitation.expiresAt.toISOString(),
    acceptedAt: invitation.acceptedAt?.toISOString() ?? null,
    createdAt: invitation.createdAt.toISOString(),
  };
}

export class InvitationService {
  private readonly repository: InvitationRepository;
  private readonly users: UserManagementRepository;
  private readonly roles: RoleManagementRepository;
  private readonly authRoleRepository: RoleRepository;
  private readonly auditLog: AuditLogRepository;

  constructor(private readonly tenantId: string) {
    const db = getTenantScopedClient(tenantId);
    this.repository = new InvitationRepository(db);
    this.users = new UserManagementRepository(db);
    this.roles = new RoleManagementRepository(db);
    this.authRoleRepository = new RoleRepository(db);
    this.auditLog = new AuditLogRepository(db);
  }

  async list(query: { status?: InvitationStatus; page: number; limit: number }) {
    const { items, total } = await this.repository.list(this.tenantId, query);
    return {
      items: items.map(toDto),
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.ceil(total / query.limit),
    };
  }

  async invite(
    input: { email: string; roleId: string; branchIds?: string[] },
    actor: IamActor,
  ): Promise<InvitationDto> {
    const email = input.email.toLowerCase();

    const existingUser = await this.users.findByEmail(this.tenantId, email);
    if (existingUser) throw new ConflictError(ErrorCode.CONFLICT, 'An account with this email already exists.');

    const pending = await this.repository.findPendingByEmail(this.tenantId, email);
    if (pending) throw new ConflictError(ErrorCode.CONFLICT, 'A pending invitation for this email already exists.');

    const role = await this.roles.findById(input.roleId);
    if (!role || (role.tenantId !== null && role.tenantId !== this.tenantId)) {
      throw new NotFoundError('Role not found.');
    }
    if (role.name === 'SUPER_ADMIN' || role.name === 'OWNER') {
      throw new AppError(ErrorCode.FORBIDDEN, `The ${role.name} role cannot be granted by invitation.`, 403);
    }
    if (!role.isActive) throw new AppError(ErrorCode.VALIDATION_ERROR, `Role "${role.name}" is inactive.`, 422);

    const token = generateOpaqueToken();
    const invitation = await this.repository.create({
      tenantId: this.tenantId,
      email,
      roleId: role.id,
      branchIds: input.branchIds ?? undefined,
      invitedByUserId: actor.userId,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + INVITATION_TTL_HOURS * 3600_000),
    });

    await this.audit(actor, 'iam.invitation_sent', invitation.id);
    this.emitCreated(invitation, token);
    return toDto(invitation);
  }

  async resend(id: string, actor: IamActor): Promise<InvitationDto> {
    const invitation = await this.mustFind(id);
    if (invitation.status !== 'PENDING') {
      throw new ConflictError(ErrorCode.CONFLICT, 'Only pending invitations can be resent.');
    }
    const token = generateOpaqueToken();
    await this.repository.update(id, {
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + INVITATION_TTL_HOURS * 3600_000),
    });
    const fresh = (await this.repository.findById(this.tenantId, id))!;
    await this.audit(actor, 'iam.invitation_resent', id);
    this.emitCreated(fresh, token);
    return toDto(fresh);
  }

  async revoke(id: string, actor: IamActor): Promise<void> {
    const invitation = await this.mustFind(id);
    if (invitation.status !== 'PENDING') {
      throw new ConflictError(ErrorCode.CONFLICT, 'Only pending invitations can be revoked.');
    }
    await this.repository.update(id, { status: 'REVOKED' });
    await this.audit(actor, 'iam.invitation_revoked', id);
  }

  /** Public — invitee opens the emailed link; token is the only credential. */
  async lookup(token: string): Promise<{ email: string; roleName: string; invitedBy: string; expiresAt: string }> {
    const invitation = await this.mustFindValidByToken(token);
    return {
      email: invitation.email,
      roleName: invitation.role.name,
      invitedBy: invitation.invitedBy.name,
      expiresAt: invitation.expiresAt.toISOString(),
    };
  }

  /** Public — creates the staff account and consumes the invitation. */
  async accept(input: { token: string; name: string; phone?: string; password: string }): Promise<{ email: string }> {
    const invitation = await this.mustFindValidByToken(input.token);

    const existingUser = await this.users.findByEmail(this.tenantId, invitation.email);
    if (existingUser) throw new ConflictError(ErrorCode.CONFLICT, 'An account with this email already exists.');

    const passwordHash = await passwordService.hash(input.password);
    const branchIds = (invitation.branchIds as string[] | null) ?? null;

    // Invitee proved control of the email by opening the tokenized link.
    const user = await this.users.create({
      tenantId: this.tenantId,
      name: input.name,
      email: invitation.email,
      phone: input.phone,
      passwordHash,
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
      allBranches: branchIds === null,
    });
    await this.users.setRoles(user.id, [invitation.roleId]);
    if (branchIds && branchIds.length > 0) {
      await this.users.setBranches(this.tenantId, user.id, false, branchIds.map((branchId) => ({ branchId })));
    }
    await this.authRoleRepository.bumpPermissionVersion(this.tenantId, user.id);

    await this.repository.update(invitation.id, {
      status: 'ACCEPTED',
      acceptedAt: new Date(),
      acceptedUserId: user.id,
    });
    await this.auditLog.record({
      tenantId: this.tenantId,
      actorUserId: user.id,
      actorRole: invitation.role.name,
      action: 'iam.invitation_accepted',
      entityType: 'invitation',
      entityId: invitation.id,
    });
    return { email: invitation.email };
  }

  // ── internals ───────────────────────────────────────────────────────────

  private async mustFind(id: string): Promise<InvitationWithRelations> {
    const invitation = await this.repository.findById(this.tenantId, id);
    if (!invitation) throw new NotFoundError('Invitation not found.');
    return invitation;
  }

  private async mustFindValidByToken(token: string): Promise<InvitationWithRelations> {
    const invitation = await this.repository.findByTokenHash(hashToken(token));
    if (!invitation || invitation.status === 'REVOKED') {
      throw new AppError(ErrorCode.TOKEN_INVALID, 'This invitation link is not valid.', 410);
    }
    if (invitation.status === 'ACCEPTED') {
      throw new ConflictError(ErrorCode.CONFLICT, 'This invitation has already been used.');
    }
    if (invitation.expiresAt < new Date()) {
      // Lazily transition so list views show the real state.
      await this.repository.update(invitation.id, { status: 'EXPIRED' });
      throw new AppError(ErrorCode.TOKEN_EXPIRED, 'This invitation has expired. Ask for a new one.', 410);
    }
    return invitation;
  }

  private emitCreated(invitation: InvitationWithRelations, token: string): void {
    eventBus.emitEvent(InvitationEvents.Created, {
      tenantId: this.tenantId,
      email: invitation.email,
      inviterName: invitation.invitedBy.name,
      roleLabel: invitation.role.name,
      token,
    });
  }

  private async audit(actor: IamActor, action: string, entityId: string): Promise<void> {
    await this.auditLog.record({
      tenantId: this.tenantId,
      actorUserId: actor.userId,
      actorRole: actor.role,
      action,
      entityType: 'invitation',
      entityId,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });
  }
}
