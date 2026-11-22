import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * KNOWN GAPS in the platform feature-flag kill switch (see docs/FEATURE-FLAGS-AUDIT.md).
 *
 * The HTTP gate (`requireModuleEnabled`) only protects the staff routers. Code
 * that touches a flag's data WITHOUT going through those routers — scheduler
 * sweeps, the AI assistant's context/actions, the dashboard aggregates — never
 * consults `ResolvedTenant.featureFlags` / `TenantModule` at all, so a disabled
 * module keeps running in the background.
 *
 * Each case asserts the DESIRED behaviour ("this file consults the tenant's
 * module flags"), written with `it.fails` so it is reported as a documented gap
 * today and turns into a loud failure (remove `.fails`) the day it is fixed.
 * These are static source checks (a cheap tripwire that the file still consults
 * the flags). Gaps 2 (scheduler/automations) and 3 (AI assistant) are FIXED and
 * these cases are real assertions now; the BEHAVIOUR is covered by hermetic specs:
 * `scheduler/handlers/feature-flags.spec.ts`,
 * `communications/services/automation-sweeps.flags.spec.ts`,
 * `ai-assistant/feature-flags.spec.ts` and `tenants/utils/module-enabled.util.spec.ts`.
 * The dashboard-aggregates case stays `it.fails` until that gap is fixed.
 */

const SRC = join(__dirname, '..', '..');
const read = (rel: string): string => readFileSync(join(SRC, rel), 'utf8');

/** Anything that proves the file looks at a tenant's enabled modules. */
const CONSULTS_MODULE_FLAGS = /featureFlags|requireModuleEnabled|tenantModule|isModuleEnabled|moduleEnabled|moduleGate|getEnabledModules|module-enabled.util/;

const consultsFlags = (rel: string): boolean => CONSULTS_MODULE_FLAGS.test(read(rel));

describe('FIXED (gap 2): scheduler / automation jobs skip a tenant whose module is disabled', () => {
  it('live_classes — class-session-generation skips gyms with live_classes off', () => {
    expect(consultsFlags('modules/scheduler/handlers/class-session.handlers.ts')).toBe(true);
  });

  it('live_classes — class-reminders sweep skips gyms with live_classes off', () => {
    expect(consultsFlags('modules/communications/services/automation-sweeps.service.ts')).toBe(true);
  });

  it('payments — invoice-generation skips gyms with payments off', () => {
    expect(consultsFlags('modules/scheduler/handlers/payment.handlers.ts')).toBe(true);
  });

  it('payments — invoice-due / overdue / failed-payment reminders skip gyms with payments off (same automation-sweeps file)', () => {
    // sweepInvoiceDueSoon / sweepPaymentOverdue / sweepPaymentFailed live in automation-sweeps.service.ts
    expect(consultsFlags('modules/communications/services/automation-sweeps.service.ts')).toBe(true);
  });

  it('reports — tenant-scheduled-reports-dispatch skips gyms with reports off', () => {
    expect(consultsFlags('modules/scheduler/handlers/report.handlers.ts')).toBe(true);
  });

  it('notifications — send-scheduled-announcements skips gyms with notifications off', () => {
    expect(consultsFlags('modules/scheduler/handlers/notification.handlers.ts')).toBe(true);
  });

  it('notifications — campaign start/batch jobs skip gyms with notifications off, even once enqueued', () => {
    expect(consultsFlags('modules/communications/services/campaign-dispatch.service.ts')).toBe(true);
  });
});

describe('FIXED (gap 3): AI assistant only reads/acts on modules the tenant has enabled', () => {
  it('ai-context only builds attendance/workout/diet/finance/reports/notifications snapshot sections for enabled modules', () => {
    expect(consultsFlags('modules/ai-assistant/services/ai-context.service.ts')).toBe(true);
  });

  it('ai-actions refuses assign_workout / assign_diet / generate_report / send_notification for a disabled module', () => {
    expect(consultsFlags('modules/ai-assistant/services/ai-actions.service.ts')).toBe(true);
  });
});

// FIXED (behaviour covered in feature-flags.portal-summary.spec.ts): dashboard KPIs / finance summary honour per-module flags.
describe('FIXED: dashboard aggregates honour the per-module flags', () => {
  it('dashboard KPIs + recent activities consult the tenant flags', () => {
    expect(consultsFlags('modules/reports/services/dashboard.service.ts')).toBe(true);
  });

  it('finance summary consults the tenant flags', () => {
    expect(consultsFlags('modules/finance/services/finance-dashboard.service.ts')).toBe(true);
  });
});

describe('sanity — the checker itself detects flag-aware code', () => {
  it('the gate middleware is recognised (so a future fix is detected)', () => {
    expect(consultsFlags('modules/tenants/middleware/require-module-enabled.middleware.ts')).toBe(true);
  });
});
