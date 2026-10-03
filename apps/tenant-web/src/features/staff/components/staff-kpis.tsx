'use client';

import { Lock, Mail, UserCheck, Users, type LucideIcon } from 'lucide-react';
import { motion } from 'framer-motion';

import { Skeleton } from '@/components/ui/skeleton';
import { type Accent, CountUp, IconChip, accentVar, tint } from '@/features/members/components/detail/detail-ui';
import { useStaffList } from '../hooks/use-staff';
import type { UserStatus } from '../types';

interface Tile {
  key: string;
  label: string;
  icon: LucideIcon;
  accent: Accent;
  value: number;
  loading: boolean;
  status?: UserStatus | '';
}

/**
 * Four tiles, each just reading `.total` off the EXISTING `/staff` list
 * endpoint with a different status filter (`limit: 1` — only the count is
 * used) — no new backend endpoint, same data the list itself already
 * returns, just asked once per status instead of once unfiltered.
 */
export function StaffKpis({
  branchId,
  status,
  onStatus,
}: {
  branchId?: string;
  status: UserStatus | '';
  onStatus: (s: UserStatus | '') => void;
}) {
  const total = useStaffList({ page: 1, limit: 1, branchId, includeDeleted: true });
  const active = useStaffList({ page: 1, limit: 1, status: 'ACTIVE', branchId });
  const pending = useStaffList({ page: 1, limit: 1, status: 'PENDING_VERIFICATION', branchId });
  const locked = useStaffList({ page: 1, limit: 1, status: 'LOCKED', branchId });
  const suspended = useStaffList({ page: 1, limit: 1, status: 'SUSPENDED', branchId });

  const tiles: Tile[] = [
    { key: 'total', label: 'Total staff', icon: Users, accent: 'primary', value: total.data?.total ?? 0, loading: total.isPending, status: '' },
    { key: 'active', label: 'Active', icon: UserCheck, accent: 'success', value: active.data?.total ?? 0, loading: active.isPending, status: 'ACTIVE' },
    { key: 'pending', label: 'Pending verification', icon: Mail, accent: 'warning', value: pending.data?.total ?? 0, loading: pending.isPending, status: 'PENDING_VERIFICATION' },
    {
      key: 'locked',
      label: 'Locked or suspended',
      icon: Lock,
      accent: 'destructive',
      value: (locked.data?.total ?? 0) + (suspended.data?.total ?? 0),
      loading: locked.isPending || suspended.isPending,
    },
  ];

  return (
    <section aria-label="Staff figures" className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {tiles.map((t, i) => {
        const clickable = t.status !== undefined;
        const active = clickable && status === t.status;
        const Tag = clickable ? 'button' : 'div';
        return (
          <motion.div key={t.key} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} whileHover={{ y: -3 }} transition={{ duration: 0.45, delay: 0.04 * i }}>
            <Tag
              {...(clickable ? { type: 'button' as const, onClick: () => onStatus(t.status!), 'aria-pressed': active } : {})}
              className="block h-full w-full rounded-2xl border p-3.5 text-left shadow-xs transition-shadow hover:shadow-md"
              style={{
                backgroundImage: `linear-gradient(160deg, ${tint(t.accent, 13)}, transparent 72%)`,
                borderColor: active ? accentVar(t.accent) : tint(t.accent, 22),
                boxShadow: active ? `0 0 0 2px ${tint(t.accent, 35)}` : undefined,
              }}
            >
              <IconChip icon={t.icon} accent={t.accent} className="size-8" />
              <div className="mt-2.5 text-2xl font-extrabold leading-tight tabular-nums" style={{ color: accentVar(t.accent) }}>
                {t.loading ? <Skeleton className="h-7 w-10" /> : <CountUp value={t.value} />}
              </div>
              <div className="text-xs font-medium text-muted-foreground">{t.label}</div>
            </Tag>
          </motion.div>
        );
      })}
    </section>
  );
}
