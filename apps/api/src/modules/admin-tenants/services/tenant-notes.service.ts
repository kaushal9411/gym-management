import { AppError, ForbiddenError, NotFoundError } from '../../../core/errors/app-error';
import { ErrorCode } from '../../../core/errors/error-codes';
import { prisma } from '../../../infrastructure/database/prisma';
import { adminAuditLogRepository } from '../../admin-audit/repositories/admin-audit-log.repository';
import { getAdminPermissions } from '../../admin-auth/middlewares/admin-authorize.middleware';
import { withAdminPlane } from '../repositories/tenant-detail.db';

interface AdminActor {
  sub: string;
  role: string;
  permVer: number;
}

async function assertTenantExists(tenantId: string): Promise<void> {
  const t = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, deletedAt: true },
  });
  if (!t || t.deletedAt) throw new NotFoundError('Tenant not found');
}

/**
 * Tags for many tenants at once (the tenants LIST uses this for the tag column / tag filter). Tenants without tags are
 * simply absent from the map. One query, admin-plane RLS aware.
 */
export async function getTenantTagsMap(tenantIds: string[]): Promise<Map<string, string[]>> {
  if (tenantIds.length === 0) return new Map();
  const rows = await withAdminPlane((tx) =>
    tx.tenantAdminTags.findMany({
      where: { tenantId: { in: tenantIds } },
      select: { tenantId: true, tags: true },
    }),
  );
  return new Map(rows.filter((r) => r.tags.length > 0).map((r) => [r.tenantId, r.tags]));
}

/** Tenant ids carrying ALL of the given tags (for list filtering). */
export async function findTenantIdsByTags(tags: string[]): Promise<string[]> {
  if (tags.length === 0) return [];
  const rows = await withAdminPlane((tx) =>
    tx.tenantAdminTags.findMany({
      where: { tags: { hasEvery: tags } },
      select: { tenantId: true },
    }),
  );
  return rows.map((r) => r.tenantId);
}

export class TenantNotesService {
  async listNotes(tenantId: string, admin: AdminActor) {
    await assertTenantExists(tenantId);
    const canManage = (await getAdminPermissions(admin)).includes('admins:manage');
    const notes = await withAdminPlane((tx) =>
      tx.tenantAdminNote.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        take: 200,
      }),
    );
    return notes.map((n) => ({
      id: n.id,
      body: n.body,
      authorId: n.authorAdminId,
      authorName: n.authorName,
      createdAt: n.createdAt,
      canDelete: canManage || n.authorAdminId === admin.sub,
    }));
  }

  async addNote(tenantId: string, body: string, admin: AdminActor) {
    await assertTenantExists(tenantId);
    const author = await prisma.adminUser.findUnique({
      where: { id: admin.sub },
      select: { name: true },
    });
    const note = await withAdminPlane((tx) =>
      tx.tenantAdminNote.create({
        data: { tenantId, authorAdminId: admin.sub, authorName: author?.name ?? 'Admin', body },
      }),
    );
    await adminAuditLogRepository.record({
      adminUserId: admin.sub,
      actorRole: admin.role,
      action: 'admin.tenant_note_added',
      entityType: 'Tenant',
      entityId: tenantId,
      after: { noteId: note.id, preview: body.slice(0, 120) },
    });
    return {
      id: note.id,
      body: note.body,
      authorId: note.authorAdminId,
      authorName: note.authorName,
      createdAt: note.createdAt,
      canDelete: true,
    };
  }

  async deleteNote(tenantId: string, noteId: string, admin: AdminActor): Promise<void> {
    const note = await withAdminPlane((tx) =>
      tx.tenantAdminNote.findFirst({ where: { id: noteId, tenantId } }),
    );
    if (!note) throw new NotFoundError('Note not found');
    const canManage = (await getAdminPermissions(admin)).includes('admins:manage');
    if (note.authorAdminId !== admin.sub && !canManage) {
      throw new ForbiddenError('Only the note author or an admin manager can delete this note.');
    }
    await withAdminPlane((tx) => tx.tenantAdminNote.delete({ where: { id: noteId } }));
    await adminAuditLogRepository.record({
      adminUserId: admin.sub,
      actorRole: admin.role,
      action: 'admin.tenant_note_deleted',
      entityType: 'Tenant',
      entityId: tenantId,
      before: { noteId, authorName: note.authorName, preview: note.body.slice(0, 120) },
    });
  }

  async getTags(tenantId: string): Promise<{ tags: string[] }> {
    await assertTenantExists(tenantId);
    const row = await withAdminPlane((tx) =>
      tx.tenantAdminTags.findUnique({ where: { tenantId } }),
    );
    return { tags: row?.tags ?? [] };
  }

  async setTags(tenantId: string, tags: string[], admin: AdminActor): Promise<{ tags: string[] }> {
    await assertTenantExists(tenantId);
    if (tags.length > 10)
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'A tenant can have at most 10 tags', 422);
    const before = await this.getTags(tenantId);
    await withAdminPlane((tx) =>
      tx.tenantAdminTags.upsert({
        where: { tenantId },
        create: { tenantId, tags },
        update: { tags },
      }),
    );
    await adminAuditLogRepository.record({
      adminUserId: admin.sub,
      actorRole: admin.role,
      action: 'admin.tenant_tags_updated',
      entityType: 'Tenant',
      entityId: tenantId,
      before: { tags: before.tags },
      after: { tags },
    });
    return { tags };
  }
}

export const tenantNotesService = new TenantNotesService();
