'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { Building2, Globe, Mail, MapPin, Phone } from 'lucide-react';
import { toast } from 'sonner';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { Button } from '@/components/ui/button';
import { toBillingError, useDownloadInvoicePdf } from '@/features/billing/hooks/use-billing';
import { fmtCompact, fmtInt, fmtMoney, fmtMoneyCompact, timeAgo } from '@/features/dashboard/components/format';
import { Bar, ChartTooltip, Chip, CountUp, EmptyNote, Panel, type ChipTone } from '@/features/dashboard/components/ui';
import { useNow } from '@/features/dashboard/components/use-now';
import { useTenantOverview, type TenantOverview } from '@/features/tenants/api/detail';
import { useTenant } from '@/features/tenants/hooks/use-tenants';
import type { TenantDetail } from '@/features/tenants/types';
import { ControlPanel } from '../controls/control-panel';

const AXIS = { fontSize: 11, fill: 'var(--muted-foreground)' } as const;
const barColor = (pct: number | null) => (pct === null ? 'var(--chart-1)' : pct >= 90 ? 'var(--chart-5)' : pct >= 80 ? 'var(--chart-4)' : 'var(--chart-1)');
const INV_TONE: Record<string, ChipTone> = { PAID: 'green', OPEN: 'amber', VOID: 'slate', FAILED: 'red' };
const FAMILY_COLOR: Record<string, string> = { access: 'var(--chart-4)', subscription: 'var(--chart-2)', billing: 'var(--chart-6)', limits: 'var(--chart-3)', modules: 'var(--chart-8)', notes: 'var(--chart-7)', other: 'var(--chart-1)' };
const monthLabel = (m: string) => new Date(`${m}-01T00:00:00Z`).toLocaleDateString('en-IN', { month: 'short', timeZone: 'UTC' });

function Kpi({ label, color, index, children, sub }: { label: string; color: string; index: number; children: React.ReactNode; sub: React.ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, delay: reduce ? 0 : index * 0.03 }}
      className="min-w-0 rounded-[14px] border border-t-[3px] bg-card px-4 py-3"
      style={{ borderTopColor: color }}
    >
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-[22px] font-semibold leading-tight tabular-nums">{children}</p>
      <p className="mt-0.5 truncate text-xs text-muted-foreground">{sub}</p>
    </motion.div>
  );
}

function Row({ label, value, color, pct, note, reduce }: { label: string; value: React.ReactNode; color: string; pct: number; note?: React.ReactNode; reduce: boolean }) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2 text-[12.5px]"><span className="flex items-center gap-1.5">{label}{note}</span><b className="font-mono">{value}</b></div>
      <div className="overflow-hidden rounded-full bg-muted" style={{ height: 8 }} role="presentation">
        <motion.div className="h-full origin-left rounded-full" style={{ background: color, width: `${Math.max(0, Math.min(100, pct))}%` }} initial={reduce ? false : { scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.6, delay: 0.1, ease: 'easeOut' }} />
      </div>
    </div>
  );
}

export function UsageBars({ usage, reduce }: { usage: TenantOverview['usage']; reduce: boolean }) {
  return (
    <div className="space-y-3">
      {usage.map((u) => {
        const notTracked = u.used === null;
        const unit = u.key === 'storage_gb' ? ' GB' : '';
        return (
          <Row
            key={u.key}
            reduce={reduce}
            label={u.label}
            note={u.overridden ? <Chip tone="violet">overridden</Chip> : null}
            color={barColor(u.pct)}
            pct={u.pct ?? 0}
            value={notTracked ? <span className="text-muted-foreground" title="Storage consumption is not measured yet — only the limit is real">Not tracked{u.limit !== null ? ` · limit ${fmtInt(u.limit)}${unit}` : ''}</span> : `${fmtInt(u.used ?? 0)} / ${u.limit === null ? 'no limit' : `${fmtInt(u.limit)}${unit}`}${u.pct !== null && u.pct >= 80 ? ` · ${Math.round(u.pct)}%` : ''}`}
          />
        );
      })}
    </div>
  );
}

