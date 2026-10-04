'use client';

import { motion } from 'framer-motion';
import { AlertTriangle, CalendarClock, CheckCircle2, FileEdit, Hourglass, Timer } from 'lucide-react';
import * as React from 'react';

import { DonutChart, GroupedBarChart, HBarChart, TrendCompareChart } from '@/features/reports/charts';
import { ChartCard, KpiTile, StaggerGroup } from '@/features/reports/components/ui';
import { shortDate } from '@/features/reports/lib/format';
import { accentColor, seriesColor } from '@/features/reports/lib/reports-theme';
import { cn } from '@/lib/utils';
import type { AnnouncementStats, AnnouncementStatus } from '../../types';
import { AUDIENCE_META, COMM_COLOR, STATUS_META, expiryRelative, fmtDateTime, relativeTo, tint, useNow } from '../../lib/announcement-meta';
import { useMotionSafe } from '@/features/reports/lib/motion';

export interface InsightsState {
  stats: AnnouncementStats | undefined;
  loading: boolean;
}

const STATUS_ORDER: AnnouncementStatus[] = ['PUBLISHED', 'SCHEDULED', 'DRAFT', 'EXPIRED'];

/** Analytics section: KPI tiles + charts + upcoming/expiring/reach lists. All numbers come from `GET /tenant-announcements/stats`. */
export function AnnouncementInsights({ stats, loading, compare, previousLabel }: InsightsState & { compare: boolean; previousLabel: string }) {
  const k = stats?.kpis;
  const prev = (n: number | undefined) => (compare && n !== undefined ? n : null);
  const sparkline = React.useMemo(() => (stats?.daily ?? []).map((d) => d.published), [stats]);
  const trend = React.useMemo(
    () => (stats?.daily ?? []).map((d) => ({ label: shortDate(d.date), value: d.published, previous: compare ? d.previousPublished : undefined, tip: shortDate(d.date, { weekday: 'short', day: 'numeric', month: 'short' }) })),
    [stats, compare],
  );
  const statusData = React.useMemo(
    () => STATUS_ORDER.map((s) => ({ label: STATUS_META[s].label, value: stats?.byStatus.find((b) => b.status === s)?.count ?? 0, color: STATUS_META[s].color })),
    [stats],
  );
  const audienceData = React.useMemo(
    () => (stats?.byAudience ?? []).map((a) => ({ label: AUDIENCE_META[a.audience].short, value: a.count, previous: compare ? a.previousCount : undefined })),
    [stats, compare],
  );
  const branchData = (stats?.byBranch ?? []).map((b) => ({ label: b.name, value: b.count }));

  return (
    <div className="space-y-4">
      <StaggerGroup className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <KpiTile label="Published" value={k?.published.value ?? 0} previous={prev(k?.published.previous)} icon={CheckCircle2} accent="finance" sparkline={sparkline} hint="this period" loading={loading} />
        <KpiTile label="Scheduled" value={k?.scheduled.value ?? 0} icon={CalendarClock} accent="operations" hint="queued to go out" loading={loading} />
        <KpiTile label="Drafts" value={k?.drafts.value ?? 0} icon={FileEdit} accent="analytics" hint="not yet sent" loading={loading} />
        <KpiTile label="Expired" value={k?.expired.value ?? 0} icon={Hourglass} accent="staff" hint="past expiry" loading={loading} />
        <KpiTile label="Expiring soon" value={k?.expiringSoon.value ?? 0} icon={AlertTriangle} accent="attendance" hint="needs a look" loading={loading} />
      </StaggerGroup>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ChartCard className="lg:col-span-2" title="Publishing trend" subtitle={compare ? `Published per day vs ${previousLabel.toLowerCase()}` : 'Published per day'} loading={loading} empty={!trend.length} emptyText="Nothing published in this period">
          <TrendCompareChart data={trend} color={COMM_COLOR} currentLabel="Published" previousLabel={previousLabel} showPrevious={compare} cumulativeToggle height={260} />
        </ChartCard>
        <ChartCard title="By status" subtitle="All announcements right now" loading={loading} empty={statusData.every((d) => d.value === 0)} emptyText="No announcements yet">
          <DonutChart data={statusData} centerLabel="Total" centerValue={String(statusData.reduce((a, d) => a + d.value, 0))} />
        </ChartCard>
      </div>

      <div className={cn('grid grid-cols-1 gap-4', branchData.length > 0 && 'lg:grid-cols-2')}>
        <ChartCard title="Audience" subtitle={compare ? `Published by audience vs ${previousLabel.toLowerCase()}` : 'Published by audience'} loading={loading} empty={!audienceData.length} emptyText="No published announcements in this period">
          <GroupedBarChart data={audienceData} color={seriesColor(2)} currentLabel="This period" previousLabel={previousLabel} height={230} />
        </ChartCard>
        {branchData.length > 0 || loading ? (
          <ChartCard title="By branch" subtitle="Branch-targeted announcements" loading={loading} empty={!branchData.length}>
            <HBarChart data={branchData} color={accentColor('operations')} />
          </ChartCard>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <ChartCard title="Upcoming" subtitle="Next scheduled to go out" loading={loading} empty={!stats?.upcoming.length} emptyText="Nothing scheduled">
          <TimelineList
            tone="var(--chart-2)"
            icon={Timer}
            rows={(stats?.upcoming ?? []).map((u) => ({ id: u.id, title: u.title, audience: u.audience, when: u.publishAt, kind: 'upcoming' as const }))}
          />
        </ChartCard>
        <ChartCard title="Expiring soon" subtitle="Live announcements about to expire" loading={loading} empty={!stats?.expiring.length} emptyText="Nothing is about to expire">
          <TimelineList
            tone={accentColor('attendance')}
            icon={Hourglass}
            rows={(stats?.expiring ?? []).map((u) => ({ id: u.id, title: u.title, audience: u.audience, when: u.expiresAt, kind: 'expiring' as const }))}
          />
        </ChartCard>
        <ChartCard className="lg:col-span-2 xl:col-span-1" title="Recent reach" subtitle="Delivered and read, latest published" loading={loading} empty={!stats?.recent.length} emptyText="Nothing published yet">
          <ReachList rows={stats?.recent ?? []} />
        </ChartCard>
      </div>
    </div>
  );
}

interface TimelineRow {
  id: string;
  title: string;
  audience: keyof typeof AUDIENCE_META;
  when: string;
  kind: 'upcoming' | 'expiring';
}

function TimelineList({ rows, tone, icon: Icon }: { rows: TimelineRow[]; tone: string; icon: typeof Timer }) {
  const m = useMotionSafe();
  const now = useNow();
  return (
    <motion.ul className="relative space-y-2" variants={m.staggerContainer(0.07)} initial={m.initial} animate="show">
      {rows.map((r) => {
        const AIcon = AUDIENCE_META[r.audience].icon;
        return (
          <motion.li key={r.id} variants={m.listItem} className="flex items-center gap-3 rounded-xl border p-2.5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: tint(tone, 15), color: tone }}>
              <Icon className="size-4" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold">{r.title}</p>
              <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                <AIcon className="size-3" aria-hidden /> {AUDIENCE_META[r.audience].short} · {r.kind === 'upcoming' ? fmtDateTime(r.when) : new Date(r.when).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
              </p>
            </div>
            <span className="shrink-0 rounded-full px-2.5 py-1 text-xs font-extrabold tabular-nums" style={{ backgroundColor: tint(tone, 15), color: tone }}>
              {r.kind === 'upcoming' ? relativeTo(r.when, now) : expiryRelative(r.when, now).replace(/^in /, '')}
            </span>
          </motion.li>
        );
      })}
    </motion.ul>
  );
}

function ReachList({ rows }: { rows: AnnouncementStats['recent'] }) {
  const m = useMotionSafe();
  return (
    <motion.ul className="space-y-3" variants={m.staggerContainer(0.07)} initial={m.initial} animate="show">
      {rows.map((r) => {
        // delivered/read are null when announcements can't be linked to member notifications: show a dash, never a fake bar.
        const known = r.delivered !== null && r.read !== null;
        const pct = known && r.delivered! > 0 ? Math.min(100, Math.round((r.read! / r.delivered!) * 100)) : 0;
        return (
          <motion.li key={r.id} variants={m.listItem}>
            <div className="flex items-baseline justify-between gap-2">
              <p className="truncate text-sm font-bold">{r.title}</p>
              <p className="shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">{known ? `${r.read!.toLocaleString()} / ${r.delivered!.toLocaleString()} read` : '—'}</p>
            </div>
            {known ? (
              <div className="mt-1.5 h-2 overflow-hidden rounded-full" style={{ backgroundColor: tint(COMM_COLOR, 18) }} role="img" aria-label={`${pct}% read`}>
                <motion.div
                  className="h-full origin-left rounded-full"
                  style={{ width: `${pct}%`, backgroundImage: `linear-gradient(90deg, ${COMM_COLOR}, var(--chart-3))` }}
                  initial={m.reduce ? false : { scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: 0.7, ease: [0.2, 0.8, 0.2, 1] }}
                />
              </div>
            ) : null}
            <p className="mt-1 text-[11px] text-muted-foreground">
              {AUDIENCE_META[r.audience].short} · {fmtDateTime(r.publishedAt)}
              {known ? ` · ${pct}%` : ''}
            </p>
          </motion.li>
        );
      })}
    </motion.ul>
  );
}

