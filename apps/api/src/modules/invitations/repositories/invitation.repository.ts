import type { InvitationStatus, Prisma } from '@prisma/client';

import type { TenantScopedPrisma } from '../../../infrastructure/database/tenant-scoped-client';

const INVITE_INCLUDE = {
  role: true,
  invitedBy: { select: { id: true, name: true } },
} satisfies Prisma.UserInvitationInclude;

export type InvitationWithRelations = Prisma.UserInvitationGetPayload<{ include: typeof INVITE_INCLUDE }>;

export class InvitationRepository {
  constructor(private readonly db: TenantScopedPrisma) {}

  async list(
    tenantId: string,
    query: { status?: InvitationStatus; page: number; limit: number },
  ): Promise<{ items: InvitationWithRelations[]; total: number }> {
    const where: Prisma.UserInvitationWhereInput = { tenantId, ...(query.status ? { status: query.status } : {}) };
    const [items, total] = await Promise.all([
      this.db.userInvitation.findMany({
        where,
        include: INVITE_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.db.userInvitation.count({ where }),
    ]);
    return { items, total };
  }

  async findById(tenantId: string, id: string): Promise<InvitationWithRelations | null> {
    return this.db.userInvitation.findFirst({ where: { tenantId, id }, include: INVITE_INCLUDE });
  }

  async findByTokenHash(tokenHash: string): Promise<InvitationWithRelations | null> {
    return this.db.userInvitation.findFirst({ where: { tokenHash }, include: INVITE_INCLUDE });
  }

  async findPendingByEmail(tenantId: string, email: string): Promise<InvitationWithRelations | null> {
    return this.db.userInvitation.findFirst({
      where: { tenantId, email: email.toLowerCase(), status: 'PENDING', expiresAt: { gt: new Date() } },
      include: INVITE_INCLUDE,
    });
  }

  async create(data: Prisma.UserInvitationUncheckedCreateInput): Promise<InvitationWithRelations> {
    const invitation = await this.db.userInvitation.create({ data });
    return (await this.db.userInvitation.findFirst({ where: { id: invitation.id }, include: INVITE_INCLUDE }))!;
  }

  async update(id: string, data: Prisma.UserInvitationUncheckedUpdateInput): Promise<void> {
    await this.db.userInvitation.update({ where: { id }, data });
  }
}
