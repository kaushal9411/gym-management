import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { PLATFORM_FLAGS, flagsWithout, type PlatformFlag } from './helpers';

// Owner-like user: every permission granted, so ONLY the feature-flag half of `useFilteredNav` is under test.
// `perms: null` = every permission; otherwise only the listed keys.
const state = vi.hoisted(() => ({ flags: [] as string[], perms: null as string[] | null }));
vi.mock('@/features/auth/hooks/use-permissions', () => ({
  usePermissions: () => ({
    hasPermission: (k: string) => state.perms === null || state.perms.includes(k),
    hasAnyPermission: (ks: string[]) => state.perms === null || ks.some((k) => state.perms!.includes(k)),
  }),
}));
vi.mock('@/features/tenant/tenant-provider', () => ({
  useTenant: () => ({ featureFlags: state.flags }),
}));

import { useFilteredNav } from '@/features/navigation/use-filtered-nav';
import { QuickActionsMenu } from '@/components/layout/quick-actions-menu';

function visibleNav(flags: string[], perms: string[] | null = null) {
  state.flags = flags;
  state.perms = perms;
  let items: ReturnType<typeof useFilteredNav> = [];
  function Probe() {
    items = useFilteredNav();
    return null;
  }
  renderToStaticMarkup(React.createElement(Probe));
  state.perms = null;
  return items;
}

function visibleNavKeys(flags: string[]): string[] {
  state.flags = flags;
  let keys: string[] = [];
  function Probe() {
    keys = useFilteredNav().map((i) => i.key);
    return null;
  }
  renderToStaticMarkup(React.createElement(Probe));
  return keys;
}

/** Sidebar item keys (nav-config.ts) whose `featureFlag` is the given platform flag. */
const NAV_KEYS_BY_FLAG: Record<PlatformFlag, string[]> = {
  ai_coach: [], // no sidebar item — gated by <AiLauncherButton/> (see widgets spec)
  notifications: ['notifications', 'announcements', 'communications'],
  support_tickets: [], // Support nav item deliberately has NO featureFlag (help centre stays usable); page gates the tickets section
  expenses: ['expenses'],
  income: ['income'],
  payments: ['payments'],
  reports: ['reports', 'analytics'],
  attendance: ['attendance', 'attendance-history', 'attendance-devices'],
  diet_plans: ['diet-plans'],
  live_classes: ['classes'],
  workout_plans: ['workout-plans'],
  hr: ['hr'],
};

describe('sidebar nav: platform feature flag ENABLED vs DISABLED', () => {
  it('baseline: with every flag enabled all flagged items are visible', () => {
    const keys = visibleNavKeys(flagsWithout());
    for (const flag of PLATFORM_FLAGS) for (const k of NAV_KEYS_BY_FLAG[flag]) expect(keys).toContain(k);
  });

  for (const flag of PLATFORM_FLAGS) {
    const expected = NAV_KEYS_BY_FLAG[flag];

    it(`${flag}: enabled -> its nav items are visible`, () => {
      const keys = visibleNavKeys(flagsWithout());
      for (const k of expected) expect(keys).toContain(k);
    });

    it(`${flag}: disabled -> its nav items [${expected.join(', ') || 'none'}] are absent and nothing else changes`, () => {
      const on = visibleNavKeys(flagsWithout());
      const off = visibleNavKeys(flagsWithout(flag));
      for (const k of expected) expect(off).not.toContain(k);
      // exactly the flagged items vanish — no collateral hiding of unrelated modules
      expect(on.filter((k) => !off.includes(k)).sort()).toEqual([...expected].sort());
    });
  }

  it('Support nav item stays visible when support_tickets is off (partial gating by design: page hides tickets only)', () => {
    expect(visibleNavKeys(flagsWithout('support_tickets'))).toContain('support');
  });

  it('flags outside the 11 (members, staff, ...) are plan-only: a missing key hides the item, platform has no switch', () => {
    const keys = visibleNavKeys(flagsWithout('members'));
    expect(keys).not.toContain('members');
  });

  it('disabling every platform flag leaves Dashboard, Members, Leads, Billing, Settings, Support reachable', () => {
    const keys = visibleNavKeys(flagsWithout(...PLATFORM_FLAGS));
    for (const k of ['dashboard', 'members', 'leads', 'billing', 'support', 'settings', 'gym-settings', 'measurements']) {
      expect(keys).toContain(k);
    }
  });
});

describe('quick-add menu derives from the filtered sidebar (attendance / payments / expenses shortcuts)', () => {
  function renderQuickAdd(flags: string[]): string {
    state.flags = flags;
    return renderToStaticMarkup(React.createElement(QuickActionsMenu));
  }

  it('renders nothing when none of members/attendance/payments/expenses is available', () => {
    expect(renderQuickAdd(['reports'])).toBe('');
  });

  it('hr is not a Quick Add shortcut: with only the hr flag the trigger does not render', () => {
    expect(renderQuickAdd(['hr'])).toBe('');
  });

  for (const flag of ['attendance', 'payments', 'expenses']) {
    it(`${flag}: enabled alone -> Quick Add trigger renders; disabled -> gone`, () => {
      expect(renderQuickAdd([flag])).toContain('Quick Add');
      expect(renderQuickAdd([])).toBe('');
    });
  }
});

describe('HR sidebar group: needs the `hr` flag AND an hr:* permission', () => {
  const HR_CHILDREN = ['hr-overview', 'hr-employees', 'hr-attendance', 'hr-leaves', 'hr-payroll', 'hr-setup', 'hr-me'];
  const hrItem = (flags: string[], perms: string[] | null) => visibleNav(flags, perms).find((i) => i.key === 'hr');

  it('flag ON + hr permission -> group visible with its permitted children', () => {
    const all = hrItem(flagsWithout(), null);
    expect(all?.children?.map((c) => c.key)).toEqual(HR_CHILDREN);
    expect(hrItem(flagsWithout(), ['hr:view'])?.children?.map((c) => c.key)).toEqual(['hr-overview', 'hr-employees', 'hr-attendance', 'hr-setup']);
    expect(hrItem(flagsWithout(), ['hr:self_leave'])?.children?.map((c) => c.key)).toEqual(['hr-me']);
  });

  it('flag ON + no hr:* permission -> group hidden', () => {
    expect(hrItem(flagsWithout(), ['members:view'])).toBeUndefined();
  });

  it('flag OFF -> the whole group (parent and every child) is hidden, even for a user with every permission', () => {
    const keys = visibleNav(flagsWithout('hr'), null).flatMap((i) => [i.key, ...(i.children ?? []).map((c) => c.key)]);
    expect(keys).not.toContain('hr');
    for (const k of HR_CHILDREN) expect(keys).not.toContain(k);
    expect(keys).toContain('leads');
  });

  it('flag OFF + hr permission only -> still hidden', () => {
    expect(hrItem(flagsWithout('hr'), ['hr:view'])).toBeUndefined();
  });
});
