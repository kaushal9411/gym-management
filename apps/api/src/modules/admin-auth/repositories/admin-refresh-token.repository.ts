import type { AdminRefreshToken } from '@prisma/client';

import { prisma } from '../../../infrastructure/database/prisma';

export class AdminRefreshTokenRepository {
  async findByTokenHash(tokenHash: string): Promise<AdminRefreshToken | null> {
    return prisma.adminRefreshToken.findUnique({ where: { tokenHash } });
  }

  async create(input: {
    adminUserId: string;
    tokenHash: string;
    family: string;
    expiresAt: Date;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<AdminRefreshToken> {
    return prisma.adminRefreshToken.create({ data: input });
  }

  /** Rotation: revoke the old token, point it at the new hash, insert the new row — same family. */
  async rotate(
    oldTokenHash: string,
    next: { adminUserId: string; tokenHash: string; family: string; expiresAt: Date; ipAddress?: string; userAgent?: string },
  ): Promise<AdminRefreshToken> {
    const [, created] = await prisma.$transaction([
      prisma.adminRefreshToken.update({ where: { tokenHash: oldTokenHash }, data: { revokedAt: new Date(), replacedByTokenHash: next.tokenHash } }),
      prisma.adminRefreshToken.create({ data: next }),
    ]);
    return created;
  }

  async revokeFamily(family: string): Promise<void> {
    await prisma.adminRefreshToken.updateMany({ where: { family, revokedAt: null }, data: { revokedAt: new Date() } });
  }

  async revoke(tokenHash: string): Promise<void> {
    await prisma.adminRefreshToken.updateMany({ where: { tokenHash, revokedAt: null }, data: { revokedAt: new Date() } });
  }
}

export const adminRefreshTokenRepository = new AdminRefreshTokenRepository();
