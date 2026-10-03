'use client';

import { motion } from 'framer-motion';
import { Building2, CheckCircle2, Fingerprint, RadioTower, Tag, XCircle, type LucideIcon } from 'lucide-react';

import { Skeleton } from '@/components/ui/skeleton';
import { type Accent, CountUp, IconChip, PanelCard, ProgressBar, accentVar, tint } from '@/features/members/components/detail/detail-ui';
import type { AttendanceDevice, AttendanceDeviceVendor } from '../types';

const VENDOR_LABELS: Record<AttendanceDeviceVendor, string> = {
  ZKTECO: 'ZKTeco',
  ESSL: 'eSSL',
  GENERIC: 'Generic',
  OTHER: 'Other',
};

/** A device counts as "synced recently" inside 24h of its last punch — matches the page's own `formatLastSeen` threshold for "Synced Xh ago" vs falling back to a bare date. */
function isSyncedRecently(lastSeenAt: string | null): boolean {
  if (!lastSeenAt) return false;
  return Date.now() - new Date(lastSeenAt).getTime() < 24 * 60 * 60 * 1000;
}

interface KpiTile {
  key: string;
  label: string;
  icon: LucideIcon;
  accent: Accent;
  value: number;
  status?: 'true' | 'false' | '';
}

export function AttendanceDevicesKpis({
  devices,
  loading,
  isActiveFilter,
  onStatus,
}: {
  devices: AttendanceDevice[];
  loading: boolean;
  isActiveFilter: 'true' | 'false' | '';
  onStatus: (v: 'true' | 'false' | '') => void;
}) {
  const active = devices.filter((d) => d.isActive).length;
  const disabled = devices.length - active;
  const syncedRecently = devices.filter((d) => isSyncedRecently(d.lastSeenAt)).length;

  const tiles: KpiTile[] = [
    { key: 'total', label: 'Total devices', icon: Fingerprint, accent: 'primary', value: devices.length, status: '' },
    { key: 'active', label: 'Active', icon: CheckCircle2, accent: 'success', value: active, status: 'true' },
    { key: 'disabled', label: 'Disabled', icon: XCircle, accent: 'warning', value: disabled, status: 'false' },
    { key: 'synced', label: 'Synced in last 24h', icon: RadioTower, accent: 'aqua', value: syncedRecently },
  ];

  return (
    <section aria-label="Device figures" className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {tiles.map((t, i) => {
        const clickable = t.status !== undefined;
        const isOn = clickable && isActiveFilter === t.status;
        const Tag = clickable ? 'button' : 'div';
        return (
          <motion.div key={t.key} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} whileHover={{ y: -3 }} transition={{ duration: 0.45, delay: 0.04 * i }}>
            <Tag
              {...(clickable ? { type: 'button' as const, onClick: () => onStatus(t.status!), 'aria-pressed': isOn } : {})}
              className="block h-full w-full rounded-2xl border p-3.5 text-left shadow-xs transition-shadow hover:shadow-md"
              style={{
                backgroundImage: `linear-gradient(160deg, ${tint(t.accent, 13)}, transparent 72%)`,
                borderColor: isOn ? accentVar(t.accent) : tint(t.accent, 22),
                boxShadow: isOn ? `0 0 0 2px ${tint(t.accent, 35)}` : undefined,
              }}
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

function BarRows({ rows, accent }: { rows: Array<{ label: string; count: number }>; accent: Accent }) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">No data yet.</p>;
  const max = Math.max(...rows.map((r) => r.count), 1);
  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <div key={r.label} className="space-y-1">
          <div className="flex justify-between text-[12.5px]">
            <b className="truncate pr-2 font-semibold">{r.label}</b>
            <span className="shrink-0 tabular-nums text-muted-foreground">{r.count}</span>
          </div>
          <ProgressBar percent={(r.count / max) * 100} accent={accent} />
        </div>
      ))}
    </div>
  );
}

export function AttendanceDevicesInsights({ devices, loading }: { devices: AttendanceDevice[]; loading: boolean }) {
  if (loading) {
    return (
      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-60 w-full rounded-2xl" />)}
      </section>
    );
  }

  const active = devices.filter((d) => d.isActive).length;
  const disabled = devices.length - active;
  const total = devices.length;
  const activePct = total > 0 ? (active / total) * 100 : 0;

  const vendorCounts = new Map<AttendanceDeviceVendor, number>();
  devices.forEach((d) => vendorCounts.set(d.vendor, (vendorCounts.get(d.vendor) ?? 0) + 1));
  const vendorRows = [...vendorCounts.entries()].map(([vendor, count]) => ({ label: VENDOR_LABELS[vendor], count }));

  const branchCounts = new Map<string, number>();
  devices.forEach((d) => branchCounts.set(d.branchName, (branchCounts.get(d.branchName) ?? 0) + 1));
  const branchRows = [...branchCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([label, count]) => ({ label, count }));

  return (
    <section aria-label="Device reports" className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <PanelCard icon={Fingerprint} accent="primary" title="Status mix" delay={0.2}>
        <div className="flex flex-wrap items-center justify-center gap-4">
          <div className="grid size-[112px] place-items-center rounded-full" style={{ backgroundImage: total > 0 ? `conic-gradient(var(--success) 0% ${activePct}%, var(--warning) ${activePct}% 100%)` : `conic-gradient(${tint('primary', 14)} 0 100%)` }} role="img" aria-label={`${active} active of ${total}`}>
            <div className="grid size-[78px] place-items-center rounded-full bg-card text-center leading-tight">
              <div>
                <b className="block text-[22px] font-extrabold tabular-nums">{total}</b>
                <span className="text-[10.5px] text-muted-foreground">devices</span>
              </div>
            </div>
          </div>
          <ul className="grid gap-1.5 text-[12.5px]">
            <li className="flex items-center gap-2"><i className="size-2.5 rounded-[3px]" style={{ background: 'var(--success)' }} />Active<b className="ml-auto pl-3 tabular-nums">{active}</b></li>
            <li className="flex items-center gap-2"><i className="size-2.5 rounded-[3px]" style={{ background: 'var(--warning)' }} />Disabled<b className="ml-auto pl-3 tabular-nums">{disabled}</b></li>
          </ul>
        </div>
      </PanelCard>

      <PanelCard icon={Tag} accent="violet" title="By vendor" delay={0.26}>
        <BarRows rows={vendorRows} accent="violet" />
      </PanelCard>

      <PanelCard icon={Building2} accent="aqua" title="By branch" delay={0.32}>
        <BarRows rows={branchRows} accent="aqua" />
      </PanelCard>
    </section>
  );
}
