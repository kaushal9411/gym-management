import type { TenantScopedPrisma } from '../../../infrastructure/database/tenant-scoped-client';
import type {
  CreateSessionInput,
  ISessionRepository,
  SessionWithToken,
} from '../interfaces/repositories.interface';

/**
 * A "session" is a RefreshToken + its paired UserSession row, always
 * created/rotated/revoked together — modeled as one repository since they
 * share a lifecycle (see prisma schema: UserSession.refreshTokenId is 1:1).
 */
export class SessionRepository implements ISessionRepository {
  constructor(private readonly db: TenantScopedPrisma) {}

  async create(input: CreateSessionInput): Promise<SessionWithToken> {
    const refreshToken = await this.db.refreshToken.create({
      data: {
        tenantId: input.tenantId,
        userId: input.userId,
        tokenHash: input.tokenHash,
        family: input.family,
        expiresAt: input.expiresAt,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      },
    });

    const session = await this.db.userSession.create({
      data: {
        tenantId: input.tenantId,
        userId: input.userId,
        refreshTokenId: refreshToken.id,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
        deviceLabel: deriveDeviceLabel(input.userAgent),
      },
    });

    return toSessionWithToken(refreshToken, session.id);
  }

  async findByTokenHash(tokenHash: string): Promise<SessionWithToken | null> {
    const token = await this.db.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: { select: { id: true } } },
    });
    if (!token) return null;

    const session = await this.db.userSession.findUnique({ where: { refreshTokenId: token.id } });
    return toSessionWithToken(token, session?.id ?? token.id);
  }

  async rotate(oldTokenHash: string, next: CreateSessionInput): Promise<SessionWithToken> {
    const oldToken = await this.db.refreshToken.findUnique({ where: { tokenHash: oldTokenHash } });

    const newToken = await this.db.refreshToken.create({
      data: {
        tenantId: next.tenantId,
        userId: next.userId,
        tokenHash: next.tokenHash,
        family: next.family,
        expiresAt: next.expiresAt,
        ipAddress: next.ipAddress,
        userAgent: next.userAgent,
      },
    });

    await this.db.refreshToken.update({
      where: { tokenHash: oldTokenHash },
      data: { revokedAt: new Date(), replacedByTokenHash: next.tokenHash },
    });

    const oldSession = oldToken ? await this.db.userSession.findUnique({ where: { refreshTokenId: oldToken.id } }) : null;
    let sessionId: string;
    if (oldSession) {
      await this.db.userSession.update({
        where: { id: oldSession.id },
        data: { refreshTokenId: newToken.id, lastActiveAt: new Date() },
      });
      sessionId = oldSession.id;
    } else {
      const created = await this.db.userSession.create({
        data: {
          tenantId: next.tenantId,
          userId: next.userId,
          refreshTokenId: newToken.id,
          ipAddress: next.ipAddress,
          userAgent: next.userAgent,
          deviceLabel: deriveDeviceLabel(next.userAgent),
        },
      });
      sessionId = created.id;
    }

    return toSessionWithToken(newToken, sessionId);
  }

  async revokeBySessionId(sessionId: string): Promise<void> {
    const session = await this.db.userSession.findUnique({ where: { id: sessionId } });
    if (!session) return;

    await this.db.userSession.update({ where: { id: sessionId }, data: { revokedAt: new Date() } });
    if (session.refreshTokenId) {
      await this.db.refreshToken.update({
        where: { id: session.refreshTokenId },
        data: { revokedAt: new Date() },
      });
    }
  }

  async revokeFamily(family: string): Promise<void> {
    await this.db.refreshToken.updateMany({
      where: { family, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllForUser(tenantId: string, userId: string): Promise<void> {
    await this.db.refreshToken.updateMany({
      where: { tenantId, userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.db.userSession.updateMany({
      where: { tenantId, userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async listActiveForUser(tenantId: string, userId: string) {
    return this.db.userSession.findMany({
      where: { tenantId, userId, revokedAt: null },
      select: { id: true, deviceLabel: true, ipAddress: true, userAgent: true, lastActiveAt: true },
      orderBy: { lastActiveAt: 'desc' },
    });
  }
}

function toSessionWithToken(
  token: { id: string; tokenHash: string; family: string; expiresAt: Date; revokedAt: Date | null; userId: string; tenantId: string },
  sessionId: string,
): SessionWithToken {
  return {
    sessionId,
    refreshTokenId: token.id,
    tokenHash: token.tokenHash,
    family: token.family,
    expiresAt: token.expiresAt,
    revokedAt: token.revokedAt,
    userId: token.userId,
    tenantId: token.tenantId,
  };
}

function deriveDeviceLabel(userAgent?: string): string | undefined {
  if (!userAgent) return undefined;
  if (/mobile/i.test(userAgent)) return 'Mobile device';
  if (/chrome/i.test(userAgent)) return 'Chrome browser';
  if (/firefox/i.test(userAgent)) return 'Firefox browser';
  if (/safari/i.test(userAgent)) return 'Safari browser';
  return 'Unknown device';
}
