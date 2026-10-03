'use client';

import * as React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { CalendarClock, CircleDollarSign, Clock, Snowflake, UserCheck, UserMinus, UserPlus, UserRound, Users, Wallet, type LucideIcon } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Line, ComposedChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { useCurrencySymbol } from '@/lib/currency';
import type { MemberListItem, MemberStats, MemberStatsPerson, MemberStatus } from '../../types';
import { type Accent, CountUp, IconChip, PanelCard, ProgressBar, accentVar, formatMoney, tint } from '../detail/detail-ui';

const FACE_TONES: Accent[] = ['primary', 'violet', 'aqua', 'destructive', 'warning', 'success'];

export function MembersHero({ total, faces, actions }: { total: number; faces: MemberListItem[]; actions: React.ReactNode }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="relative grid gap-5 overflow-hidden rounded-3xl p-6 text-white shadow-lg lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:px-7"
      style={{ backgroundImage: 'radial-gradient(900px 320px at 88% -30%, color-mix(in oklch, #c026d3 75%, transparent), transparent 60%), linear-gradient(115deg, #4338ca, #7c3aed 62%, #c026d3)' }}
    >
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-60" style={{ backgroundImage: 'repeating-linear-gradient(135deg, rgba(255,255,255,.06) 0 1px, transparent 1px 14px)' }} />
      <div className="relative">
        <p className="text-[11px] font-bold uppercase tracking-widest text-white/80">People</p>
        <h1 className="mt-0.5 text-3xl font-extrabold tracking-tight sm:text-4xl">Members</h1>
        <p className="mt-1 text-white/85">Everyone training at your gym, with dues and renewals at a glance.</p>
        <div className="mt-3.5 flex items-center">
          {faces.slice(0, 6).map((m, i) => (
            <motion.span key={m.id} initial={{ opacity: 0, scale: 0.4 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 * i }} className="-ml-2 first:ml-0">
              <Avatar className="size-[34px] border-2 border-white/90">
                {m.profilePhotoUrl ? <AvatarImage src={m.profilePhotoUrl} alt="" /> : null}
                <AvatarFallback className="text-[11px] font-extrabold text-white" style={{ backgroundImage: `linear-gradient(135deg, ${accentVar(FACE_TONES[i % FACE_TONES.length]!)}, var(--chart-7))` }}>
                  {m.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </motion.span>
          ))}
          {total > faces.length ? <em className="ml-3 text-sm font-semibold not-italic text-white/90">+{total - Math.min(faces.length, 6)} more</em> : null}
        </div>
      </div>
      <div className="relative flex flex-wrap items-center gap-2 [&_button]:border-white/30 [&_button]:bg-white/15 [&_button]:text-white [&_button:hover]:bg-white/25 [&_a]:border-white/30">{actions}</div>
    </motion.section>
  );
}

interface KpiTile {
  key: string;
  label: string;
  icon: LucideIcon;
  accent: Accent;
  value: number;
  money?: boolean;
  status?: MemberStatus | '';
}

export function MembersKpis({ stats, loading, status, onStatus }: { stats?: MemberStats; loading: boolean; status: MemberStatus | ''; onStatus: (s: MemberStatus | '') => void }) {
  const symbol = useCurrencySymbol();
  const tiles: KpiTile[] = [
    { key: 'total', label: 'Total members', icon: Users, accent: 'primary', value: stats?.total ?? 0, status: '' },
    { key: 'active', label: 'Active', icon: UserCheck, accent: 'success', value: stats?.byStatus.ACTIVE ?? 0, status: 'ACTIVE' },
    { key: 'inactive', label: 'Inactive', icon: UserMinus, accent: 'warning', value: stats?.byStatus.INACTIVE ?? 0, status: 'INACTIVE' },
    { key: 'frozen', label: 'Frozen', icon: Snowflake, accent: 'aqua', value: stats?.byStatus.FROZEN ?? 0, status: 'FROZEN' },
    { key: 'new', label: 'New this month', icon: UserPlus, accent: 'violet', value: stats?.newThisMonth ?? 0 },
    { key: 'expiring', label: 'Expiring in 30 days', icon: CalendarClock, accent: 'warning', value: stats?.expiringIn30Days ?? 0 },
    { key: 'dues', label: `With dues${stats ? ` · ${formatMoney(symbol, stats.withDues.amount)}` : ''}`, icon: CircleDollarSign, accent: 'destructive', value: stats?.withDues.count ?? 0 },
    { key: 'today', label: 'Checked in today', icon: Clock, accent: 'aqua', value: stats?.checkedInToday ?? 0 },
  ];
  return (
    <section aria-label="Member figures" className="grid grid-cols-2 gap-3 md:grid-cols-4 2xl:grid-cols-8">
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
                {loading ? <Skeleton className="h-7 w-12" /> : <CountUp value={t.value} />}
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

function PeopleList({ title, people, accent, money }: { title: string; people: MemberStatsPerson[]; accent: Accent; money?: string }) {
  return (
    <div>
      <p className="mb-1 text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">{title}</p>
      {people.length === 0 ? (
        <p className="py-2 text-sm text-muted-foreground">Nobody here right now.</p>
      ) : (
        <ul className="space-y-0.5">
          {people.map((p, i) => (
            <motion.li key={p.id} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.06 * i }}>
              <Link href={`/members/${p.id}`} className="flex items-center gap-2.5 rounded-lg px-1 py-1.5 transition-colors hover:bg-accent/50">
                <span className="flex size-[30px] shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold text-white" style={{ backgroundImage: `linear-gradient(135deg, ${accentVar(accent)}, var(--chart-7))` }}>
                  {p.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase()}
                </span>
                <span className="min-w-0 flex-1 leading-tight">
                  <b className="block truncate text-[12.5px] font-semibold">{p.name}</b>
                  <small className="text-muted-foreground">{money ? `${formatMoney(money, p.detail)} due` : p.detail}</small>
                </span>
              </Link>
            </motion.li>
          ))}
        </ul>
      )}
    </div>
  );
}

