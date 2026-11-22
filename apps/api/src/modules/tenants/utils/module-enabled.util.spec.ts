import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  flags: {} as Record<string, string[] | null | 'throw'>,
  resolveCalls: [] as string[],
  warnings: [] as unknown[][],
  debugs: [] as unknown[][],
}));

vi.mock('../service/tenant.service', () => ({
  tenantService: {
    resolveById: async (tenantId: string) => {
      state.resolveCalls.push(tenantId);
      const flags = state.flags[tenantId];
      if (flags === 'throw') throw new Error('redis down');
      if (!flags) return null;
      return { id: tenantId, featureFlags: flags };
    },
  },
}));
vi.mock('../../../core/logging/logger', () => ({
  logger: {
    warn: (...args: unknown[]) => void state.warnings.push(args),
    debug: (...args: unknown[]) => void state.debugs.push(args),
    info: () => undefined,
    error: () => undefined,
  },
}));

import { getEnabledModules, isModuleEnabled, moduleGate } from './module-enabled.util';

beforeEach(() => {
  state.flags = { on: ['payments', 'reports'], off: ['reports'], boom: 'throw', gone: null };
  state.resolveCalls = [];
  state.warnings = [];
  state.debugs = [];
});

describe('isModuleEnabled / getEnabledModules', () => {
  it('is true when the tenant resolves with the key in featureFlags, false when it is missing', async () => {
    expect(await isModuleEnabled('on', 'payments')).toBe(true);
    expect(await isModuleEnabled('off', 'payments')).toBe(false);
    expect(await isModuleEnabled('off', 'reports')).toBe(true);
  });

  it('accepts the hr key (FlagModuleKey) and answers per tenant', async () => {
    state.flags = { with: ['hr'], without: ['payments'] };
    expect(await isModuleEnabled('with', 'hr')).toBe(true);
    expect(await isModuleEnabled('without', 'hr')).toBe(false);
    expect(await moduleGate('hr', 'hr-job')('without')).toBe(false);
  });

  it('getEnabledModules answers several keys from ONE resolve', async () => {
    const modules = await getEnabledModules('on');
    expect(modules.resolved).toBe(true);
    expect(modules.has('payments')).toBe(true);
    expect(modules.has('attendance')).toBe(false);
    expect(state.resolveCalls).toEqual(['on']);
  });

  it('FAILS OPEN when the flags cannot be read (resolve throws) and logs a warning', async () => {
    const modules = await getEnabledModules('boom');
    expect(modules.resolved).toBe(false);
    expect(modules.has('payments')).toBe(true);
    expect(modules.has('anything')).toBe(true);
    expect(await isModuleEnabled('boom', 'live_classes')).toBe(true);
    expect(state.warnings.length).toBeGreaterThanOrEqual(2);
  });

  it('FAILS OPEN when the tenant cannot be found (resolve returns null) and logs a warning', async () => {
    expect(await isModuleEnabled('gone', 'attendance')).toBe(true);
    expect(state.warnings).toHaveLength(1);
  });
});

describe('moduleGate (per-sweep, per-tenant)', () => {
  it('skips only the tenant with the module off - other tenants in the same sweep still pass', async () => {
    const gate = moduleGate('payments', 'test-job');
    expect(await gate('on')).toBe(true);
    expect(await gate('off')).toBe(false);
    expect(await gate('on')).toBe(true);
  });

  it('resolves each tenant once per gate however many rows it has, and logs the skip once at debug level', async () => {
    const gate = moduleGate('payments', 'test-job');
    await Promise.all([gate('off'), gate('off'), gate('on'), gate('on'), gate('off')]);
    expect(state.resolveCalls.filter((id) => id === 'off')).toHaveLength(1);
    expect(state.resolveCalls.filter((id) => id === 'on')).toHaveLength(1);
    expect(state.debugs).toHaveLength(1);
    expect(state.debugs[0]![1]).toMatchObject({ job: 'test-job', tenantId: 'off', module: 'payments' });
  });

  it('a new gate (next sweep run) re-reads the flags, so a toggle is picked up', async () => {
    expect(await moduleGate('payments', 'j')('off')).toBe(false);
    state.flags.off = ['payments'];
    expect(await moduleGate('payments', 'j')('off')).toBe(true);
  });

  it('fails open per tenant: one tenant whose flags cannot be read does not affect the others', async () => {
    const gate = moduleGate('payments', 'j');
    expect(await gate('boom')).toBe(true);
    expect(await gate('off')).toBe(false);
  });
});
