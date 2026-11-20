import { AppError } from '../../../core/errors/app-error';
import { ErrorCode } from '../../../core/errors/error-codes';
import { authLogger } from '../../../core/logging/logger';
import { passwordService } from '../../../core/security/password.service';
import { prisma } from '../../../infrastructure/database/prisma';
import type { PublicTenantSummary } from '../../tenants/interfaces/tenant.interface';
import type { DiscoverGymsInput } from '../validators/gym-discovery.validators';

/** Same dummy hash the real login endpoints verify against for an unknown user — keeps response time uniform. */
const DUMMY_HASH = '$2a$12$invalidinvalidinvaliduinvalidinvalidinvalidinvalidin';
/** Upper bound on bcrypt verifications per request — one identity realistically spans a handful of gyms. */
const MAX_CANDIDATES = 10;
/** Same statuses `TenantRepository.listActive` treats as "a login could succeed here". */
const LOGIN_ELIGIBLE_STATUSES = ['ACTIVE', 'TRIAL', 'PAST_DUE'];

const TENANT_SELECT = {
  slug: true,
  name: true,
  status: true,
  maintenanceMode: true,
  deletedAt: true,
  branding: { select: { logoUrl: true } },
} as const;

interface Candidate {
  passwordHash: string;
  tenant: {
    slug: string;
    name: string;
    status: string;
    maintenanceMode: boolean;
    deletedAt: Date | null;
    branding: { logoUrl: string | null } | null;
  };
}

/**
 * Pre-login "which gym(s) is this account in?" lookup, so the apps can show a
 * plain login form first and only ask for a gym when the same credentials
 * exist in more than one. Platform-plane (no tenant context): uses the RAW
 * prisma client deliberately, like `TenantRepository`, because the point is
 * searching across tenants.
 *
 * Only gyms where the password actually verifies are returned, so this can't
 * be used to learn which gyms an email/Member ID belongs to without knowing
 * the password. It never mutates anything (no failed-login counters, no
 * audit) — the real tenant-scoped login that follows owns all of that,
 * including lockout.
 */
export class GymDiscoveryService {
  async discover(input: DiscoverGymsInput): Promise<PublicTenantSummary[]> {
    const candidates = input.actorType === 'staff' ? await this.staffCandidates(input.identifier) : await this.memberCandidates(input.identifier);

    if (candidates.length === 0) await passwordService.verify(input.password, DUMMY_HASH);

    const verified = await Promise.all(
      candidates.map(async (c) => ((await passwordService.verify(input.password, c.passwordHash)) ? c.tenant : null)),
    );
    const gyms = verified
      .filter((t): t is Candidate['tenant'] => t !== null)
      .filter((t) => t.deletedAt === null && !t.maintenanceMode && LOGIN_ELIGIBLE_STATUSES.includes(t.status))
      .map((t) => ({ slug: t.slug, name: t.name, logoUrl: t.branding?.logoUrl ?? null }))
      .sort((a, b) => a.name.localeCompare(b.name));

    if (gyms.length === 0) {
      authLogger.warn('Gym discovery found no matching account', { actorType: input.actorType });
      const message = input.actorType === 'staff' ? 'Incorrect email or password' : 'Incorrect member ID or password';
      throw new AppError(ErrorCode.INVALID_CREDENTIALS, message, 401);
    }
    return gyms;
  }

  private staffCandidates(identifier: string): Promise<Candidate[]> {
    return prisma.user.findMany({
      where: { email: identifier.toLowerCase(), deletedAt: null },
      select: { passwordHash: true, tenant: { select: TENANT_SELECT } },
      take: MAX_CANDIDATES,
    });
  }

  private memberCandidates(memberCode: string): Promise<Candidate[]> {
    return prisma.memberCredential.findMany({
      where: { member: { memberId: memberCode, deletedAt: null } },
      select: { passwordHash: true, tenant: { select: TENANT_SELECT } },
      take: MAX_CANDIDATES,
    });
  }
}

export const gymDiscoveryService = new GymDiscoveryService();
