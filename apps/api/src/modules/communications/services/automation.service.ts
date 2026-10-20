import type { AutomationRuleKey, TenantNotificationChannel } from '@prisma/client';

import { ValidationError } from '../../../core/errors/app-error';
import { getTenantScopedClient, type TenantScopedPrisma } from '../../../infrastructure/database/tenant-scoped-client';
import { AuditLogRepository } from '../../authentication/repositories/audit-log.repository';
import type { IamActor } from '../../authentication/utils/actor.util';
import { notificationTemplateService } from '../../tenant-notifications/services/notification-template.service';
import {
  ALLOWED_AUTOMATION_CHANNELS,
  AUTOMATION_KEYS,
  AUTOMATION_RULES,
  allowedPlaceholdersFor,
  mergeRule,
  type EffectiveRule,
} from '../constants/automation-rules';
import { QUIET_END_HOUR, QUIET_HOLD_CHANNELS, QUIET_START_HOUR } from '../constants/limits';
import { AutomationRepository } from '../repositories/automation.repository';
import { automationIssues, type PutAutomationInput } from '../validators/communications.validators';

import { getChannelStates } from './channel-state.service';
import { TestSendService } from './test-send.service';

const WEEK_MS = 7 * 86_400_000;
const pad = (n: number): string => String(n).padStart(2, '0');

export const QUIET_HOURS_VIEW = {
  start: `${pad(QUIET_START_HOUR)}:00`,
  end: `${pad(QUIET_END_HOUR)}:00`,
  channels: [...QUIET_HOLD_CHANNELS],
  timezoneBasis: 'member branch',
};

/** Staff-facing automation rule configuration (list / save / test). The runtime lives in `automation-engine.service.ts`. */
export class AutomationService {
  private readonly db: TenantScopedPrisma;
  private readonly repo: AutomationRepository;
  private readonly auditLog: AuditLogRepository;

  constructor(private readonly tenantId: string) {
    this.db = getTenantScopedClient(tenantId);
    this.repo = new AutomationRepository(this.db);
    this.auditLog = new AuditLogRepository(this.db);
  }

  async list() {
    const [rows, sent, lastSent, states] = await Promise.all([
      this.repo.listRules(this.tenantId),
      this.repo.sentSince(this.tenantId, new Date(Date.now() - WEEK_MS)),
      this.repo.lastSent(this.tenantId),
      getChannelStates(this.tenantId),
    ]);
    const items = [];
    for (const key of AUTOMATION_KEYS) {
      const rule = mergeRule(AUTOMATION_RULES[key], rows.find((r) => r.key === key) ?? null);
      // eslint-disable-next-line no-await-in-loop -- nine rules, template lookups are single-row reads
      if (await this.templateOff(rule)) continue;
      // eslint-disable-next-line no-await-in-loop -- nine rules, template lookups are single-row reads
      items.push(await this.toItem(rule, sent.find((s) => s.key === key), lastSent.get(key) ?? null, states));
    }
    return { quietHours: QUIET_HOURS_VIEW, items };
  }

  async enabledSummary(): Promise<{ total: number; enabled: number }> {
    const rows = await this.repo.listRules(this.tenantId);
    let enabled = 0;
    let total = 0;
    for (const key of AUTOMATION_KEYS) {
      const rule = mergeRule(AUTOMATION_RULES[key], rows.find((r) => r.key === key) ?? null);
      // eslint-disable-next-line no-await-in-loop -- nine rules
      if (await this.templateOff(rule)) continue;
      total += 1;
      if (rule.enabled) enabled += 1;
    }
    return { total, enabled };
  }

