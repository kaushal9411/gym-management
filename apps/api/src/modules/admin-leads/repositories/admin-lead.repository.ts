import type { Prisma, PlatformLeadStatus, PlatformLeadTopic } from '@prisma/client';

import { prisma } from '../../../infrastructure/database/prisma';

export interface LeadListParams {
  status?: PlatformLeadStatus;
  topic?: PlatformLeadTopic;
  search?: string;
  skip: number;
  take: number;
}

export interface NewLead {
  name: string;
  email: string;
  phone?: string | null;
  gymName?: string | null;
  gymSlug?: string | null;
  gymSize?: string | null;
  topic: PlatformLeadTopic;
  message: string;
  source: string;
}

function buildWhere(params: Pick<LeadListParams, 'status' | 'topic' | 'search'>): Prisma.PlatformLeadWhereInput {
  const search = params.search?.trim();
  return {
    ...(params.status ? { status: params.status } : {}),
    ...(params.topic ? { topic: params.topic } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
            { gymName: { contains: search, mode: 'insensitive' } },
            { phone: { contains: search } },
          ],
        }
      : {}),
  };
}

export class AdminLeadRepository {
  async create(data: NewLead) {
    return prisma.platformLead.create({ data });
  }

  async list(params: LeadListParams) {
    const where = buildWhere(params);
    const [total, items] = await Promise.all([
      prisma.platformLead.count({ where }),
      prisma.platformLead.findMany({ where, orderBy: { createdAt: 'desc' }, skip: params.skip, take: params.take }),
    ]);
    return { total, items };
  }

  /** Counts per status across all leads (ignores the list filters, so the chips stay stable). */
  async countByStatus(): Promise<Array<{ status: PlatformLeadStatus; count: number }>> {
    const rows = await prisma.platformLead.groupBy({ by: ['status'], _count: { _all: true } });
    return rows.map((r) => ({ status: r.status, count: r._count._all }));
  }

  async findById(id: string) {
    return prisma.platformLead.findUnique({ where: { id } });
  }

  async update(id: string, data: Prisma.PlatformLeadUpdateInput) {
    return prisma.platformLead.update({ where: { id }, data });
  }

  async delete(id: string): Promise<void> {
    await prisma.platformLead.delete({ where: { id } });
  }
}

export const adminLeadRepository = new AdminLeadRepository();
