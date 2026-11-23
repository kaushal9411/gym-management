import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const state = vi.hoisted(() => ({
  perms: [] as string[],
  summary: { isError: false, isPending: false, error: null as unknown, data: undefined as unknown },
  probe: { isError: false, isPending: false, error: null as unknown, data: undefined as unknown },
  pending: false,
}));

vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: () => undefined }), useSearchParams: () => new URLSearchParams(), usePathname: () => '/hr/me' }));
vi.mock('@/features/auth/hooks/use-permissions', () => ({
  usePermissions: () => ({ hasPermission: (k: string) => state.perms.includes(k) }),
}));
vi.mock('@/features/hr/hooks/use-hr', async (orig) => {
  const actual = await orig<typeof import('@/features/hr/hooks/use-hr')>();
  return {
    ...actual,
    useMeSummary: () => state.summary,
    useMeBalances: () => state.probe,
    useEnrollMe: () => ({ isPending: state.pending, mutateAsync: async () => ({}) }),
  };
});

import { MePage } from '@/features/hr/components/me/me-page';
import { AuthServiceError } from '@/features/auth/types';

function apiErr(apiCode: string) {
  const e = new AuthServiceError('UNKNOWN', 'no profile');
  e.details = { status: 403, apiCode, errors: [] };
  return e;
}

function notAnEmployee() {
  return { isError: true, isPending: false, data: undefined, error: apiErr('NOT_AN_EMPLOYEE') };
}

function render() {
  const qc = new QueryClient();
  return renderToStaticMarkup(React.createElement(QueryClientProvider, { client: qc }, React.createElement(MePage)));
}

beforeEach(() => {
  state.perms = [];
  state.summary = { isError: false, isPending: true, error: null, data: undefined };
  state.probe = { isError: false, isPending: false, error: null, data: undefined };
  state.pending = false;
});

describe('My HR opt-in card', () => {
  it('shows for a user with self keys who got NOT_AN_EMPLOYEE', () => {
    state.perms = ['hr:self_attendance', 'hr:self_leave'];
    state.summary = notAnEmployee() as never;
    const html = render();
    expect(html).toContain('You are not on the employee roster');
    expect(html).toContain('Add me as an employee');
    expect(html).not.toMatch(/ disabled=""/);
  });

  it('also shows for a leave-only user (probed through the balances call)', () => {
    state.perms = ['hr:self_leave'];
    state.probe = notAnEmployee() as never;
    expect(render()).toContain('Add me as an employee');
  });

  it('is hidden without self keys (plain unavailable message)', () => {
    state.perms = ['hr:view'];
    state.summary = notAnEmployee() as never;
    const html = render();
    expect(html).not.toContain('Add me as an employee');
  });

  it('is hidden when the summary loaded fine or failed for another reason', () => {
    state.perms = ['hr:self_attendance'];
    state.summary = { isError: true, isPending: false, data: undefined, error: apiErr('INTERNAL_ERROR') } as never;
    expect(render()).not.toContain('Add me as an employee');
  });

  it('disables the button while the enrolment is pending', () => {
    state.perms = ['hr:self_attendance'];
    state.summary = notAnEmployee() as never;
    state.pending = true;
    const html = render();
    expect(html).toMatch(/ disabled=""/);
    expect(html).toContain('Adding you');
  });
});
