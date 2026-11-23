import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { PLATFORM_FLAGS, flagsWithout, type PlatformFlag } from './helpers';

/**
 * The portal breadcrumb must never offer links into a section whose route is blocked by a feature flag
 * (the page itself shows "This feature isn't available"). Blocked route => Dashboard > Unavailable.
 */
const state = vi.hoisted(() => ({ flags: [] as string[], pathname: '/', id: 'tenant-1' }));
vi.mock('@/features/tenant/tenant-provider', () => ({
  useTenant: () => ({ id: state.id, featureFlags: state.flags }),
}));
vi.mock('next/navigation', () => ({ usePathname: () => state.pathname }));

import { PortalBreadcrumbs } from '@/components/layout/portal-breadcrumbs';
import { buildBreadcrumbTrail } from '@/features/navigation/breadcrumb-trail';

function render(pathname: string, flags: string[], id = 'tenant-1'): string {
  state.pathname = pathname;
  state.flags = flags;
  state.id = id;
  return renderToStaticMarkup(React.createElement(PortalBreadcrumbs));
}

const hrefs = (html: string) => [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);

const NESTED_BY_FLAG: Partial<Record<PlatformFlag, string[]>> = {
  hr: ['/hr/payroll', '/hr/employees/u1', '/hr/payroll/run1'],
  expenses: ['/expenses/new'],
  diet_plans: ['/diet-plans/foods', '/diet-plans/abc'],
  workout_plans: ['/workout-plans/exercises'],
  live_classes: ['/classes/calendar'],
  payments: ['/payments/new', '/invoices/abc'],
  attendance: ['/attendance/check-in', '/attendance/history'],
  notifications: ['/communications/send'],
  ai_coach: ['/gym-settings/ai'],
};

describe('portal breadcrumbs: route blocked by a feature flag', () => {
  it('hr off: /hr/payroll shows no HR crumb and no link into /hr', () => {
    const html = render('/hr/payroll', flagsWithout('hr'));
    expect(html).not.toContain('>HR<');
    expect(html).not.toContain('Payroll');
    expect(hrefs(html)).toEqual(['/dashboard']);
    expect(html).toContain('Unavailable');
  });

  for (const flag of PLATFORM_FLAGS) {
    for (const route of NESTED_BY_FLAG[flag] ?? []) {
      it(`${flag} off: ${route} -> only Dashboard link + plain "Unavailable"`, () => {
        const html = render(route, flagsWithout(flag));
        expect(hrefs(html)).toEqual(['/dashboard']);
        expect(html).toContain('Unavailable');
        expect(buildBreadcrumbTrail(route, flagsWithout(flag)).map((c) => c.label)).toEqual(['Dashboard', 'Unavailable']);
      });

      it(`${flag} on: ${route} -> normal trail, last crumb is the current page`, () => {
        const html = render(route, flagsWithout());
        expect(html).not.toContain('Unavailable');
        expect(hrefs(html)[0]).toBe('/dashboard');
        const trail = buildBreadcrumbTrail(route, flagsWithout());
        expect(trail.length).toBe(route.split('/').filter(Boolean).length + 1);
        expect(trail[trail.length - 1]!.href).toBeUndefined();
      });
    }
  }
});

describe('portal breadcrumbs: unchanged for unblocked routes', () => {
  it('hr on: /hr/payroll keeps Dashboard > HR (link) > Payroll (page)', () => {
    const html = render('/hr/payroll', flagsWithout());
    expect(hrefs(html)).toEqual(['/dashboard', '/hr']);
    expect(html).toContain('HR');
    expect(html).toContain('Payroll');
  });

  it('un-flagged section stays linked even when every platform flag is off', () => {
    expect(buildBreadcrumbTrail('/gym-settings/team', flagsWithout(...PLATFORM_FLAGS))).toEqual([
      { label: 'Dashboard', href: '/dashboard' },
      { label: 'Gym Settings', href: '/gym-settings' },
      { label: 'Team' },
    ]);
  });

  it('a different flag being off does not affect the trail', () => {
    expect(hrefs(render('/hr/payroll', flagsWithout('expenses')))).toEqual(['/dashboard', '/hr']);
  });

  it('platform host (no flags) is never treated as blocked', () => {
    expect(hrefs(render('/hr/payroll', [], 'platform'))).toEqual(['/dashboard', '/hr']);
  });

  it('root path renders nothing', () => {
    expect(render('/', flagsWithout())).toBe('');
  });
});
