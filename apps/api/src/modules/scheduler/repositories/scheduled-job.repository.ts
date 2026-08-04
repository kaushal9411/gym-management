import type { JobCategory } from '@prisma/client';

import { prisma } from '../../../infrastructure/database/prisma';

export class ScheduledJobRepository {
  async list(params: { category?: JobCategory; skip: number; take: number }) {
    const where = params.category ? { category: params.category } : {};
    const [total, items] = await Promise.all([
      prisma.scheduledJob.count({ where }),
      prisma.scheduledJob.findMany({ where, orderBy: [{ category: 'asc' }, { name: 'asc' }], skip: params.skip, take: params.take }),
    ]);
    return { total, items };
  }

  async findByName(name: string) {
    return prisma.scheduledJob.findUnique({ where: { name } });
  }

  async findAll() {
    return prisma.scheduledJob.findMany({ orderBy: [{ category: 'asc' }, { name: 'asc' }] });
  }
}

export const scheduledJobRepository = new ScheduledJobRepository();
