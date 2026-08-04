import { prisma } from '../../../infrastructure/database/prisma';

export interface PlatformAiSettingsUpdate {
  provider?: string | null;
  model?: string | null;
  apiKeyEncrypted?: string | null;
  baseUrl?: string | null;
  temperature?: number | null;
  maxTokens?: number | null;
  updatedBy?: string;
}

/** Application-enforced singleton — always operates on the first (and only) row, creating it on first write. */
export class PlatformAiSettingsRepository {
  async find() {
    return prisma.platformAiSettings.findFirst();
  }

  async upsert(data: PlatformAiSettingsUpdate) {
    const existing = await this.find();
    if (existing) {
      return prisma.platformAiSettings.update({ where: { id: existing.id }, data });
    }
    return prisma.platformAiSettings.create({ data });
  }

  async clear() {
    const existing = await this.find();
    if (existing) await prisma.platformAiSettings.delete({ where: { id: existing.id } });
  }
}

export const platformAiSettingsRepository = new PlatformAiSettingsRepository();