const AXIS = { fill: 'var(--muted-foreground)', fontSize: 11 };

export function MembersInsights({ stats, loading }: { stats?: MemberStats; loading: boolean }) {
  const symbol = useCurrencySymbol();
  if (loading || !stats) return <Skeleton className="h-64 w-full rounded-2xl" />;

  const { byStatus, total } = stats;
  const pct = (n: number) => (total > 0 ? (n / total) * 100 : 0);
  const a = pct(byStatus.ACTIVE);
  const b = a + pct(byStatus.FROZEN);

  return (
    <section aria-label="Member reports" className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-12">
      <div className="xl:col-span-3">
        <PanelCard icon={Users} accent="primary" title="Status mix" delay={0.2}>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <div className="grid size-[112px] place-items-center rounded-full" style={{ backgroundImage: total > 0 ? `conic-gradient(var(--success) 0 ${a}%, var(--chart-3) 0 ${b}%, var(--warning) 0 100%)` : `conic-gradient(${tint('primary', 14)} 0 100%)` }} role="img" aria-label={`${byStatus.ACTIVE} active of ${total}`}>
              <div className="grid size-[78px] place-items-center rounded-full bg-card text-center leading-tight">
                <div>
                  <b className="block text-[22px] font-extrabold tabular-nums">{total}</b>
                  <span className="text-[10.5px] text-muted-foreground">members</span>
                </div>
              </div>
            </div>
            <ul className="grid gap-1.5 text-[12.5px]">
              {[
                { l: 'Active', v: byStatus.ACTIVE, c: 'var(--success)' },
                { l: 'Frozen', v: byStatus.FROZEN, c: 'var(--chart-3)' },
                { l: 'Inactive', v: byStatus.INACTIVE, c: 'var(--warning)' },
              ].map((k) => (
                <li key={k.l} className="flex items-center gap-2"><i className="size-2.5 rounded-[3px]" style={{ background: k.c }} />{k.l}<b className="ml-auto pl-3 tabular-nums">{k.v}</b></li>
              ))}
            </ul>
          </div>
        </PanelCard>
      </div>

      <div className="xl:col-span-3">
        <PanelCard icon={UserPlus} accent="violet" title="Joinings, last 6 months" delay={0.26} right={<span className="rounded-full px-2.5 py-0.5 text-[11px] font-bold tabular-nums" style={{ backgroundColor: tint('violet', 14), color: 'var(--chart-7)' }}>+{stats.joinedByMonth.reduce((s, m) => s + m.count, 0)}</span>}>
          <div className="h-[150px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={stats.joinedByMonth}>
                <CartesianGrid strokeDasharray="3 4" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="month" tick={AXIS} tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tick={AXIS} tickLine={false} axisLine={false} width={22} />
                <Tooltip cursor={{ fill: 'var(--accent)', opacity: 0.4 }} contentStyle={{ background: 'var(--popover)', border: '1px solid var(--border)', borderRadius: 12, fontSize: 12 }} />
                <Bar dataKey="count" name="Joined" fill="var(--chart-7)" radius={[5, 5, 0, 0]} animationDuration={900} />
                <Line dataKey="count" stroke="var(--primary)" strokeWidth={2} dot={false} animationDuration={1200} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </PanelCard>
      </div>

      <div className="xl:col-span-2">
        <PanelCard icon={UserRound} accent="aqua" title="Plans" delay={0.32}>
          <BarRows rows={stats.plans.map((p) => ({ label: p.name, count: p.count }))} accents={['aqua', 'primary', 'violet', 'warning']} />
        </PanelCard>
      </div>
      <div className="xl:col-span-2">
        <PanelCard icon={UserRound} accent="destructive" title="Gender" delay={0.38}>
          <BarRows rows={stats.gender} accents={['primary', 'destructive', 'warning']} />
        </PanelCard>
      </div>
      <div className="xl:col-span-2">
        <PanelCard icon={Wallet} accent="warning" title="Heard about us" delay={0.44}>
          <BarRows rows={stats.source} accents={['warning', 'violet', 'aqua', 'primary']} />
        </PanelCard>
      </div>

      <div className="md:col-span-2 xl:col-span-12">
        <PanelCard icon={Clock} accent="destructive" title="Needs attention" delay={0.5}>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <PeopleList title="Not visited in 14 days" people={stats.notVisited14Days} accent="aqua" />
            <PeopleList title="Expiring this week" people={stats.expiringThisWeek} accent="warning" />
            <PeopleList title="Highest dues" people={stats.highestDues} accent="destructive" money={symbol} />
          </div>
        </PanelCard>
      </div>
    </section>
  );
}
