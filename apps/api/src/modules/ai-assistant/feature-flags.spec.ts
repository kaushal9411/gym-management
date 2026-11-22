import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Feature flags x AI assistant. Hermetic: the tenant flag read, the tenant-scoped DB, the permission engine and the domain
 * services behind each action are mocked.
 *  - context: a snapshot section is only injected when the tenant has its module on (AND the user holds the permission);
 *  - actions: an action of a disabled module is refused with "<Feature> is disabled for this gym." (returned, never thrown,
 *    and nothing runs); the prompt's action list omits disabled actions; an unreadable flag fails open.
 */

const state = vi.hoisted(() => ({
  flags: [] as string[] | 'throw',
  calls: [] as string[],
  hasPermission: true,
}));

vi.mock('../../core/logging/logger', () => ({ logger: { warn: () => undefined, debug: () => undefined, info: () => undefined, error: () => undefined } }));
vi.mock('../tenants/service/tenant.service', () => ({
  tenantService: {
    resolveById: async (tenantId: string) => {
      if (state.flags === 'throw') throw new Error('redis down');
      return { id: tenantId, featureFlags: state.flags };
    },
  },
}));
vi.mock('../../infrastructure/database/tenant-scoped-client', () => {
  const count = (name: string) => async () => {
    state.calls.push(`db:${name}`);
    return 1;
  };
  const db = {
    member: { count: count('member') },
    staffProfile: { count: count('staff') },
    branch: { findMany: async () => [] },
    membership: { count: count('membership') },
    attendance: { count: count('attendance') },
    workoutPlan: { count: count('workoutPlan') },
    memberWorkoutPlan: { count: count('memberWorkoutPlan') },
    dietPlan: { count: count('dietPlan') },
    memberDietPlan: { count: count('memberDietPlan') },
    memberPayment: { aggregate: async () => ({ _sum: { finalAmount: 5 } }) },
    memberInvoice: { count: count('memberInvoice') },
    scheduledReport: { count: count('scheduledReport') },
    tenantNotification: { count: count('tenantNotification') },
    tenantSettings: { findUnique: async () => null },
  };
  return { getTenantScopedClient: () => db };
});
vi.mock('../permissions/services/permission-engine.service', () => ({
  permissionEngine: { hasPermission: async () => state.hasPermission, getEffectivePermissions: async () => [] },
}));
vi.mock('../members/services/member.service', () => ({
  MemberService: class {
    async create() {
      state.calls.push('create_member');
      return { id: 'm1', memberId: 'MEM-1' };
    }
    async assignMembership() {
      state.calls.push('assignMembership');
    }
    async renewMembership() {
      state.calls.push('renew_membership');
      return { firstName: 'A', lastName: 'B' };
    }
  },
}));
vi.mock('../workouts/services/workout-plan.service', () => ({
  WorkoutPlanService: class {
    async assign() {
      state.calls.push('assign_workout');
    }
  },
}));
vi.mock('../diet/services/diet-plan.service', () => ({
  DietPlanService: class {
    async assign() {
      state.calls.push('assign_diet');
    }
  },
}));
vi.mock('../reports/services/report-export.service', () => ({
  ReportExportService: class {
    async exportCsv() {
      state.calls.push('generate_report');
      return { filename: 'r.csv', content: 'a\n1' };
    }
  },
}));
vi.mock('../tenant-notifications/services/tenant-notification.service', () => ({
  tenantNotificationService: {
    notifyTenant: async () => {
      state.calls.push('send_notification');
    },
  },
}));

import type { IamActor } from '../authentication/utils/actor.util';

import { ACTION_MODULES, AI_ACTION_TYPES, availableActionTypes, type AiActionProposal } from './constants/action-types';
import { buildSystemPrompt } from './constants/system-prompt';
import { executeAiAction, executeAiActionDetailed } from './services/ai-actions.service';
import { buildTenantContext } from './services/ai-context.service';

const ALL_MODULES = ['ai_coach', 'notifications', 'support_tickets', 'expenses', 'income', 'payments', 'reports', 'attendance', 'diet_plans', 'live_classes', 'workout_plans'];
const ALL_PERMISSIONS = [
  'members:view', 'staff:view', 'branches:view', 'memberships:view', 'attendance:view', 'workouts:view',
  'diets:view', 'finance:view', 'reports:view', 'notifications:view', 'settings:read',
];
const actor = { userId: 'u1' } as unknown as IamActor;
const TENANT = 't1';

beforeEach(() => {
  state.flags = [...ALL_MODULES];
  state.calls = [];
  state.hasPermission = true;
});

