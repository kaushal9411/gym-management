import { describe, expect, it } from 'vitest';

import {
  applyOverrideChanges,
  applyOverridesToPlan,
  buildLimitRows,
  isLimitKey,
  parseOverrides,
  type LimitValues,
} from './tenant-limits.util';
import {
  GUARDED_MODULE_KEYS,
  isModuleOverridden,
  moduleLabel,
  moduleToggleError,
} from './tenant-modules.util';

const plan: LimitValues = {
  maxMembers: 500,
  maxStaff: 25,
  maxBranches: 5,
  maxManagers: 3,
  maxTrainers: 10,
  maxReceptionists: 5,
  maxStorageMb: 10240,
};

describe('limit overrides', () => {
  it('parseOverrides drops junk', () => {
    expect(
      parseOverrides({
        maxMembers: 10,
        bogus: 1,
        maxStaff: -1,
        maxBranches: 1.5,
        maxTrainers: '2',
      }),
    ).toEqual({ maxMembers: 10 });
    expect(parseOverrides(null)).toEqual({});
    expect(parseOverrides([1])).toEqual({});
  });
  it('validates keys', () => {
    expect(isLimitKey('maxMembers')).toBe(true);
    expect(isLimitKey('max_members')).toBe(false);
  });
  it('applyOverridesToPlan lays overrides over the plan (what plan-change writes)', () => {
    const merged = applyOverridesToPlan(plan, { maxMembers: 800 });
    expect(merged.maxMembers).toBe(800);
    expect(merged.maxStaff).toBe(25);
  });
  it('buildLimitRows computes effective = override ?? plan ?? stored', () => {
    const rows = buildLimitRows(plan, { maxBranches: 7 }, null);
    expect(rows.find((r) => r.key === 'maxBranches')).toMatchObject({
      planValue: 5,
      override: 7,
      effective: 7,
    });
    expect(rows.find((r) => r.key === 'maxMembers')).toMatchObject({
      planValue: 500,
      override: null,
      effective: 500,
    });
    const noPlan = buildLimitRows(null, {}, plan);
    expect(noPlan[0]).toMatchObject({ planValue: null, effective: 500 });
    expect(buildLimitRows(null, {}, null)[0]!.effective).toBeNull();
  });
  it('applyOverrideChanges sets/clears and reports only real changes', () => {
    const { next, diff } = applyOverrideChanges(
      { maxMembers: 800 },
      { maxMembers: null, maxStaff: 30, maxBranches: null },
    );
    expect(next).toEqual({ maxStaff: 30 });
    expect(diff).toEqual([
      { key: 'maxMembers', before: 800, after: null },
      { key: 'maxStaff', before: null, after: 30 },
    ]);
    expect(applyOverrideChanges({ maxStaff: 30 }, { maxStaff: 30 }).diff).toEqual([]);
  });
});

describe('module toggle guard', () => {
  it('refuses to disable core modules but allows enabling and others', () => {
    for (const k of GUARDED_MODULE_KEYS) {
      expect(moduleToggleError(k, false)).toMatch(/cannot be disabled/);
      expect(moduleToggleError(k, true)).toBeNull();
    }
    expect(moduleToggleError('workout_plans', false)).toBeNull();
  });
  it('override flag only when different from plan default', () => {
    expect(isModuleOverridden(false, true)).toBe(true);
    expect(isModuleOverridden(true, true)).toBe(false);
  });
  it('labels', () => {
    expect(moduleLabel('workout_plans')).toBe('Workout Plans');
    expect(moduleLabel('x', 'Custom')).toBe('Custom');
  });
});