function HealthRing({ score, reduce }: { score: number; reduce: boolean }) {
  const r = 30; const c = 2 * Math.PI * r;
  const color = score >= 75 ? 'var(--chart-6)' : score >= 50 ? 'var(--chart-4)' : 'var(--chart-5)';
  return (
    <svg viewBox="0 0 80 80" className="size-[84px] shrink-0" role="img" aria-label={`Health score ${score} out of 100`}>
      <circle cx="40" cy="40" r={r} fill="none" stroke="var(--muted)" strokeWidth="8" />
      <motion.circle cx="40" cy="40" r={r} fill="none" stroke={color} strokeWidth="8" strokeLinecap="round" transform="rotate(-90 40 40)" strokeDasharray={c} initial={reduce ? false : { strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - score / 100) }} transition={{ duration: 0.7, ease: 'easeOut' }} />
      <text x="40" y="45" textAnchor="middle" className="fill-foreground text-[20px] font-semibold">{score}</text>
    </svg>
  );
}

function GymProfile({ tenant }: { tenant: TenantDetail }) {
  const p = tenant.profile;
  const address = p ? [p.addressLine, p.city, p.state, p.country, p.postalCode].filter(Boolean) : [];
  const empty = !p || (!p.legalBusinessName && !p.email && address.length === 0 && !p.phone);
  return (
    <Panel title="Gym profile" hint={<Building2 className="inline size-3.5" aria-hidden />} index={6}>
      {empty ? <p className="text-sm text-muted-foreground">No gym profile filled in yet — the tenant hasn&apos;t completed Gym Settings → Profile.</p> : (
        <div className="space-y-1.5 text-sm">
          {p?.legalBusinessName ? <p className="text-base font-medium">{p.legalBusinessName}</p> : null}
          {p?.businessType ? <p className="text-xs text-muted-foreground">{p.businessType}</p> : null}
          {p?.description ? <p className="text-muted-foreground">{p.description}</p> : null}
          {p?.email ? <p className="flex items-center gap-2"><Mail className="size-3.5 text-muted-foreground" aria-hidden />{p.email}</p> : null}
          {p?.phone ? <p className="flex items-center gap-2"><Phone className="size-3.5 text-muted-foreground" aria-hidden />{p.phone}{p.alternatePhone ? ` / ${p.alternatePhone}` : ''}</p> : null}
          {p?.website ? <p className="flex items-center gap-2"><Globe className="size-3.5 text-muted-foreground" aria-hidden />{p.website}</p> : null}
          {address.length ? <p className="flex items-start gap-2"><MapPin className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />{address.join(', ')}</p> : null}
          {p?.registrationNumber || p?.gstVatNumber ? <p className="border-t pt-2 text-xs text-muted-foreground">{p.registrationNumber ? `Reg. no: ${p.registrationNumber}` : ''}{p.registrationNumber && p.gstVatNumber ? ' · ' : ''}{p.gstVatNumber ? `GST/VAT: ${p.gstVatNumber}` : ''}</p> : null}
        </div>
      )}
    </Panel>
  );
}

