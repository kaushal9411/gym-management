'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { BriefcaseBusiness, CalendarCheck, CalendarDays, Contact, LayoutGrid, SlidersHorizontal, UserRound, Wallet, type LucideIcon } from 'lucide-react';

import { AUTH_ROUTES } from '@/features/auth/constants';
import { cn } from '@/lib/utils';
import { useMotionSafe } from '@/features/reports/lib/motion';
import { HR_PILL_BG } from '../lib/hr-palette';
import { useHrAccess } from '../lib/status';

interface HrTab {
  href: string;
  label: string;
  icon: LucideIcon;
  show: boolean;
}

/** Layout for every `/hr/*` route: permission gate (any hr:* key) + a permission-filtered tab strip that is the in-page twin of the sidebar sub-links (needed on phones, where the sidebar is a drawer). */
export function HrShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const access = useHrAccess();
  const m = useMotionSafe();
  const allowed = access.anyManager || access.anySelf;

  React.useEffect(() => {
    if (!allowed) router.replace(AUTH_ROUTES.accessDenied);
  }, [allowed, router]);

  if (!allowed) return null;

  const tabs: HrTab[] = [
    { href: '/hr', label: 'Overview', icon: LayoutGrid, show: access.view },
    { href: '/hr/employees', label: 'Employees', icon: Contact, show: access.view },
    { href: '/hr/attendance', label: 'Attendance', icon: CalendarCheck, show: access.view },
    { href: '/hr/leaves', label: 'Leaves', icon: CalendarDays, show: access.leaveManage },
    { href: '/hr/payroll', label: 'Payroll', icon: Wallet, show: access.payrollManage },
    { href: '/hr/setup', label: 'Setup', icon: SlidersHorizontal, show: access.view },
    { href: '/hr/me', label: 'My HR', icon: UserRound, show: access.anySelf },
  ];
  const visible = tabs.filter((t) => t.show);
  const isActive = (href: string) => (href === '/hr' ? pathname === '/hr' : pathname === href || pathname.startsWith(`${href}/`));

  return (
    <div className="space-y-3.5">
      {visible.length > 1 ? (
        <nav aria-label="HR sections" className="-mb-0.5">
          <ul className="flex gap-1 overflow-x-auto rounded-2xl border bg-card/80 p-1 shadow-xs backdrop-blur [scrollbar-width:none]">
            <li className="hidden items-center pl-2.5 pr-1.5 text-muted-foreground sm:flex" aria-hidden>
              <BriefcaseBusiness className="size-4" />
            </li>
            {visible.map((t) => {
              const active = isActive(t.href);
              const Icon = t.icon;
              return (
                <li key={t.href} className="shrink-0">
                  <Link
                    href={t.href}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'relative inline-flex h-9 items-center gap-1.5 rounded-xl px-3.5 text-[13px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      active ? 'text-white' : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                    )}
                  >
                    {active ? (
                      <motion.span
                        layoutId="hr-tab-pill"
                        className="absolute inset-0 rounded-xl shadow-sm"
                        style={{ backgroundImage: HR_PILL_BG }}
                        transition={m.reduce ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 34 }}
                      />
                    ) : null}
                    <span className="relative inline-flex items-center gap-1.5">
                      <Icon className="size-4" aria-hidden />
                      {t.label}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      ) : null}
      {children}
    </div>
  );
}
