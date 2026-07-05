import type { CmsPageType } from '@prisma/client';

import { AppError } from '../../../core/errors/app-error';
import { ErrorCode } from '../../../core/errors/error-codes';
import { prisma } from '../../../infrastructure/database/prisma';
import { adminAuditLogRepository } from '../../admin-audit/repositories/admin-audit-log.repository';

export interface UpsertCmsPageInput {
  slug: string;
  type: CmsPageType;
  title: string;
  content: unknown;
  isPublished: boolean;
}

export class AdminCmsService {
  async list(type?: CmsPageType) {
    return prisma.cmsPage.findMany({ where: type ? { type } : {}, orderBy: { updatedAt: 'desc' } });
  }

  async getBySlug(slug: string) {
    const page = await prisma.cmsPage.findUnique({ where: { slug } });
    if (!page) throw new AppError(ErrorCode.NOT_FOUND, 'Page not found', 404);
    return page;
  }

  async create(input: UpsertCmsPageInput, adminUserId: string, adminRole: string) {
    const page = await prisma.cmsPage.create({
      data: { ...input, content: input.content as object, publishedAt: input.isPublished ? new Date() : null },
    });
    await adminAuditLogRepository.record({ adminUserId, actorRole: adminRole, action: 'admin.cms_page_created', entityType: 'CmsPage', entityId: page.id });
    return page;
  }

  async update(slug: string, input: Partial<UpsertCmsPageInput>, adminUserId: string, adminRole: string) {
    const existing = await this.getBySlug(slug);
    const page = await prisma.cmsPage.update({
      where: { slug },
      data: {
        ...input,
        content: input.content as object | undefined,
        publishedAt: input.isPublished && !existing.isPublished ? new Date() : existing.publishedAt,
      },
    });
    await adminAuditLogRepository.record({ adminUserId, actorRole: adminRole, action: 'admin.cms_page_updated', entityType: 'CmsPage', entityId: page.id });
    return page;
  }

  async remove(slug: string, adminUserId: string, adminRole: string): Promise<void> {
    const page = await this.getBySlug(slug);
    await prisma.cmsPage.delete({ where: { slug } });
    await adminAuditLogRepository.record({ adminUserId, actorRole: adminRole, action: 'admin.cms_page_deleted', entityType: 'CmsPage', entityId: page.id });
  }
}

export const adminCmsService = new AdminCmsService();