describe('buildTenantContext', () => {
  it('with every module on, every permitted section is injected (unchanged behaviour)', async () => {
    const text = await buildTenantContext(TENANT, 'Gym', ALL_PERMISSIONS);
    for (const needle of ['Members:', 'Staff:', 'Branches', 'Memberships:', 'Attendance:', 'Workout:', 'Diet:', 'Finance:', 'Reports:', 'Notifications:', 'Settings:']) {
      expect(text).toContain(needle);
    }
  });

  it.each([
    ['attendance', 'Attendance:', 'db:attendance'],
    ['workout_plans', 'Workout:', 'db:workoutPlan'],
    ['diet_plans', 'Diet:', 'db:dietPlan'],
    ['payments', 'Finance:', 'db:memberInvoice'],
    ['reports', 'Reports:', 'db:scheduledReport'],
    ['notifications', 'Notifications:', 'db:tenantNotification'],
  ])('omits the %s snapshot (and never queries it) when that module is off, leaving the others', async (module, needle, query) => {
    state.flags = ALL_MODULES.filter((m) => m !== module);
    const text = await buildTenantContext(TENANT, 'Gym', ALL_PERMISSIONS);
    expect(text).not.toContain(needle);
    expect(state.calls).not.toContain(query);
    expect(text).toContain('Members:');
    expect(text).toContain('Settings:');
  });

  it('a section needs BOTH the permission and the module', async () => {
    state.flags = ALL_MODULES;
    const text = await buildTenantContext(TENANT, 'Gym', ['members:view']);
    expect(text).toContain('Members:');
    expect(text).not.toContain('Attendance:');
  });

  it('fails open when the flags cannot be read (every permitted section is still injected)', async () => {
    state.flags = 'throw';
    const text = await buildTenantContext(TENANT, 'Gym', ALL_PERMISSIONS);
    expect(text).toContain('Attendance:');
    expect(text).toContain('Finance:');
  });
});

describe('action -> module map', () => {
  it('maps every action type', () => {
    expect(Object.keys(ACTION_MODULES).sort()).toEqual([...AI_ACTION_TYPES].sort());
    expect(ACTION_MODULES).toMatchObject({
      assign_workout: 'workout_plans',
      assign_diet: 'diet_plans',
      generate_report: 'reports',
      send_notification: 'notifications',
      create_member: null,
      renew_membership: null,
    });
  });

  it('availableActionTypes drops only the actions of disabled modules', () => {
    expect(availableActionTypes(() => true)).toEqual([...AI_ACTION_TYPES]);
    const without = (off: string) => availableActionTypes((key) => key !== off);
    expect(without('workout_plans')).not.toContain('assign_workout');
    expect(without('workout_plans')).toContain('assign_diet');
    expect(without('diet_plans')).not.toContain('assign_diet');
    expect(without('reports')).not.toContain('generate_report');
    expect(without('notifications')).not.toContain('send_notification');
    expect(availableActionTypes(() => false)).toEqual(['create_member', 'renew_membership']);
  });
});

describe('buildSystemPrompt', () => {
  it('lists only the available actions', () => {
    const prompt = buildSystemPrompt('Gym', 'CTX', availableActionTypes((key) => key !== 'workout_plans' && key !== 'reports'));
    expect(prompt).toContain('- assign_diet');
    expect(prompt).toContain('- send_notification');
    expect(prompt).not.toContain('- assign_workout');
    expect(prompt).not.toContain('- generate_report');
    expect(prompt).toContain('CTX');
  });

  it('default (no list) keeps every action, and an empty list degrades to "no actions available"', () => {
    const all = buildSystemPrompt('Gym', 'CTX');
    for (const type of AI_ACTION_TYPES) expect(all).toContain(`- ${type}`);
    expect(buildSystemPrompt('Gym', 'CTX', [])).toContain('no action types are available');
  });
});

describe('executeAiAction', () => {
  const proposals: Array<{ proposal: AiActionProposal; module: string; label: string; ran: string }> = [
    { proposal: { type: 'assign_workout', params: { memberId: 'm', planId: 'p', startDate: '2026-11-01' }, summary: 's' }, module: 'workout_plans', label: 'Workout plans', ran: 'assign_workout' },
    { proposal: { type: 'assign_diet', params: { memberId: 'm', planId: 'p', startDate: '2026-11-01' }, summary: 's' }, module: 'diet_plans', label: 'Diet plans', ran: 'assign_diet' },
    { proposal: { type: 'generate_report', params: { reportType: 'membership' }, summary: 's' }, module: 'reports', label: 'Reports', ran: 'generate_report' },
    { proposal: { type: 'send_notification', params: { title: 't', body: 'b' }, summary: 's' }, module: 'notifications', label: 'Notifications', ran: 'send_notification' },
  ];

  it.each(proposals)('$proposal.type runs when $module is on', async ({ proposal, ran }) => {
    const outcome = await executeAiActionDetailed(TENANT, actor, proposal);
    expect(outcome.status).toBe('executed');
    expect(state.calls).toEqual([ran]);
  });

  it.each(proposals)('$proposal.type is refused with a clear message (returned, not thrown) and runs nothing when $module is off', async ({ proposal, module, label }) => {
    state.flags = ALL_MODULES.filter((m) => m !== module);
    const outcome = await executeAiActionDetailed(TENANT, actor, proposal);
    expect(outcome).toEqual({ status: 'refused', message: `${label} is disabled for this gym.` });
    expect(state.calls).toEqual([]);
    await expect(executeAiAction(TENANT, actor, proposal)).resolves.toBe(`${label} is disabled for this gym.`);
  });

  it('core actions (create_member, renew_membership) are never module-gated', async () => {
    state.flags = [];
    await executeAiActionDetailed(TENANT, actor, { type: 'renew_membership', params: { memberId: 'm' }, summary: 's' });
    expect(state.calls).toEqual(['renew_membership']);
  });

  it('still enforces the permission first (a user without it gets Forbidden, not the module message)', async () => {
    state.hasPermission = false;
    state.flags = [];
    await expect(executeAiActionDetailed(TENANT, actor, proposals[0]!.proposal)).rejects.toThrow(/permission/);
  });

  it('fails open when the flags cannot be read (the action runs)', async () => {
    state.flags = 'throw';
    const outcome = await executeAiActionDetailed(TENANT, actor, proposals[0]!.proposal);
    expect(outcome.status).toBe('executed');
  });
});
