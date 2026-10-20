import type { AutomationRuleKey } from '@prisma/client';

import { logger } from '../../../core/logging/logger';
import { getTenantScopedClient } from '../../../infrastructure/database/tenant-scoped-client';
import { loadEmailBranding } from '../../../infrastructure/mail/branding';
import type { EmailBranding } from '../../../infrastructure/mail/templates/base-layout';
import { renderTemplate } from '../../tenant-notifications/constants/default-templates';
import { notificationTemplateService, type EffectiveTemplateDto } from '../../tenant-notifications/services/notification-template.service';
import { tenantNotificationService } from '../../tenant-notifications/services/tenant-notification.service';
import { AUTOMATION_RULES, mergeRule, type EffectiveRule } from '../constants/automation-rules';
import { AudienceRepository } from '../repositories/audience.repository';
import { AutomationRepository } from '../repositories/automation.repository';
import { buildMemberVars } from '../utils/message-vars.util';
import { renderPlaceholders } from '../utils/placeholder.util';
import { isOptedOut } from '../utils/recipient-plan.util';

import { sendToMember } from './channel-sender.service';

export interface DispatchParams {
  rule: EffectiveRule;
  memberId: string;
  /** Membership / invoice / payment / class-session / class id (or the member id for member-level rules). */
  subjectId: string;
  /** Which timing fired ("7", "24h", "y2026", ...). Part of the dedupe key. */
  offsetKey: string;
  /** Rule-specific placeholder values; these win over the member-derived ones (e.g. the exact membership's plan / end date). */
  vars?: Record<string, string>;
  /** Text used when neither the rule nor a customised legacy template overrides it. */
  fallbackText?: { title: string; body: string };
  /** Replaces the generic title/body email (invoice reminders keep their detailed layout). */
  richEmail?: (branding: EmailBranding) => { subject: string; html: string };
  /** Also drop a note in the staff Notification Center (legacy behaviour of the template-linked rules). */
  staffFeed?: boolean;
  /** Override the rule's own kind: promotional sends honour a member's opt-out, transactional ones never do. */
  respectOptOut?: boolean;
  pushData?: Record<string, string>;
}

export type DispatchOutcome = 'SENT' | 'DEDUPED' | 'SKIPPED';

/** The legacy NotificationTemplate behind a rule, when the gym customised it. */
interface LegacyText {
  template: EffectiveTemplateDto;
}

/**
 * One tenant's automation runtime: effective rule config (saved row over documented defaults), the dedupe ledger
 * (a rule never double-sends the same member + subject + timing) and the per-channel send through the shared gate.
 * Own-account reminders (kind TRANSACTIONAL) ignore promotional opt-out; promotional rules respect it.
 */
export class AutomationEngine {
  private rules: Map<AutomationRuleKey, EffectiveRule> | null = null;
  private readonly legacy = new Map<string, LegacyText>();
  private branding: EmailBranding | null = null;
  private readonly repo: AutomationRepository;
  private readonly audience: AudienceRepository;

  constructor(readonly tenantId: string) {
    const db = getTenantScopedClient(tenantId);
    this.repo = new AutomationRepository(db);
    this.audience = new AudienceRepository(db);
  }

  /** Effective rule, with the "legacy template switched off" respected while no explicit rule row exists. */
  async rule(key: AutomationRuleKey): Promise<EffectiveRule> {
    if (!this.rules) {
      const rows = await this.repo.listRules(this.tenantId);
      this.rules = new Map(
        (Object.keys(AUTOMATION_RULES) as AutomationRuleKey[]).map((k) => [k, mergeRule(AUTOMATION_RULES[k], rows.find((r) => r.key === k) ?? null)]),
      );
    }
    const rule = this.rules.get(key)!;
    if (rule.isDefault && rule.enabled && rule.def.legacyTemplate) {
      const legacy = await this.legacyTemplate(rule.def.legacyTemplate);
      if (!legacy.template.isActive) return { ...rule, enabled: false };
    }
    return rule;
  }

  private async legacyTemplate(type: NonNullable<EffectiveRule['def']['legacyTemplate']>): Promise<LegacyText> {
    const cached = this.legacy.get(type);
    if (cached) return cached;
    const template = await notificationTemplateService.getEffective(this.tenantId, type);
    const value = { template };
    this.legacy.set(type, value);
    return value;
  }

