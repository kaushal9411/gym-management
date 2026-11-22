import { readSrc, referencesFeatureFlags } from './helpers';
import { PORTAL_NAV, portalRouteFlag } from '@/features/member-portal/lib/nav';

/**
 * Cross-feature widgets, member profile, notification centre and member portal.
 * Source-level assertions (no DOM runner in this package). `it.fails` = DESIRED behaviour that is a KNOWN GAP today:
 * it passes while the gap exists and starts failing once gating is added (then drop `.fails`).
 */

const gated = (file: string) => referencesFeatureFlags(readSrc(file));

describe('things that ARE gated by a flag', () => {
  it('ai_coach: floating AI launcher renders only with the flag AND ai:use', () => {
    expect(readSrc('features/ai-assistant/components/ai-launcher-button.tsx')).toMatch(
      /featureFlags\.includes\('ai_coach'\)\s*&&\s*hasPermission\('ai:use'\)/,
    );
  });

  it('support_tickets: /support hides ticket list, stats and "New ticket" without the flag', () => {
    const src = readSrc('app/(portal)/support/page.tsx');
    expect(src).toMatch(/featureFlags\.includes\('support_tickets'\)/);
    expect(src).toMatch(/canRaise = hasTickets && canCreate/);
  });

  it('global search "Pages" group and quick-add reuse the flag-filtered nav', () => {
    expect(readSrc('components/layout/global-search.tsx')).toContain('useFilteredNav');
    expect(readSrc('components/layout/quick-actions-menu.tsx')).toContain('useFilteredNav');
  });

  it('global search entity results are members/staff/branches only -> no flagged-feature data can leak', () => {
    const src = readSrc('components/layout/global-search.tsx');
    expect(src).toMatch(/label: 'Members'/);
    expect(src).toMatch(/label: 'Staff'/);
    expect(src).toMatch(/label: 'Branches'/);
    expect(src).not.toMatch(/label: '(Payments|Classes|Expenses|Income|Invoices)'/);
  });
});

// W3 FIXED: every dashboard panel is gated by the module of the endpoint it calls (see features/dashboard/hooks/use-dashboard-modules.ts).
describe('dashboard widgets are gated by the module they show (W3)', () => {
  const modules = readSrc('features/dashboard/hooks/use-dashboard-modules.ts');
  const hero = readSrc('features/dashboard/components/dashboard-hero.tsx');
  const kpi = readSrc('features/dashboard/components/kpi-strip.tsx');
  const charts = readSrc('features/dashboard/components/chart-panels.tsx');
  const lists = readSrc('features/dashboard/components/list-panels.tsx');
  const insight = readSrc('features/dashboard/components/insight-panels.tsx');
  const page = readSrc('app/(portal)/dashboard/page.tsx');

  it('the module/panel hook reads tenant.featureFlags and the API disabledModules (additive)', () => {
    expect(readSrc('features/tenant/use-feature-flag.ts')).toContain('featureFlags');
    expect(modules).toContain('disabledModules');
    expect(modules).toContain("tenantFlags.has('dashboard')");
  });

  it('income: Monthly income tile + Net profit consult the flag', () => {
    expect(kpi).toMatch(/!has\('income'\) \? null/);
    expect(kpi).toMatch(/has\('income'\) && has\('expenses'\)/);
  });

  it('expenses: Monthly expenses tile and the Income-vs-expenses chart need BOTH income and expenses', () => {
    expect(kpi).toMatch(/!has\('expenses'\) \? null/);
    expect(modules).toMatch(/money: analytics && has\('income'\) && has\('expenses'\)/);
    expect(charts).toMatch(/useRevenueTrends\([^)]*panels\.money\)/);
  });

  it('payments: Outstanding tile/panel, "Due now" card and "Record payment" shortcut consult the flag', () => {
    expect(kpi).toMatch(/!has\('payments'\) \? null/);
    expect(hero).toMatch(/has\('payments'\) \? \{ label: 'Due now'/);
    expect(hero).toMatch(/has\('payments'\) && hasPermission\('finance:view'\)/);
    expect(modules).toMatch(/outstanding: has\('payments'\)/);
    expect(lists).toMatch(/useInvoiceList\([^]*?\{ enabled: panels\.outstanding \}/);
  });

  it('attendance: check-ins tile/card, attendance chart and the "Check in" shortcut consult the flag', () => {
    expect(kpi).toMatch(/!has\('attendance'\) \? null/);
    expect(hero).toMatch(/has\('attendance'\) \? \{ label: 'Check-ins today'/);
    expect(hero).toMatch(/has\('attendance'\) && hasPermission\('attendance:view'\)/);
    expect(modules).toMatch(/attendance: analytics && has\('attendance'\)/);
  });

  it('reports: /analytics/* and /reports/<type> panels only query while the reports module is on; dashboard KPIs follow the dashboard module', () => {
    expect(modules).toMatch(/const analytics = has\('reports'\) && hasPermission\('analytics:view'\)/);
    expect(modules).toMatch(/expiring: reportsData/);
    expect(modules).toMatch(/const kpisEnabled = tenantFlags\.has\('dashboard'\) && hasPermission\('reports:view'\)/);
    expect(charts).toMatch(/useAttendanceTrends\([^)]*panels\.attendance\)/);
    expect(charts).toMatch(/useNewMemberGrowth\([^)]*panels\.newMembers\)/);
    expect(lists).toMatch(/useReportData<ExpiringRow>\([^]*?panels\.expiring\)/);
    expect(insight).toMatch(/useBranchComparison\([^)]*panels\.branch\)/);
    expect(insight).toMatch(/trainer-performance[^]*?trainersEnabled/);
    expect(insight).toMatch(/usePaymentCollection\([^)]*showCollection\)/);
  });

  it('notifications: the announcements widget does not query /announcements/active when the module is off', () => {
    expect(readSrc('features/dashboard/components/announcements-widget.tsx')).toContain('panels.announcements');
    expect(readSrc('features/dashboard/hooks/use-announcements.ts')).toMatch(/enabled,/);
    expect(modules).toMatch(/announcements: has\('notifications'\)/);
  });

  it('the page renders only visible panels and reflows rows (no holes, no skeleton for a hidden chart)', () => {
    expect(page).toContain('useDashboardPanels');
    expect(page).toMatch(/panels\[slot\.key\]/);
  });
});

