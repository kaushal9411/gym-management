'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { useAuth } from '@/features/auth/hooks/use-auth';
import { avatarColor, fmtInt, initials } from '@/features/dashboard/components/format';
import type { DashboardOverview } from '@/features/dashboard/types';
import { cn } from '@/lib/utils';
import { NAV_GROUPS, type NavBadgeKey } from './nav-config';

function badgeFor(key: NavBadgeKey | undefined, ov: DashboardOverview | undefined): { n: number; danger: boolean } | null {
  if (!key || !ov) return null;
  const n = key === 'tenants' ? ov.kpis.tenantsTotal?.value : key === 'payments' ? ov.kpis.failedPayments?.value : ov.supportTickets?.open;
  if (n === undefined || n === null || (key !== 'tenants' && n <= 0)) return null;
  return { n, danger: key === 'payments' };
}

/** 232px graphite sidebar: brand, grouped permission-filtered nav, admin card. Used inline (>= md) and inside the mobile drawer. */
export function Sidebar({ overview, onNavigate }: { overview?: DashboardOverview; onNavigate?: () => void }) {
  const pathname = usePathname();
  const { admin } = useAuth();
  const perms = admin?.permissions ?? [];
  const groups = NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((i) => i.permission === 'dashboard:read' || perms.includes(i.permission)),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 bg-sidebar px-3 py-4 text-sidebar-foreground">
      <Link href="/dashboard" onClick={onNavigate} className="flex items-center gap-2.5 rounded-lg px-2 py-1 text-base font-bold text-white outline-none focus-visible:ring-2 focus-visible:ring-brand-accent">
        <span className="grid size-[30px] place-items-center rounded-lg bg-gradient-to-br from-[#14b8a6] to-[#0f766e] text-sm text-white" aria-hidden>F</span>
        FitCloud <span className="text-xs font-medium text-sidebar-muted">Admin</span>
      </Link>
      <nav aria-label="Main" className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-0.5">
        {groups.map((g) => (
          <div key={g.label}>
            <p className="mb-1 px-2.5 text-[10.5px] font-medium uppercase tracking-[0.1em] text-sidebar-muted">{g.label}</p>
            <ul className="space-y-0.5">
              {g.items.map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                const Icon = item.icon;
                const b = badgeFor(item.badge, overview);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand-accent',
                        active ? 'bg-[var(--sidebar-active)] text-[var(--sidebar-active-foreground)]' : 'text-slate-300 hover:bg-sidebar-accent hover:text-white',
                      )}
                    >
                      <Icon className="size-4 shrink-0" aria-hidden />
                      <span className="truncate">{item.label}</span>
                      {b ? (
                        <span className={cn('ml-auto rounded-full px-2 py-px text-[11px] font-medium tabular-nums', b.danger ? 'bg-[#7f1d1d] text-red-200' : 'bg-sidebar-accent text-slate-200')}>
                          {fmtInt(b.n)}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      {admin ? (
        <div className="flex items-center gap-2.5 rounded-xl bg-sidebar-accent p-2.5 text-slate-200">
          <span className="grid size-[30px] shrink-0 place-items-center rounded-lg text-[11px] font-bold text-white" style={{ background: avatarColor(admin.email) }} aria-hidden>{initials(admin.name)}</span>
          <div className="min-w-0 leading-tight">
            <p className="truncate text-[13px] font-semibold">{admin.name}</p>
            <p className="truncate text-[11px] text-sidebar-muted" title={admin.email}>{admin.role} · {admin.email}</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
