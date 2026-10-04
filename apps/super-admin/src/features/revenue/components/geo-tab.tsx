'use client';

import { fmtInt } from '@/features/dashboard/components/format';
import { Chip, EmptyNote, Panel } from '@/features/dashboard/components/ui';
import { money } from '@/features/tenants/components/detail/tabs/_shared/kit';
import { CHART, GrowBar, num, provLabel, type TabData } from './common';

export function GeoTab({ data }: TabData) {
  const cur = data.currency;
  const countries = data.byCountry;
  const cMax = Math.max(1, ...countries.map((c) => num(c.collected)));
  const gMax = Math.max(1, ...data.byGateway.map((g) => num(g.collected)));
  const hasGateway = data.byGateway.some((g) => g.transactions > 0);

  return (
    <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-12">
      <Panel title="Revenue by country" hint={`collected · ${cur} · billing address`} index={0} className="xl:col-span-6">
        {countries.length === 0 || countries.every((c) => num(c.collected) === 0) ? <EmptyNote>No payments in this range.</EmptyNote> : (
          <ul className="space-y-3">
            {countries.map((c, i) => (
              <li key={c.country}>
                <div className="mb-1 flex items-baseline gap-2 text-[13px]">
                  <span className="truncate font-semibold">{c.country}</span>
                  <span className="text-xs text-muted-foreground">{fmtInt(c.tenants)} {c.tenants === 1 ? 'tenant' : 'tenants'}</span>
                  <b className="ml-auto tabular-nums">{money(c.collected, cur)}</b>
                </div>
                <GrowBar pct={(num(c.collected) / cMax) * 100} color={CHART[i % CHART.length]!} />
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Revenue by gateway" hint={`collected · ${cur}`} index={1} className="xl:col-span-6">
        {!hasGateway ? <EmptyNote>No payments in this range.</EmptyNote> : (
          <ul className="space-y-3.5">
            {data.byGateway.map((g, i) => {
              const rate = Math.round(g.successRate * 1000) / 10;
              return (
                <li key={g.provider} className="rounded-lg border px-3 py-2.5">
                  <div className="flex items-baseline gap-2 text-[13px]">
                    <span className="font-semibold">{provLabel(g.provider)}</span>
                    <span className="text-xs text-muted-foreground">{fmtInt(g.transactions)} {g.transactions === 1 ? 'transaction' : 'transactions'}</span>
                    <b className="ml-auto tabular-nums">{money(g.collected, cur)}</b>
                  </div>
                  <div className="mt-1.5"><GrowBar pct={(num(g.collected) / gMax) * 100} color={CHART[i % CHART.length]!} /></div>
                  <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="shrink-0">Success rate</span>
                    <div className="flex-1"><GrowBar pct={rate} color={rate >= 90 ? '#16a34a' : rate >= 70 ? '#d97706' : '#dc2626'} /></div>
                    <b className="w-12 text-right tabular-nums text-foreground">{rate}%</b>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <Panel title="Revenue by currency" hint="every currency, not converted" index={2} className="md:col-span-2 xl:col-span-12">
        {data.byCurrency.length === 0 ? <EmptyNote>No payments in this range.</EmptyNote> : (
          <div className="flex flex-wrap gap-2.5">
            {data.byCurrency.map((c) => <Chip key={c.currency} tone="blue" className="px-3 py-1 text-[13px]">{c.currency}&nbsp;<b className="tabular-nums">{money(c.collected, c.currency)}</b></Chip>)}
          </div>
        )}
      </Panel>
    </div>
  );
}