describe('KNOWN GAP: member profile + header + notification centre', () => {
  // W4 FIXED: the profile page + its detail components gate each block by module (no request for a hidden block).
  it('attendance: profile attendance panel, check-in/out buttons and visit tiles consult the flag', () => {
    const page = readSrc('app/(portal)/members/[memberId]/page.tsx');
    expect(page).toMatch(/const attendanceOn = flags\.has\('attendance'\)/);
    expect(page).toMatch(/\{attendanceOn \? \(\s*<MemberAttendancePanel/);
    expect(page).toMatch(/canCheckIn = attendanceOn &&/);
    expect(page).toMatch(/canCheckOut = attendanceOn &&/);
    expect(page).toMatch(/useMemberAttendance\(attendanceOn \? memberId : null/);
    expect(readSrc('features/members/components/detail/member-stat-tiles.tsx')).toMatch(/flags\.has\('attendance'\)/);
  });

  it('payments: profile payments panel, "Send payment link", Total paid / Due tiles and the money query consult the flag', () => {
    const page = readSrc('app/(portal)/members/[memberId]/page.tsx');
    expect(page).toMatch(/const paymentsOn = flags\.has\('payments'\)/);
    expect(page).toMatch(/\{paymentsOn \? <MemberPaymentPanel/);
    expect(page).toMatch(/canSendLink = paymentsOn &&/);
    expect(readSrc('features/members/components/detail/member-stat-tiles.tsx')).toMatch(/flags\.has\('payments'\)/);
    expect(readSrc('features/members/components/detail/member-hero.tsx')).toMatch(/\{paymentsOn \? \(\s*<motion\.aside/);
    expect(readSrc('features/members/components/detail/use-member-money.ts')).toMatch(/enabled: paymentsOn/);
  });

  it('workout_plans / diet_plans: profile workout and diet cards consult the flag', () => {
    const page = readSrc('app/(portal)/members/[memberId]/page.tsx');
    expect(page).toMatch(/flags\.has\('workout_plans'\) \? <MemberWorkoutCard/);
    expect(page).toMatch(/flags\.has\('diet_plans'\) \? <MemberDietCard/);
  });

  // W2 FIXED: bell returns null + the notifications query (60 s poll) is disabled when the module is off.
  it('notifications: header bell panel renders nothing and the notifications query stops polling', () => {
    expect(readSrc('components/layout/notification-panel.tsx')).toContain("featureFlags.includes('notifications')");
    expect(readSrc('features/notifications/hooks/use-notifications.ts')).toContain("featureFlags.includes('notifications')");
    expect(readSrc('features/notifications/hooks/use-notifications.ts')).toContain('refetchInterval: enabled ? 60_000 : false');
  });

  it('notifications: member "Message" button consults the flag', () => {
    expect(readSrc('features/members/components/detail/member-hero.tsx')).toMatch(/flags\.has\('notifications'\) && hasPermission\('notifications:send'\)/);
  });

  it.fails('support_tickets: floating Help Center button / profile-menu entry are fine, but nav item should reflect the flag', () => {
    // Support nav item has no featureFlag by design; desired is at least a nav-config `featureFlag: 'support_tickets'` or a documented decision.
    expect(readSrc('features/navigation/nav-config.ts')).toMatch(/key: 'support'[^}]*featureFlag/s);
  });
});

// W6 FIXED: PORTAL_NAV items carry a featureFlag, filtered in rail / top bar / bottom bar / More sheet, routes are guarded, dashboard sections follow flags + overview.disabledModules.
describe('member portal (/portal/*) honours platform flags (W6)', () => {
  const wanted: [string, string][] = [
    ['attendance', '/portal/attendance'],
    ['workout_plans', '/portal/workout'],
    ['live_classes', '/portal/classes'],
    ['diet_plans', '/portal/diet'],
    ['payments', '/portal/payments'],
    ['payments', '/portal/invoices'],
    ['payments', '/portal/renew'],
    ['notifications', '/portal/notifications'],
  ];

  for (const [flag, href] of wanted) {
    it(`${flag}: portal nav item ${href} declares its feature flag`, () => {
      const item = PORTAL_NAV.find((i) => i.href === href);
      expect(item).toBeDefined();
      expect(item!.featureFlag).toBe(flag);
    });
  }

  it('items without a module (dashboard, measurements, my gym, profile) are never hidden', () => {
    for (const href of ['/portal/dashboard', '/portal/measurements', '/portal/gym', '/portal/profile']) {
      expect(PORTAL_NAV.find((i) => i.href === href)!.featureFlag).toBeUndefined();
    }
  });

  it('route -> module mapping covers sub-pages (invoice detail, notification preferences)', () => {
    expect(portalRouteFlag('/portal/invoices/abc')).toBe('payments');
    expect(portalRouteFlag('/portal/notification-preferences')).toBe('notifications');
    expect(portalRouteFlag('/portal/profile')).toBeUndefined();
    expect(portalRouteFlag('/portal/diet')).toBe('diet_plans');
  });

  it('rail, top bar, bottom bar and More sheet filter through the flag-aware nav; the shell guards the route and gates the unread poll', () => {
    expect(readSrc('features/member-portal/components/shell/side-rail.tsx')).toContain('usePortalNav()');
    expect(readSrc('features/member-portal/components/shell/bottom-tab-bar.tsx')).toContain('usePortalNav()');
    expect(readSrc('features/member-portal/components/shell/more-sheet.tsx')).toContain('usePortalNav()');
    expect(readSrc('features/member-portal/components/shell/top-bar.tsx')).toContain("useFeatureEnabled('notifications')");
    const shell = readSrc('features/member-portal/components/member-portal-shell.tsx');
    expect(shell).toContain('<PortalFeatureGate pathname={pathname}>');
    expect(shell).toContain("useMemberUnreadCount(useFeatureEnabled('notifications'))");
  });

  it('dashboard: per-resource queries are enabled per module and sections hide for disabled modules', () => {
    const data = readSrc('features/member-portal/hooks/use-dashboard-data.ts');
    expect(data).toContain('overviewQ.data?.disabledModules');
    for (const q of ["has('attendance')", "has('workout_plans')", "has('diet_plans')", "has('payments')", "has('live_classes')"]) expect(data).toContain(q);
    const hero = readSrc('features/member-portal/components/dashboard/dashboard-hero.tsx');
    expect(hero).toMatch(/has\('payments'\) \? \(\s*<Link href=\{MEMBER_PORTAL_ROUTES\.renew\}/);
    expect(readSrc('features/member-portal/components/dashboard/dashboard-page-content.tsx')).toMatch(/has\('payments'\) \? \{ key: 'billing'/);
  });
});

describe('KNOWN GAP: tenant flags are resolved once per full page load', () => {
  it('RootLayout resolves the tenant server-side per request and TenantProvider never refetches', () => {
    expect(readSrc('features/tenant/tenant-provider.tsx')).not.toMatch(/useQuery|setInterval|refetch/);
    expect(readSrc('app/layout.tsx')).toContain('resolveTenant');
  });
});
