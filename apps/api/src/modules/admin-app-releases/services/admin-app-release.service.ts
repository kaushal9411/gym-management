import type { AppRelease } from '@prisma/client';

import { AppError } from '../../../core/errors/app-error';
import { ErrorCode } from '../../../core/errors/error-codes';
import { uploadLargeFile } from '../../../core/storage/storage.service';
import { prisma } from '../../../infrastructure/database/prisma';
import { adminAuditLogRepository } from '../../admin-audit/repositories/admin-audit-log.repository';
import type { AppReleaseDto, CreateAppReleaseInput } from '../dto/app-release.dto';

function toDto(row: AppRelease & { uploader: { id: string; name: string } | null }): AppReleaseDto {
  return {
    id: row.id,
    platform: row.platform,
    version: row.version,
    versionCode: row.versionCode,
    fileName: row.fileName,
    fileUrl: row.fileKey,
    fileSizeBytes: row.fileSize.toString(),
    releaseNotes: row.releaseNotes,
    isActive: row.isActive,
    uploadedBy: row.uploader ? { id: row.uploader.id, name: row.uploader.name } : null,
    createdAt: row.createdAt.toISOString(),
  };
}

const WITH_UPLOADER = { uploader: { select: { id: true, name: true } } } as const;

export class AdminAppReleaseService {
  async list(): Promise<AppReleaseDto[]> {
    const rows = await prisma.appRelease.findMany({
      orderBy: { createdAt: 'desc' },
      include: WITH_UPLOADER,
    });
    return rows.map(toDto);
  }

  async getActive(): Promise<AppReleaseDto | null> {
    const row = await prisma.appRelease.findFirst({
      where: { platform: 'ANDROID', isActive: true },
      include: WITH_UPLOADER,
    });
    return row ? toDto(row) : null;
  }

  async create(
    file: { path: string; originalname: string; mimetype: string; size: number },
    input: CreateAppReleaseInput,
    adminUserId: string,
    adminRole: string,
  ): Promise<AppReleaseDto> {
    const fileUrl = await uploadLargeFile(file.path, {
      keyPrefix: 'app-releases/android',
      fileName: file.originalname,
      contentType: 'application/vnd.android.package-archive',
    });

    // isActive defaults true for the very first release of a platform (an
    // upload nobody can download yet is a genuinely confusing empty state);
    // afterward it's opt-in via `activate`, so a routine upload doesn't
    // silently swap out what everyone's already downloading.
    const existingCount = await prisma.appRelease.count({ where: { platform: 'ANDROID' } });
    const activate = input.activate || existingCount === 0;

    const created = await prisma.$transaction(async (tx) => {
      if (activate) {
        await tx.appRelease.updateMany({ where: { platform: 'ANDROID', isActive: true }, data: { isActive: false } });
      }
      return tx.appRelease.create({
        data: {
          platform: 'ANDROID',
          version: input.version,
          versionCode: input.versionCode,
          fileName: file.originalname,
          fileKey: fileUrl,
          fileSize: BigInt(file.size),
          releaseNotes: input.releaseNotes,
          isActive: activate,
          uploadedBy: adminUserId,
        },
        include: WITH_UPLOADER,
      });
    });

    await adminAuditLogRepository.record({
      adminUserId,
      actorRole: adminRole,
      action: 'admin.app_release_uploaded',
      entityType: 'AppRelease',
      entityId: created.id,
    });
    return toDto(created);
  }

  async activate(id: string, adminUserId: string, adminRole: string): Promise<AppReleaseDto> {
    const release = await prisma.appRelease.findUnique({ where: { id } });
    if (!release) throw new AppError(ErrorCode.NOT_FOUND, 'Release not found', 404);

    const updated = await prisma.$transaction(async (tx) => {
      await tx.appRelease.updateMany({ where: { platform: release.platform, isActive: true }, data: { isActive: false } });
      return tx.appRelease.update({ where: { id }, data: { isActive: true }, include: WITH_UPLOADER });
    });

    await adminAuditLogRepository.record({
      adminUserId,
      actorRole: adminRole,
      action: 'admin.app_release_activated',
      entityType: 'AppRelease',
      entityId: id,
    });
    return toDto(updated);
  }

  async delete(id: string, adminUserId: string, adminRole: string): Promise<void> {
    const release = await prisma.appRelease.findUnique({ where: { id } });
    if (!release) throw new AppError(ErrorCode.NOT_FOUND, 'Release not found', 404);
    if (release.isActive) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'This is the active release — activate a different one first, or every user loses their download link.', 422);
    }
    await prisma.appRelease.delete({ where: { id } });
    await adminAuditLogRepository.record({
      adminUserId,
      actorRole: adminRole,
      action: 'admin.app_release_deleted',
      entityType: 'AppRelease',
      entityId: id,
    });
  }
}

export const adminAppReleaseService = new AdminAppReleaseService();
