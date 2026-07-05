import { AppError } from '../../../core/errors/app-error';
import { ErrorCode } from '../../../core/errors/error-codes';
import { prisma } from '../../../infrastructure/database/prisma';
import { adminAuditLogRepository } from '../../admin-audit/repositories/admin-audit-log.repository';

export class AdminTemplateService {
  async listEmailTemplates() {
    return prisma.emailTemplate.findMany({ orderBy: { key: 'asc' } });
  }

  async upsertEmailTemplate(
    key: string,
    input: { subject: string; bodyHtml: string; variables: string[]; isActive: boolean },
    adminUserId: string,
    adminRole: string,
  ) {
    const template = await prisma.emailTemplate.upsert({
      where: { key },
      create: { key, ...input },
      update: input,
    });
    await adminAuditLogRepository.record({ adminUserId, actorRole: adminRole, action: 'admin.email_template_updated', entityType: 'EmailTemplate', entityId: key });
    return template;
  }

  async listSmsTemplates() {
    return prisma.smsTemplate.findMany({ orderBy: { key: 'asc' } });
  }

  async upsertSmsTemplate(key: string, input: { body: string; variables: string[]; isActive: boolean }, adminUserId: string, adminRole: string) {
    const template = await prisma.smsTemplate.upsert({ where: { key }, create: { key, ...input }, update: input });
    await adminAuditLogRepository.record({ adminUserId, actorRole: adminRole, action: 'admin.sms_template_updated', entityType: 'SmsTemplate', entityId: key });
    return template;
  }

  async removeEmailTemplate(key: string, adminUserId: string, adminRole: string): Promise<void> {
    const existing = await prisma.emailTemplate.findUnique({ where: { key } });
    if (!existing) throw new AppError(ErrorCode.NOT_FOUND, 'Template not found', 404);
    await prisma.emailTemplate.delete({ where: { key } });
    await adminAuditLogRepository.record({ adminUserId, actorRole: adminRole, action: 'admin.email_template_deleted', entityType: 'EmailTemplate', entityId: key });
  }

  async removeSmsTemplate(key: string, adminUserId: string, adminRole: string): Promise<void> {
    const existing = await prisma.smsTemplate.findUnique({ where: { key } });
    if (!existing) throw new AppError(ErrorCode.NOT_FOUND, 'Template not found', 404);
    await prisma.smsTemplate.delete({ where: { key } });
    await adminAuditLogRepository.record({ adminUserId, actorRole: adminRole, action: 'admin.sms_template_deleted', entityType: 'SmsTemplate', entityId: key });
  }
}

export const adminTemplateService = new AdminTemplateService();
