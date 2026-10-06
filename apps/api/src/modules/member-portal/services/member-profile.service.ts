import { ConflictError, NotFoundError } from '../../../core/errors/app-error';
import { ErrorCode } from '../../../core/errors/error-codes';
import { logger } from '../../../core/logging/logger';
import { deleteStoredMemberPhoto, uploadDataUrl } from '../../../core/storage/storage.service';
import { getTenantScopedClient } from '../../../infrastructure/database/tenant-scoped-client';
import { loadEmailBranding } from '../../../infrastructure/mail/branding';
import { memberEmailChangedEmail } from '../../../infrastructure/mail/templates/auth-templates';
import { AuditLogRepository } from '../../authentication/repositories/audit-log.repository';
import { MemberAuthService } from '../../member-auth/services/member-auth.service';
import { MemberRepository } from '../../members/repositories/member.repository';
import { sendGatedEmail } from '../../tenant-notifications/services/channel-gate.service';
import { toMemberProfileDto, type MemberProfileDto } from '../dto/member-profile.dto';
import {
  assertEmailChangeAuthorized,
  assertMemberPhotoDataUrl,
  buildProfileUpdate,
  type ProfilePatch,
} from '../utils/member-profile.util';

export interface ProfileRequestContext {
  ipAddress?: string;
  userAgent?: string;
}


/**
 * Member self-service profile. Every method takes the member's OWN id (from
 * the token) — there is no id in any route. Writes go through
 * `MemberRepository#update` so email/phone get the identical AES-GCM +
 * blind-index treatment as the staff flow.
 */
export class MemberProfileService {
  private readonly members: MemberRepository;
  private readonly auditLog: AuditLogRepository;

  constructor(private readonly tenantId: string) {
    const db = getTenantScopedClient(tenantId);
    this.members = new MemberRepository(db);
    this.auditLog = new AuditLogRepository(db);
  }

  async get(memberId: string): Promise<MemberProfileDto> {
    return toMemberProfileDto(await this.mustFind(memberId));
  }

  async update(
    memberId: string,
    input: ProfilePatch & { currentPassword?: string },
    ctx: ProfileRequestContext,
  ): Promise<MemberProfileDto> {
    const { currentPassword, ...patch } = input;
    const existing = await this.mustFind(memberId);
    const plan = buildProfileUpdate(patch, existing);
    if (plan.changedFields.length === 0) return toMemberProfileDto(existing);

    assertEmailChangeAuthorized(plan, currentPassword);
    if (plan.emailChanged) {
      await new MemberAuthService(this.tenantId).verifyCurrentPassword(memberId, currentPassword!);
      const newEmail = plan.data.email as string | null | undefined;
      if (newEmail) {
        const clash = await this.members.findByEmail(this.tenantId, newEmail);
        if (clash && clash.id !== memberId)
          throw new ConflictError(
            ErrorCode.CONFLICT,
            'This email address can’t be used. Try a different one.',
          );
      }
    }
    if (plan.phoneChanged) {
      const newPhone = plan.data.phone as string | null | undefined;
      if (newPhone) {
        const clash = await this.members.findByPhone(this.tenantId, newPhone);
        if (clash && clash.id !== memberId)
          throw new ConflictError(
            ErrorCode.CONFLICT,
            'This phone number can’t be used. Try a different one.',
          );
      }
    }

    await this.members.update(memberId, plan.data);
    await this.auditLog.record({
      tenantId: this.tenantId,
      actorUserId: null,
      actorRole: 'MEMBER',
      action: 'member_portal.profile_updated',
      entityType: 'member',
      entityId: memberId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      // Field NAMES only; values for PII (phone/email/address/…) are never stored.
      after: {
        fields: plan.changedFields,
        ...(Object.keys(plan.enumChanges).length ? { enumChanges: plan.enumChanges } : {}),
      },
    });
    if (plan.emailChanged && existing.email)
      await this.notifyOldEmail(existing.email, existing.firstName);
    return this.get(memberId);
  }

  async uploadPhoto(
    memberId: string,
    image: string,
    ctx: ProfileRequestContext,
  ): Promise<{ profilePhotoUrl: string }> {
    const existing = await this.mustFind(memberId);
    assertMemberPhotoDataUrl(image);
    const profilePhotoUrl = await uploadDataUrl(image, {
      keyPrefix: `member-photos/${this.tenantId}/${memberId}`,
      visibility: 'public',
    });
    await this.members.update(memberId, { profilePhotoUrl });
    await this.audit(memberId, 'member_portal.photo_updated', ctx);
    await deleteStoredMemberPhoto(existing.profilePhotoUrl);
    return { profilePhotoUrl };
  }

  async removePhoto(memberId: string, ctx: ProfileRequestContext): Promise<void> {
    const existing = await this.mustFind(memberId);
    if (!existing.profilePhotoUrl) return;
    await this.members.update(memberId, { profilePhotoUrl: null });
    await this.audit(memberId, 'member_portal.photo_removed', ctx);
    await deleteStoredMemberPhoto(existing.profilePhotoUrl);
  }

  private async mustFind(memberId: string) {
    const member = await this.members.findDetail(this.tenantId, memberId);
    if (!member) throw new NotFoundError('Member not found.');
    return member;
  }

  private async audit(memberId: string, action: string, ctx: ProfileRequestContext): Promise<void> {
    await this.auditLog.record({
      tenantId: this.tenantId,
      actorUserId: null,
      actorRole: 'MEMBER',
      action,
      entityType: 'member',
      entityId: memberId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });
  }

  /** Informational, best-effort — never fails the save. */
  private async notifyOldEmail(oldEmail: string, firstName: string): Promise<void> {
    try {
      const branding = await loadEmailBranding(this.tenantId);
      const template = memberEmailChangedEmail(branding, firstName);
      await sendGatedEmail(this.tenantId, { to: oldEmail, subject: template.subject, html: template.html });
    } catch (error) {
      logger.warn('Could not queue the email-changed notice', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
