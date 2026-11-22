import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { readSrc, referencesFeatureFlags, flagsWithout, type PlatformFlag } from './helpers';

/**
 * DIRECT-URL behaviour. A disabled flag must not leave a page reachable by typing its URL.
 * `app/(portal)/layout.tsx` mounts `<RequireFeatureRoute>` (features/navigation), which resolves the route's flag
 * through `getRouteFeature` (table derived from NAV_ITEMS + a small extras map) and renders an "unavailable" state
 * instead of the page when the flag is not in `tenant.featureFlags` (gap W1, FIXED).
 */

const state = vi.hoisted(() => ({ flags: [] as string[], pathname: '/' }));
vi.mock('@/features/tenant/tenant-provider', () => ({
  useTenant: () => ({ id: 'tenant-1', featureFlags: state.flags }),
}));
vi.mock('next/navigation', () => ({ usePathname: () => state.pathname }));

import { getRouteFeature } from '@/features/navigation/route-features';
import { RequireFeatureRoute } from '@/features/navigation/require-feature-route';

/** Every route (incl. nested/detail pages and pages without a nav item) that belongs to each platform flag. */
const ROUTES_BY_FLAG: Record<PlatformFlag, string[]> = {
  ai_coach: ['/gym-settings/ai'],
  notifications: ['/notifications', '/notifications/settings', '/notifications/log', '/announcements', '/communications', '/communications/send', '/communications/automations', '/communications/history'],
  support_tickets: [], // /support consults the flag itself (hides tickets, keeps the help centre) — never blocked at route level
  expenses: ['/expenses', '/expenses/new'],
  income: ['/income'],
  payments: ['/payments', '/payments/new', '/payments/abc', '/invoices', '/invoices/new', '/invoices/abc'],
  reports: ['/reports', '/reports/revenue', '/analytics'],
  attendance: ['/attendance', '/attendance/history', '/attendance/check-in', '/attendance-devices'],
  diet_plans: ['/diet-plans', '/diet-plans/new', '/diet-plans/foods', '/diet-plans/smart', '/diet-plans/abc'],
  live_classes: ['/classes', '/classes/new', '/classes/calendar', '/classes/abc'],
  workout_plans: ['/workout-plans', '/workout-plans/new', '/workout-plans/exercises', '/workout-plans/abc'],
  hr: ['/hr', '/hr/me', '/hr/leaves', '/hr/attendance', '/hr/employees', '/hr/employees/u1', '/hr/payroll', '/hr/payroll/run1', '/hr/setup'],
};

function renderRoute(pathname: string, flags: string[]): string {
  state.pathname = pathname;
  state.flags = flags;
  return renderToStaticMarkup(React.createElement(RequireFeatureRoute, null, React.createElement('b', null, 'PAGE')));
}

describe('route-level guard: direct URL visit', () => {
  for (const [flag, routes] of Object.entries(ROUTES_BY_FLAG) as [PlatformFlag, string[]][]) {
    for (const route of routes) {
      it(`${flag}: ${route} maps to the flag, is blocked when OFF and rendered when ON`, () => {
        expect(getRouteFeature(route)).toBe(flag);
        const off = renderRoute(route, flagsWithout(flag));
        expect(off).toContain("This feature isn&#x27;t available");
        expect(off).toContain('Back to dashboard');
        expect(off).not.toContain('PAGE');
        expect(renderRoute(route, flagsWithout())).toContain('PAGE');
      });
    }
  }

  it('turning one flag off does not block other modules', () => {
    for (const route of ['/members', '/payments', '/classes', '/dashboard']) {
      expect(renderRoute(route, flagsWithout('expenses'))).toContain('PAGE');
    }
  });

  it('plan modules the nav marks are gated the same way (members, staff, branches, membership_plans)', () => {
    expect(getRouteFeature('/members/abc')).toBe('members');
    expect(getRouteFeature('/users')).toBe('staff');
    expect(getRouteFeature('/staff/new')).toBe('staff');
    expect(getRouteFeature('/branches/abc')).toBe('branches');
    expect(getRouteFeature('/memberships/new')).toBe('membership_plans');
  });

  it('un-flagged routes are never blocked', () => {
    for (const route of ['/dashboard', '/leads', '/measurements', '/billing', '/billing/invoices', '/gym-settings/profile', '/support', '/settings', '/profile', '/roles']) {
      expect(getRouteFeature(route)).toBeUndefined();
      expect(renderRoute(route, [])).toContain('PAGE');
    }
  });

  it('hr: a user without the flag sees the unavailable state on every /hr/** route; nested ids and unknown subpaths included', () => {
    for (const route of ['/hr', '/hr/me', '/hr/leaves', '/hr/attendance', '/hr/employees/abc', '/hr/payroll/abc', '/hr/setup', '/hr/whatever']) {
      expect(getRouteFeature(route)).toBe('hr');
    }
    expect(getRouteFeature('/hrx')).toBeUndefined(); // segment-aware
  });

  it('matching is segment-aware (/attendance-devices is not under /attendance; /invoicesX is not /invoices)', () => {
    expect(getRouteFeature('/attendance-devices')).toBe('attendance');
    expect(getRouteFeature('/invoicesX')).toBeUndefined();
    expect(getRouteFeature('/billing/invoices')).toBeUndefined(); // platform billing invoices are not the payments module
  });

  it('the shared portal layout mounts the route guard and the flags refresher', () => {
    const layout = readSrc('app/(portal)/layout.tsx');
    expect(layout).toContain('<RequireFeatureRoute>');
    expect(layout).toContain('<TenantFlagsRefresher />');
    expect(referencesFeatureFlags(layout)).toBe(true);
  });

  it('platform host (no real tenant, empty flags) is not blocked by the route guard', async () => {
    vi.doMock('@/features/tenant/tenant-provider', () => ({ useTenant: () => ({ id: 'platform', featureFlags: [] }) }));
    vi.resetModules();
    const { RequireFeatureRoute: Guard } = await import('@/features/navigation/require-feature-route');
    state.pathname = '/payments';
    const html = renderToStaticMarkup(React.createElement(Guard, null, React.createElement('b', null, 'PAGE')));
    expect(html).toContain('PAGE');
    vi.doUnmock('@/features/tenant/tenant-provider');
  });

  it('the other direct consumers of tenant.featureFlags are unchanged: ai-launcher-button + support page', () => {
    const consumers = [
      'features/ai-assistant/components/ai-launcher-button.tsx',
      'app/(portal)/support/page.tsx',
    ];
    for (const file of consumers) expect(readSrc(file)).toMatch(/featureFlags\.includes\('(ai_coach|support_tickets)'\)/);
  });
});

describe('Gym Settings AI tab + support copy', () => {
  it('ai_coach: the AI tab of the Gym Settings strip is tied to the flag', () => {
    const src = readSrc('features/gym-settings/components/settings-hero.tsx');
    expect(src).toMatch(/href: '\/gym-settings\/ai'[^}]*featureFlag: 'ai_coach'/);
    expect(src).toMatch(/featureFlags\.includes\(t\.featureFlag\)/);
  });

  it('support_tickets: neutral copy, no "Not on your plan" / upgrade wording', () => {
    const src = readSrc('app/(portal)/support/page.tsx');
    expect(src).toContain('Support tickets are currently unavailable');
    expect(src).not.toMatch(/Not on your plan|Upgrade your subscription/);
  });
});
