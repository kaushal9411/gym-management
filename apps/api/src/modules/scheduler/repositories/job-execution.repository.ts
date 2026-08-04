import type { JobRunStatus } from '@prisma/client';

import { prisma } from '../../../infrastructure/database/prisma';

export class JobExecutionRepository {
  async history(params: { jobName?: string; status?: JobRunStatus; skip: number; take: number }) {
    const where = { ...(params.jobName ? { jobName: params.jobName } : {}), ...(params.status ? { status: params.status } : {}) };
    const [total, items] = await Promise.all([
      prisma.jobExecution.count({ where }),
      prisma.jobExecution.findMany({ where, orderBy: { startedAt: 'desc' }, skip: params.skip, take: params.take }),
    ]);
    return { total, items };
  }

  async failed(params: { skip: number; take: number }) {
    const where = { status: 'FAILED' as const };
    const [total, items] = await Promise.all([
      prisma.jobExecution.count({ where }),
      prisma.jobExecution.findMany({ where, orderBy: { startedAt: 'desc' }, skip: params.skip, take: params.take }),
    ]);
    return { total, items };
  }

  async findById(id: string) {
    return prisma.jobExecution.findUnique({ where: { id } });
  }

  async recentAcrossAllJobs(limit: number) {
    return prisma.jobExecution.findMany({ where: { status: { in: ['COMPLETED', 'FAILED'] } }, orderBy: { startedAt: 'desc' }, take: limit });
  }
}

export const jobExecutionRepository = new JobExecutionRepository();