  async put(key: AutomationRuleKey, input: PutAutomationInput, actor: IamActor) {
    const def = AUTOMATION_RULES[key];
    const issues = automationIssues(def, input);
    if (issues.length) {
      throw new ValidationError('Request validation failed', { fields: issues.map((i) => ({ field: i.path, message: i.message })) });
    }
    const existing = await this.repo.findRule(this.tenantId, key);
    const offsets = def.editable ? [...new Set(input.offsets ?? [])].sort((a, b) => a - b) : [...def.defaultOffsets];
    await this.repo.upsertRule(this.tenantId, key, {
      enabled: input.enabled,
      offsets,
      channels: input.channels as TenantNotificationChannel[],
      titleTemplate: input.title === undefined ? (existing?.titleTemplate ?? null) : input.title,
      bodyTemplate: input.body === undefined ? (existing?.bodyTemplate ?? null) : input.body,
      updatedBy: actor.userId,
    });
    await this.auditLog.record({
      tenantId: this.tenantId,
      actorUserId: actor.userId,
      actorRole: actor.role,
      action: 'communications.automation_updated',
      entityType: 'notification_automation_rule',
      entityId: key,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
      after: { key, enabled: input.enabled, offsets, channels: input.channels, customTitle: !!input.title, customBody: !!input.body },
    });
    const { items } = await this.list();
    return items.find((i) => i.key === key)!;
  }

  /** Sends the rule's current message (sample data) to the acting staff member only. */
  async test(key: AutomationRuleKey, channels: string[] | undefined, actor: IamActor) {
    const rule = mergeRule(AUTOMATION_RULES[key], await this.repo.findRule(this.tenantId, key));
    const text = await this.effectiveText(rule);
    const wanted = (channels ?? rule.channels).filter((c) => c !== 'IN_APP');
    if (wanted.length === 0) {
      throw new ValidationError('Nothing to test', { fields: [{ field: 'channels', message: 'Choose a channel other than In-app to test (the member inbox cannot be tested from staff accounts).' }] });
    }
    return new TestSendService(this.tenantId).send({ title: text.title, body: text.body, channels: wanted }, actor);
  }

  /** True while the gym has the rule's linked Notification template switched off: the rule is hidden here and never sends (same rule the runtime applies), saved row or not. */
  private async templateOff(rule: EffectiveRule): Promise<boolean> {
    if (!rule.def.legacyTemplate) return false;
    return !(await notificationTemplateService.getEffective(this.tenantId, rule.def.legacyTemplate)).isActive;
  }

  private async effectiveText(rule: EffectiveRule): Promise<{ title: string; body: string }> {
    let title = rule.titleOverride;
    let body = rule.bodyOverride;
    if ((title === null || body === null) && rule.def.legacyTemplate) {
      const template = await notificationTemplateService.getEffective(this.tenantId, rule.def.legacyTemplate);
      if (template.isCustomized) {
        title = title ?? template.titleTemplate;
        body = body ?? template.bodyTemplate;
      }
    }
    return { title: title ?? rule.def.defaultTitle, body: body ?? rule.def.defaultBody };
  }

  private async toItem(
    rule: EffectiveRule,
    sent: { count: number; lastSentAt: Date | null } | undefined,
    lastSentAt: Date | null,
    states: Awaited<ReturnType<typeof getChannelStates>>,
  ) {
    const def = rule.def;
    const defaults = await this.effectiveText({ ...rule, titleOverride: null, bodyOverride: null });
    return {
      key: rule.key,
      label: def.label,
      description: def.description,
      kind: def.kind,
      timing: { unit: def.unit, editable: def.editable, min: def.min, max: def.max, maxCount: def.maxCount, defaultOffsets: def.defaultOffsets },
      enabled: rule.enabled,
      isDefault: rule.isDefault,
      offsets: rule.offsets,
      channels: rule.channels,
      allowedChannels: [...ALLOWED_AUTOMATION_CHANNELS],
      unavailableChannels: rule.channels.filter((c) => !states[c].enabled).map((c) => ({ channel: c, reason: states[c].disabledReason })),
      title: rule.titleOverride,
      body: rule.bodyOverride,
      defaultTitle: defaults.title,
      defaultBody: defaults.body,
      allowedPlaceholders: allowedPlaceholdersFor(def),
      sentLast7Days: sent?.count ?? 0,
      lastSentAt: lastSentAt ? lastSentAt.toISOString() : null,
      updatedAt: rule.updatedAt ? rule.updatedAt.toISOString() : null,
    };
  }
}
