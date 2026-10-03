'use client';

import { Clock, KeyRound, Lock, Mail, ShieldCheck, UserCheck, Users, type LucideIcon } from 'lucide-react';
import { motion } from 'framer-motion';

import { Skeleton } from '@/components/ui/skeleton';
import { type Accent, CountUp, IconChip, PanelCard, ProgressBar, accentVar, tint } from '@/features/members/components/detail/detail-ui';
import type { UserStats, UserStatsPerson, UserStatus } from '../types';

/** System role names are stored as identifiers (`SUPER_ADMIN`, `RECEPTIONIST`); custom roles keep their own casing. */
export function displayRoleName(name: string): string {
  if (name !== name.toUpperCase()) return name;
  const spaced = name.replace(/_/g, ' ').toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

const SYSTEM_ROLE_BLURBS: Record<string, string> = {
  OWNER: 'Full control of the gym, billing and every setting.',
  MANAGER: 'Runs the branch day to day. Everything except billing.',
  RECEPTIONIST: 'Front desk: members, check-ins and payments.',
  TRAINER: 'Workout and diet plans for assigned members.',
  MEMBER: 'Member portal access only.',
  SUPER_ADMIN: 'Platform-level access.',
};

/** One-line description for a role card: friendly copy for system roles, the role's own description otherwise. */
export function roleBlurb(role: { name: string; isSystem: boolean; description: string | null }): string {
  if (role.isSystem && SYSTEM_ROLE_BLURBS[role.name]) return SYSTEM_ROLE_BLURBS[role.name]!;
  return role.description ?? 'No description.';
}

export const STATUS_TONE: Record<UserStatus, Accent> = {
  ACTIVE: 'success',
  PENDING_VERIFICATION: 'warning',
  LOCKED: 'destructive',
  SUSPENDED: 'aqua',
  DEACTIVATED: 'violet',
};

export const STATUS_LABEL: Record<UserStatus, string> = {
  ACTIVE: 'Active',
  PENDING_VERIFICATION: 'Pending verification',
  LOCKED: 'Locked',
  SUSPENDED: 'Suspended',
  DEACTIVATED: 'Deactivated',
};

const STATUS_ORDER: UserStatus[] = ['ACTIVE', 'PENDING_VERIFICATION', 'LOCKED', 'SUSPENDED', 'DEACTIVATED'];
const STATUS_COLOR: Record<UserStatus, string> = {
  ACTIVE: 'var(--success)',
  PENDING_VERIFICATION: 'var(--warning)',
  LOCKED: 'var(--destructive)',
  SUSPENDED: 'var(--chart-3)',
  DEACTIVATED: 'var(--chart-7)',
};

interface Tile {
  key: string;
  label: string;
  icon: LucideIcon;
  accent: Accent;
  value: number;
  status?: UserStatus | '';
}

export function UsersKpis({ stats, loading, status, onStatus }: { stats?: UserStats; loading: boolean; status: UserStatus | ''; onStatus: (s: UserStatus | '') => void }) {
  const tiles: Tile[] = [
    { key: 'total', label: 'Total staff', icon: Users, accent: 'primary', value: stats?.total ?? 0, status: '' },
    { key: 'active', label: 'Active', icon: UserCheck, accent: 'success', value: stats?.byStatus.ACTIVE ?? 0, status: 'ACTIVE' },
    { key: 'pending', label: 'Pending verification', icon: Mail, accent: 'warning', value: stats?.byStatus.PENDING_VERIFICATION ?? 0, status: 'PENDING_VERIFICATION' },
    { key: 'locked', label: 'Locked or suspended', icon: Lock, accent: 'destructive', value: (stats?.byStatus.LOCKED ?? 0) + (stats?.byStatus.SUSPENDED ?? 0) },
    { key: 'mfa', label: 'Two-factor on', icon: ShieldCheck, accent: 'violet', value: stats?.mfaEnabled ?? 0 },
    { key: 'week', label: 'Signed in this week', icon: Clock, accent: 'aqua', value: stats?.signedInThisWeek ?? 0 },
  ];
  return (
    <section aria-label="Staff figures" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      {tiles.map((t, i) => {
        const clickable = t.status !== undefined;
        const active = clickable && status === t.status;
        const Tag = clickable ? 'button' : 'div';
        return (
          <motion.div key={t.key} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} whileHover={{ y: -3 }} transition={{ duration: 0.45, delay: 0.04 * i }}>
            <Tag
              {...(clickable ? { type: 'button' as const, onClick: () => onStatus(t.status!), 'aria-pressed': active } : {})}
              className="block h-full w-full rounded-2xl border p-3.5 text-left shadow-xs transition-shadow hover:shadow-md"
              style={{ backgroundImage: `linear-gradient(160deg, ${tint(t.accent, 13)}, transparent 72%)`, borderColor: active ? accentVar(t.accent) : tint(t.accent, 22), boxShadow: active ? `0 0 0 2px ${tint(t.accent, 35)}` : undefined }}
            >
              <IconChip icon={t.icon} accent={t.accent} className="size-8" />
              <div className="mt-2.5 text-2xl font-extrabold leading-tight tabular-nums" style={{ color: accentVar(t.accent) }}>
                {loading ? <Skeleton className="h-7 w-10" /> : <CountUp value={t.value} />}
              </div>
              <div className="text-xs font-medium text-muted-foreground">{t.label}</div>
            </Tag>
          </motion.div>
        );
      })}
    </section>
  );
}

