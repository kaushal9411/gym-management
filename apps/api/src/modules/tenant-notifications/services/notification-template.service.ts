import type { NotificationTemplateType, TenantNotificationChannel } from '@prisma/client';

import { getTenantScopedClient } from '../../../infrastructure/database/tenant-scoped-client';
import { DEFAULT_TEMPLATES, type DefaultTemplate } from '../constants/default-templates';
import { NotificationTemplateRepository } from '../repositories/notification-template.repository';

export interface EffectiveTemplateDto {
  type: NotificationTemplateType;
  label: string;
  description: string;
  channels: TenantNotificationChannel[];
  titleTemplate: string;
  bodyTemplate: string;
  isActive: boolean;
  isCustomized: boolean;
}

function toEffective(def: DefaultTemplate, override: { channels: TenantNotificationChannel[]; titleTemplate: string; bodyTemplate: string; isActive: boolean } | null): EffectiveTemplateDto {
  return {
    type: def.type,
    label: def.label,
    description: def.description,
    channels: override?.channels ?? def.channels,
    titleTemplate: override?.titleTemplate ?? def.titleTemplate,
    bodyTemplate: override?.bodyTemplate ?? def.bodyTemplate,
    isActive: override?.isActive ?? true,
    isCustomized: override !== null,
  };
}

export class NotificationTemplateService {
  async list(tenantId: string): Promise<EffectiveTemplateDto[]> {
    const repository = new NotificationTemplateRepository(getTenantScopedClient(tenantId));
    const overrides = await repository.listOverrides(tenantId);
    const byType = new Map(overrides.map((o) => [o.type, o]));
    return Object.values(DEFAULT_TEMPLATES).map((def) => toEffective(def, byType.get(def.type) ?? null));
  }

  async update(
    tenantId: string,
    type: NotificationTemplateType,
    input: { channels: TenantNotificationChannel[]; titleTemplate: string; bodyTemplate: string; isActive: boolean },
  ): Promise<EffectiveTemplateDto> {
    const repository = new NotificationTemplateRepository(getTenantScopedClient(tenantId));
    const saved = await repository.upsert(tenantId, type, input);
    return toEffective(DEFAULT_TEMPLATES[type], saved);
  }

  /** Used by the trigger service — resolves a tenant's override or the hardcoded default, skipping entirely if disabled. */
  async getEffective(tenantId: string, type: NotificationTemplateType): Promise<EffectiveTemplateDto> {
    const repository = new NotificationTemplateRepository(getTenantScopedClient(tenantId));
    const override = await repository.findOverride(tenantId, type);
    return toEffective(DEFAULT_TEMPLATES[type], override);
  }
}

export const notificationTemplateService = new NotificationTemplateService();