  /** Title / body for a rule: the saved override, else the gym's customised legacy template, else the built-in default. */
  async textFor(rule: EffectiveRule, fallback?: { title: string; body: string }): Promise<{ title: string; body: string }> {
    let title = rule.titleOverride;
    let body = rule.bodyOverride;
    if ((title === null || body === null) && rule.def.legacyTemplate) {
      const { template } = await this.legacyTemplate(rule.def.legacyTemplate);
      if (template.isCustomized) {
        title = title ?? template.titleTemplate;
        body = body ?? template.bodyTemplate;
      }
    }
    return { title: title ?? fallback?.title ?? rule.def.defaultTitle, body: body ?? fallback?.body ?? rule.def.defaultBody };
  }

  async gymBranding(): Promise<EmailBranding> {
    this.branding ??= await loadEmailBranding(this.tenantId);
    return this.branding;
  }

  /** Records that a timing has already been handled elsewhere (e.g. by the pre-Communications Redis dedupe) without sending anything. */
  async markHandled(rule: EffectiveRule, memberId: string, subjectId: string, offsetKey: string): Promise<void> {
    await this.repo.claimDispatch(this.tenantId, { ruleKey: rule.key, memberId, subjectId, offsetKey });
  }

  /** Claim -> render -> send on each of the rule's channels. Never throws for a send problem: skips are logged in the Message Log. */
  async dispatch(params: DispatchParams): Promise<DispatchOutcome> {
    const { rule } = params;
    const claim = await this.repo.claimDispatch(this.tenantId, { ruleKey: rule.key, memberId: params.memberId, subjectId: params.subjectId, offsetKey: params.offsetKey });
    if (!claim) return 'DEDUPED';

    try {
      const profiles = await this.audience.loadProfiles(this.tenantId, [params.memberId]);
      const profile = profiles.get(params.memberId);
      if (!profile || !profile.messageable) return 'SKIPPED';

      const branding = await this.gymBranding();
      const vars = { ...buildMemberVars(profile, branding.tenantName), ...(params.vars ?? {}) };
      const text = await this.textFor(rule, params.fallbackText);
      const title = renderPlaceholders(text.title, vars);
      const body = renderPlaceholders(text.body, vars);
      const respectOptOut = params.respectOptOut ?? rule.def.kind === 'PROMOTIONAL';
      const inboxViaPush = !rule.channels.includes('IN_APP');

      let sentAny = false;
      for (const channel of rule.channels) {
        if (respectOptOut && isOptedOut(profile, channel)) continue;
        try {
          // eslint-disable-next-line no-await-in-loop -- a handful of channels per member, sequential keeps the gate's counter simple
          const result = await sendToMember({
            tenantId: this.tenantId,
            channel,
            member: profile,
            title,
            body,
            category: rule.def.category,
            inboxViaPush,
            branding,
            richEmail: params.richEmail,
            pushData: params.pushData,
          });
          if (result.outcome !== 'SKIPPED') sentAny = true;
        } catch (error) {
          logger.error('Automation send failed', { tenantId: this.tenantId, rule: rule.key, channel, error: error instanceof Error ? error.message : String(error) });
        }
      }

      if (params.staffFeed && rule.def.legacyTemplate) await this.staffFeed(rule, vars);
      return sentAny ? 'SENT' : 'SKIPPED';
    } catch (error) {
      // Nothing was handed to a channel before the failure: give the claim back so the next run retries.
      await this.repo.releaseDispatch(claim.id).catch(() => undefined);
      throw error;
    }
  }

  /** Same staff Notification Center entry the pre-Communications reminders produced (rendered with the legacy template). */
  private async staffFeed(rule: EffectiveRule, vars: Record<string, string>): Promise<void> {
    const { template } = await this.legacyTemplate(rule.def.legacyTemplate!);
    if (!template.isActive || !template.channels.includes('IN_APP')) return;
    const withStatus = { ...vars, expiryStatus: vars.expiryStatus ?? (rule.key === 'MEMBERSHIP_EXPIRED' ? 'has expired' : `expires in ${vars.daysLeft ?? '?'} day(s)`) };
    await tenantNotificationService.notifyTenant(this.tenantId, rule.def.category, renderTemplate(template.titleTemplate, withStatus), renderTemplate(template.bodyTemplate, withStatus));
  }
}

/** One engine per tenant for the duration of a scheduler run (rules / templates / branding are loaded once). */
export class EngineCache {
  private readonly engines = new Map<string, AutomationEngine>();
  for(tenantId: string): AutomationEngine {
    let engine = this.engines.get(tenantId);
    if (!engine) {
      engine = new AutomationEngine(tenantId);
      this.engines.set(tenantId, engine);
    }
    return engine;
  }
}

