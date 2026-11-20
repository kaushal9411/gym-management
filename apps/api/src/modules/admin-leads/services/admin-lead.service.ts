import type { PlatformLeadStatus } from '@prisma/client';

import { AppError } from '../../../core/errors/app-error';
import { ErrorCode } from '../../../core/errors/error-codes';
import { adminAuditLogRepository } from '../../admin-audit/repositories/admin-audit-log.repository';
import { adminLeadRepository } from '../repositories/admin-lead.repository';
import type { ListLeadsQuery, UpdateLeadInput } from '../validators/admin-lead.validators';
import { LEAD_STATUSES } from '../validators/admin-lead.validators';

export interface LeadStats {
  total: number;
  byStatus: Record<PlatformLeadStatus, number>;
}

/** Fills every status with 0 so the UI never has to guess a missing key. */
export function toLeadStats(rows: Array<{ status: PlatformLeadStatus; count: number }>): LeadStats {
  const byStatus = Object.fromEntries(LEAD_STATUSES.map((s) => [s, 0])) as Record<PlatformLeadStatus, number>;
  for (const r of rows) byStatus[r.status] = r.count;
  return { total: Object.values(byStatus).reduce((a, b) => a + b, 0), byStatus };
}

export class AdminLeadService {
  async list(query: ListLeadsQuery) {
    const skip = (query.page - 1) * query.limit;
    const [{ total, items }, stats] = await Promise.all([
      adminLeadRepository.list({ status: query.status, topic: query.topic, search: query.search, skip, take: query.limit }),
      adminLeadRepository.countByStatus(),
    ]);
    return { items, page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit), stats: toLeadStats(stats) };
  }

  async getById(id: string) {
    const lead = await adminLeadRepository.findById(id);
    if (!lead) throw new AppError(ErrorCode.NOT_FOUND, 'Lead not found', 404);
    return lead;
  }

  async update(id: string, input: UpdateLeadInput, actorAdminId: string, actorRole: string) {
    const existing = await this.getById(id);
    const data: { status?: PlatformLeadStatus; notes?: string | null; contactedAt?: Date } = {};
    if (input.status !== undefined) {
      data.status = input.status;
      // First time anyone moves it past NEW, remember when the team got to it.
      if (input.status !== 'NEW' && !existing.contactedAt) data.contactedAt = new Date();
    }
    if (input.notes !== undefined) data.notes = input.notes && input.notes.length > 0 ? input.notes : null;

    const updated = await adminLeadRepository.update(id, data);
    await adminAuditLogRepository.record({
      adminUserId: actorAdminId,
      actorRole,
      action: 'admin.lead_updated',
      entityType: 'PlatformLead',
      entityId: id,
      // Field names and the new status only: never the contact details or the notes text.
      after: { ...(input.status !== undefined ? { status: input.status } : {}), ...(input.notes !== undefined ? { notesChanged: true } : {}) },
    });
    return updated;
  }

  async remove(id: string, actorAdminId: string, actorRole: string): Promise<void> {
    await this.getById(id);
    await adminLeadRepository.delete(id);
    await adminAuditLogRepository.record({ adminUserId: actorAdminId, actorRole, action: 'admin.lead_deleted', entityType: 'PlatformLead', entityId: id });
  }
}

export const adminLeadService = new AdminLeadService();
