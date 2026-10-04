'use client';

import * as React from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowUpRight, Search } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { REPORT_CATALOG, REPORT_CATEGORIES, groupCatalog, type ReportCatalogEntry } from '../../report-catalog';
import { accentChipStyle, accentColor, accentTint } from '../../lib/reports-theme';
import { staggerDelay, useMotionSafe } from '../../lib/motion';
import { EmptyState, FilterChips } from '../ui';

function CatalogueCard({ entry, index }: { entry: ReportCatalogEntry; index: number }) {
  const m = useMotionSafe();
  const Icon = entry.icon;
  return (
    <motion.div
      layout={m.reduce ? false : 'position'}
      initial={m.reduce ? false : { opacity: 0, y: 12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1, transition: { duration: 0.35, delay: staggerDelay(index, 0.03, 10) } }}
      exit={m.reduce ? undefined : { opacity: 0, scale: 0.96, transition: { duration: 0.15 } }}
      whileHover={m.reduce ? undefined : { y: -4 }}
      className="min-w-0"
    >
      <Link
        href={entry.route}
        className="group relative flex h-full gap-3.5 rounded-[18px] border bg-card p-4 shadow-xs transition-[box-shadow,border-color] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        style={{ ['--hover' as string]: accentTint(entry.accent, 45) }}
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-110" style={accentChipStyle(entry.accent)}>
          <Icon className="size-5" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-extrabold">{entry.title}</span>
          <span className="mt-0.5 line-clamp-2 block text-[13px] leading-snug text-muted-foreground">{entry.description}</span>
          <span className="mt-2 inline-flex items-center gap-1 text-xs font-bold transition-transform group-hover:translate-x-0.5" style={{ color: accentColor(entry.accent) }}>
            Open <ArrowUpRight className="size-3.5" aria-hidden />
          </span>
        </span>
      </Link>
    </motion.div>
  );
}

export function HubCatalogue() {
  const { hasPermission } = usePermissions();
  const [query, setQuery] = React.useState('');
  const [category, setCategory] = React.useState('all');

  const allowed = React.useMemo(() => REPORT_CATALOG.filter((e) => hasPermission(e.permission)), [hasPermission]);
  const q = query.trim().toLowerCase();
  const filtered = React.useMemo(
    () => allowed.filter((e) => (category === 'all' || e.category === category) && (!q || `${e.title} ${e.description}`.toLowerCase().includes(q))),
    [allowed, category, q],
  );
  const groups = groupCatalog(filtered);
  const options = [
    { value: 'all', label: 'All', count: allowed.length },
    ...REPORT_CATEGORIES.filter((c) => allowed.some((e) => e.category === c.id)).map((c) => ({ value: c.id, label: c.label, count: allowed.filter((e) => e.category === c.id).length })),
  ];

  return (
    <section id="report-catalogue" className="space-y-4 scroll-mt-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold">Report catalogue</h2>
          <p className="text-[13px] text-muted-foreground">Detailed, exportable reports and analytics views.</p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input aria-label="Search reports" placeholder="Search reports..." className="pl-9" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
      </div>
      <FilterChips accent="analytics" options={options} value={category} onChange={setCategory} />
      {groups.length === 0 ? (
        <EmptyState title="No reports match" description="Try a different search or category." accent="analytics" />
      ) : (
        groups.map((g) => (
          <div key={g.category.id} className="space-y-2.5">
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full" style={{ backgroundColor: accentColor(g.category.accent) }} aria-hidden />
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">{g.category.label}</h3>
              <span className="text-xs text-muted-foreground">{g.category.description}</span>
            </div>
            <motion.div layout={false} className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
              <AnimatePresence mode="popLayout" initial>
                {g.entries.map((e, i) => (
                  <CatalogueCard key={e.id} entry={e} index={i} />
                ))}
              </AnimatePresence>
            </motion.div>
          </div>
        ))
      )}
    </section>
  );
}