function BarRows({ rows, accents }: { rows: Array<{ label: string; count: number }>; accents: Accent[] }) {
  const max = Math.max(...rows.map((r) => r.count), 1);
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">No data yet.</p>;
  return (
    <div className="space-y-3">
      {rows.map((r, i) => (
        <div key={r.label} className="space-y-1">
          <div className="flex justify-between text-[12.5px]">
            <b className="font-semibold">{r.label}</b>
            <span className="tabular-nums text-muted-foreground">{r.count}</span>
          </div>
          <ProgressBar percent={(r.count / max) * 100} accent={accents[i % accents.length]!} />
        </div>
      ))}
    </div>
  );
}

function PersonGroup({ title, people, accent }: { title: string; people: UserStatsPerson[]; accent: Accent }) {
  if (people.length === 0) return null;
  return (
    <div>
      <p className="mb-1 text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">{title}</p>
      <ul className="space-y-0.5">
        {people.map((p) => (
          <li key={p.id}>
            <a href={`/users/${p.id}`} className="flex items-center gap-2.5 rounded-lg px-1 py-1.5 transition-colors hover:bg-accent/50">
              <span className="flex size-[30px] shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold text-white" style={{ backgroundImage: `linear-gradient(135deg, ${accentVar(accent)}, var(--chart-7))` }}>
                {p.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase()}
              </span>
              <span className="min-w-0 flex-1 leading-tight">
                <b className="block truncate text-[12.5px] font-semibold">{p.name}</b>
                <small className="text-muted-foreground">{p.detail}</small>
              </span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function UsersInsights({ stats, loading }: { stats?: UserStats; loading: boolean }) {
  if (loading || !stats) return <Skeleton className="h-60 w-full rounded-2xl" />;

  const total = stats.total;
  let acc = 0;
  const stops = STATUS_ORDER.map((s) => {
    const start = acc;
    acc += total > 0 ? (stats.byStatus[s] / total) * 100 : 0;
    return `${STATUS_COLOR[s]} ${start}% ${acc}%`;
  }).join(', ');
  const nothingToFlag = stats.locked.length + stats.pendingVerification.length + stats.dormant.length === 0;
  const s = stats.lastSignIn;

  return (
    <section aria-label="Staff reports" className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      <PanelCard icon={Users} accent="primary" title="Status mix" delay={0.2}>
        <div className="flex flex-wrap items-center justify-center gap-4">
          <div className="grid size-[112px] place-items-center rounded-full" style={{ backgroundImage: total > 0 ? `conic-gradient(${stops})` : `conic-gradient(${tint('primary', 14)} 0 100%)` }} role="img" aria-label={`${stats.byStatus.ACTIVE} active of ${total}`}>
            <div className="grid size-[78px] place-items-center rounded-full bg-card text-center leading-tight">
              <div>
                <b className="block text-[22px] font-extrabold tabular-nums">{total}</b>
                <span className="text-[10.5px] text-muted-foreground">staff</span>
              </div>
            </div>
          </div>
          <ul className="grid gap-1.5 text-[12.5px]">
            {STATUS_ORDER.map((st) => (
              <li key={st} className="flex items-center gap-2">
                <i className="size-2.5 rounded-[3px]" style={{ background: STATUS_COLOR[st] }} />
                {STATUS_LABEL[st]}
                <b className="ml-auto pl-3 tabular-nums">{stats.byStatus[st]}</b>
              </li>
            ))}
          </ul>
        </div>
      </PanelCard>

      <PanelCard icon={KeyRound} accent="violet" title="People by role" delay={0.26}>
        <BarRows rows={stats.byRole.map((r) => ({ label: displayRoleName(r.name), count: r.count }))} accents={['violet', 'primary', 'aqua', 'warning']} />
      </PanelCard>

      <PanelCard icon={Clock} accent="aqua" title="Last sign-in" delay={0.32} right={<span className="rounded-full px-2.5 py-0.5 text-[11px] font-bold tabular-nums" style={{ backgroundColor: tint('aqua', 14), color: 'var(--chart-3)' }}>{total} people</span>}>
        <BarRows
          rows={[
            { label: 'Today', count: s.today },
            { label: 'This week', count: s.thisWeek },
            { label: 'This month', count: s.thisMonth },
            { label: 'Over a month ago', count: s.older },
            { label: 'Never', count: s.never },
          ]}
          accents={['success', 'aqua', 'primary', 'warning', 'destructive']}
        />
      </PanelCard>

      <PanelCard icon={Lock} accent="destructive" title="Needs attention" delay={0.38}>
        {nothingToFlag ? (
          <p className="text-sm text-muted-foreground">Nobody needs attention right now.</p>
        ) : (
          <div className="space-y-3">
            <PersonGroup title="Locked account" people={stats.locked} accent="destructive" />
            <PersonGroup title="Invited, not verified" people={stats.pendingVerification} accent="warning" />
            <PersonGroup title="No sign-in for 30+ days" people={stats.dormant} accent="aqua" />
          </div>
        )}
      </PanelCard>
    </section>
  );
}