function Branches({ tenant }: { tenant: TenantDetail }) {
  return (
    <Panel title="Branches" hint={`${tenant.branches.length}`} index={7}>
      {tenant.branches.length === 0 ? <EmptyNote>No branches yet.</EmptyNote> : (
        <ul className="divide-y text-sm">
          {tenant.branches.map((b) => (
            <li key={b.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
              <span className="min-w-0 flex-1"><span className="block truncate font-medium">{b.name}</span><span className="block truncate text-xs text-muted-foreground">{b.branchCode} · {[b.city, b.state, b.country].filter(Boolean).join(', ') || 'no location'}</span></span>
              {b.capacity ? <span className="text-xs text-muted-foreground">cap {b.capacity}</span> : null}
              {b.isDefault ? <Chip tone="blue">Default</Chip> : null}
              <Chip tone={b.isActive ? 'green' : 'slate'}>{b.isActive ? 'Active' : 'Inactive'}</Chip>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function OverviewSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading overview">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-[92px] animate-pulse rounded-[14px] bg-muted" />)}</div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]"><div className="space-y-4"><div className="h-52 animate-pulse rounded-[14px] bg-muted" /><div className="h-64 animate-pulse rounded-[14px] bg-muted" /></div><div className="h-96 animate-pulse rounded-[14px] bg-muted" /></div>
    </div>
  );
}

export function OverviewTab({ tenantId, canManage, onOpenTab }: { tenantId: string; canManage: boolean; onOpenTab: (tab: string) => void }) {
  const reduce = !!useReducedMotion();
  const now = useNow();
  const q = useTenantOverview(tenantId);
  const detail = useTenant(tenantId);
  const pdf = useDownloadInvoicePdf(tenantId);

  if (q.isLoading) return <OverviewSkeleton />;
  if (q.isError || !q.data) return <EmptyNote>Could not load the tenant overview. Try reloading the page.</EmptyNote>;
  const d = q.data;
  const k = d.kpis;
  const e = d.engagement;
  const mrrPoints = d.growth.months.some((m) => m.mrr !== null && m.mrr !== undefined);
  const growth = d.growth.months.map((m) => ({ ...m, label: monthLabel(m.month), mrr: m.mrr === null ? null : Number(m.mrr) }));
  const maxCheck = Math.max(1, ...e.dailyCheckIns.map((c) => c.count));
  const health = k.healthScore;
  const healthLabel = health >= 75 ? 'Healthy' : health >= 50 ? 'Needs attention' : 'At risk';
  const hc = d.health.components;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi index={0} color="var(--chart-1)" label="MRR" sub={d.tenant.plan ? `${d.tenant.plan} plan` : 'no active plan'}>{k.mrr === null ? '—' : <CountUp value={Number(k.mrr)} format={fmtMoneyCompact} />}</Kpi>
        <Kpi index={1} color="var(--chart-2)" label="Lifetime revenue" sub="paid to FitCloud"><CountUp value={Number(k.lifetimeRevenue)} format={fmtMoneyCompact} /></Kpi>
        <Kpi index={2} color="var(--chart-6)" label="Members" sub={`${fmtInt(e.activeMembers)} active in 30 days`}><CountUp value={k.memberCount} format={fmtInt} /></Kpi>
        <Kpi index={3} color="var(--chart-3)" label="Staff · Branches" sub={[d.usage.find((u) => u.key === 'staff'), d.usage.find((u) => u.key === 'branches')].map((u) => (u?.limit != null ? `limit ${u.limit}` : '∞')).join(' · ')}>{k.staffCount} · {k.branchCount}</Kpi>
        <Kpi index={4} color="var(--chart-4)" label="Last active" sub={`${e.staffLoginsPerWeek} staff logins this week`}>{k.lastActiveAt ? (now === null ? '—' : timeAgo(new Date(k.lastActiveAt).getTime(), now)) : 'Never'}</Kpi>
        <Kpi index={5} color={health >= 75 ? 'var(--chart-6)' : health >= 50 ? 'var(--chart-4)' : 'var(--chart-5)'} label="Health score" sub={healthLabel}><CountUp value={health} format={(v) => String(Math.round(v))} /><span className="text-[13px] font-normal text-muted-foreground"> / 100</span></Kpi>
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_390px]">
        <div className="min-w-0 space-y-4">
          <Panel title="Usage vs plan limits" hint={d.tenant.plan ? `${d.tenant.plan} plan` : undefined} index={0}>
            {d.usage.length === 0 ? <EmptyNote>No usage data.</EmptyNote> : <UsageBars usage={d.usage} reduce={reduce} />}
          </Panel>

          <div className="grid gap-4 md:grid-cols-2">
            <Panel title="Engagement" hint="last 30 days" index={1}>
              <div className="flex h-[84px] items-end gap-[3px]" role="img" aria-label={`Daily check-ins over the last 30 days, average ${e.avgDailyCheckIns}`}>
                {e.dailyCheckIns.map((c, i) => (
                  <motion.div key={c.date} title={`${c.date}: ${c.count} check-ins`} className="min-h-[2px] flex-1 origin-bottom rounded-t-[3px]" style={{ height: `${(c.count / maxCheck) * 100}%`, background: 'var(--chart-6)', opacity: c.count === 0 ? 0.25 : 0.5 + 0.5 * (c.count / maxCheck) }} initial={reduce ? false : { scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ duration: 0.4, delay: reduce ? 0 : Math.min(i, 30) * 0.008 }} />
                ))}
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-[12.5px]">
                {[['Daily check-ins', `${Math.round(e.avgDailyCheckIns * 10) / 10} avg`], ['Active members', `${e.activeMembers} / ${e.totalMembers}`], ['Staff logins / wk', String(e.staffLoginsPerWeek)], ['Payments recorded', String(e.paymentsRecorded30d)]].map(([a, b]) => (
                  <div key={a}><dt className="text-muted-foreground">{a}</dt><dd className="font-mono font-semibold">{b}</dd></div>
                ))}
              </dl>
            </Panel>
            <Panel title="Health score breakdown" hint={`${d.health.score} / 100`} index={2}>
              <div className="flex items-center gap-4">
                <HealthRing score={d.health.score} reduce={reduce} />
                <div className="min-w-0 flex-1 space-y-2.5">
                  <Row reduce={reduce} label="Engagement" value={hc.engagement} pct={hc.engagement} color="var(--chart-3)" />
                  <Row reduce={reduce} label="Billing standing" value={hc.billing} pct={hc.billing} color="var(--chart-6)" />
                  <Row reduce={reduce} label="Plan utilisation" value={hc.utilisation} pct={hc.utilisation} color="var(--chart-2)" />
                  <Row reduce={reduce} label="Support load" value={hc.support} pct={hc.support} color="var(--chart-4)" />
                </div>
              </div>
            </Panel>
          </div>

          <Panel title="Growth" hint={mrrPoints ? 'members & MRR, last 6 months' : 'members, last 6 months (MRR history is not recorded)'} index={3}>
            <div className="h-[190px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={growth} margin={{ left: -8, right: mrrPoints ? -8 : 8, top: 8 }}>
                  <CartesianGrid stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} />
                  <YAxis yAxisId="m" tick={AXIS} tickLine={false} axisLine={false} allowDecimals={false} width={40} />
                  {mrrPoints ? <YAxis yAxisId="r" orientation="right" tick={AXIS} tickLine={false} axisLine={false} width={48} tickFormatter={(v: number) => fmtCompact(v)} /> : null}
                  <Tooltip content={<ChartTooltip fmt={(v) => fmtInt(v)} names={{ members: 'Members', mrr: 'MRR' }} />} />
                  <Line yAxisId="m" dataKey="members" stroke="var(--chart-1)" strokeWidth={2.5} dot={{ r: 3 }} isAnimationActive={!reduce} animationDuration={600} />
                  {mrrPoints ? <Line yAxisId="r" dataKey="mrr" stroke="var(--chart-2)" strokeWidth={2.5} strokeDasharray="6 4" dot={false} connectNulls isAnimationActive={!reduce} /> : null}
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-1 flex gap-4 text-xs"><span style={{ color: 'var(--chart-1)' }}>━ Members</span>{mrrPoints ? <span style={{ color: 'var(--chart-2)' }}>╌ MRR</span> : null}</div>
          </Panel>

          <Panel title="Subscription & billing" hint="latest invoices" right={<Button size="sm" variant="outline" onClick={() => onOpenTab('billing')}>All billing</Button>} index={4}>
            {d.invoices.length === 0 ? <EmptyNote>No invoices yet.</EmptyNote> : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[420px] text-[13px]">
                  <thead><tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground"><th className="py-2 font-semibold">Invoice</th><th className="font-semibold">Issued</th><th className="font-semibold">Amount</th><th className="font-semibold">Status</th><th /></tr></thead>
                  <tbody>
                    {d.invoices.map((i) => (
                      <tr key={i.id} className="border-t">
                        <td className="py-2 font-mono text-xs">{i.number}</td>
                        <td>{new Date(i.issuedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                        <td className="font-mono text-xs">{fmtMoney(i.amount)}</td>
                        <td><Chip tone={INV_TONE[i.status] ?? 'slate'}>{i.status.toLowerCase()}</Chip></td>
                        <td className="text-right"><Button size="sm" variant="outline" className="h-7 px-2 text-xs" disabled={pdf.isPending} onClick={() => pdf.mutate({ invoiceId: i.id, invoiceNumber: i.number }, { onError: (err) => toast.error(toBillingError(err).message) })}>PDF</Button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <Panel title="Activity" hint="audit trail for this tenant" right={<Button size="sm" variant="outline" onClick={() => onOpenTab('activity')}>Full activity</Button>} index={5}>
            {d.timeline.length === 0 ? <EmptyNote>No recorded activity yet.</EmptyNote> : (
              <ol className="divide-y text-[12.5px]">
                {d.timeline.map((t, i) => (
                  <li key={`${t.at}-${i}`} className="flex gap-2.5 py-2">
                    <i className="mt-1.5 size-2 shrink-0 rounded-full" style={{ background: FAMILY_COLOR[t.family] ?? FAMILY_COLOR.other }} aria-hidden />
                    <span className="min-w-0 flex-1"><b>{t.actor}</b> {t.summary}</span>
                    <time dateTime={t.at} className="shrink-0 font-mono text-[11px] text-muted-foreground">{new Date(t.at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</time>
                  </li>
                ))}
              </ol>
            )}
          </Panel>

          {detail.data ? <div className="grid gap-4 md:grid-cols-2"><GymProfile tenant={detail.data} /><Branches tenant={detail.data} /></div> : detail.isLoading ? <div className="h-32 animate-pulse rounded-[14px] bg-muted" /> : null}
        </div>

        <div className="min-w-0">
          <ControlPanel tenant={d.tenant} canManage={canManage} />
        </div>
      </div>
    </div>
  );
}
