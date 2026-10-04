'use client';

/**
 * /cms — banner + KPI tiles (all derived from the page list), status/type filters + search, card grid.
 * Preserved: list/delete hooks, edit links, create link. window.confirm replaced by an inline confirm row.
 */
import * as React from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { FileText, Plus, Search, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PAGE_TYPE_META, PAGE_TYPES } from '@/features/cms/constants';
import { toCmsError, useCmsPages, useDeleteCmsPage } from '@/features/cms/hooks/use-cms';
import type { CmsPage } from '@/features/cms/types';
import { KpiCard } from '@/features/dashboard/components/kpi-card';
import { fmtInt } from '@/features/dashboard/components/format';
import { Chip, EmptyNote } from '@/features/dashboard/components/ui';
import { useNow } from '@/features/dashboard/components/use-now';
import { BANNER_BTN, Banner, ConfirmRow, relTime } from '@/features/payments/components/pay-kit';
import { ErrorNote, CountChips } from '@/features/tenants/components/detail/tabs/_shared/kit';
import { FIELD, KpiGrid } from '@/features/shell/components/page-kit';

type StatusFilter = 'ALL' | 'PUBLISHED' | 'DRAFT';

export default function CmsListPage() {
  const pagesQ = useCmsPages();
  const deletePage = useDeleteCmsPage();
  const now = useNow();
  const [status, setStatus] = React.useState<StatusFilter>('ALL');
  const [type, setType] = React.useState('');
  const [q, setQ] = React.useState('');
  const [confirming, setConfirming] = React.useState<string | null>(null);

  const pages = pagesQ.data;
  const stats = React.useMemo(() => {
    const all = pages ?? [];
    const published = all.filter((p) => p.isPublished).length;
    const typesUsed = new Set(all.map((p) => p.type)).size;
    const latest = all.reduce<CmsPage | null>((a, p) => (!a || p.updatedAt > a.updatedAt ? p : a), null);
    return { total: all.length, published, drafts: all.length - published, typesUsed, latest };
  }, [pages]);

  const rows = React.useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (pages ?? [])
      .filter((p) => (status === 'ALL' ? true : status === 'PUBLISHED' ? p.isPublished : !p.isPublished))
      .filter((p) => !type || p.type === type)
      .filter((p) => !needle || p.title.toLowerCase().includes(needle) || p.slug.toLowerCase().includes(needle))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [pages, status, type, q]);

  const remove = (p: CmsPage) =>
    deletePage.mutate(p.slug, {
      onSuccess: () => { toast.success('Page deleted.'); setConfirming(null); },
      onError: (err) => toast.error(toCmsError(err).message),
    });

  return (
    <div className="mx-auto max-w-[1600px] space-y-4">
      <Banner actions={<Link href="/cms/new" className={BANNER_BTN}><Plus className="size-4" aria-hidden />Create page</Link>}>
        <h1 className="text-2xl font-bold tracking-tight">CMS</h1>
        <p className="mt-0.5 text-[13px] text-teal-100">
          {pages ? `${fmtInt(stats.total)} pages · ${fmtInt(stats.published)} published · ${fmtInt(stats.drafts)} drafts` : 'Landing page content, blogs, FAQs, testimonials and legal pages'}
        </p>
      </Banner>

      {pagesQ.isError ? <ErrorNote what="CMS pages" message={pagesQ.error?.message} onRetry={() => void pagesQ.refetch()} /> : null}

      <KpiGrid>
        <KpiCard index={0} label="Total pages" value={stats.total} format={fmtInt} fallbackCaption="across all types" color="var(--chart-1)" />
        <KpiCard index={1} label="Published" value={stats.published} format={fmtInt} fallbackCaption="live to the public" color="var(--chart-6)" />
        <KpiCard index={2} label="Drafts" value={stats.drafts} format={fmtInt} fallbackCaption="not yet visible" color="var(--chart-4)" />
        <KpiCard index={3} label="Page types in use" value={stats.typesUsed} format={fmtInt} fallbackCaption={`of ${PAGE_TYPES.length} available`} color="var(--chart-3)" />
      </KpiGrid>

      <div className="flex flex-wrap items-center gap-2">
        <CountChips
          label="Status"
          value={status}
          onChange={setStatus}
          options={[{ value: 'ALL', label: 'All', count: stats.total }, { value: 'PUBLISHED', label: 'Published', count: stats.published }, { value: 'DRAFT', label: 'Draft', count: stats.drafts }]}
        />
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground" aria-hidden />
            <input className={`${FIELD} w-56 pl-8`} placeholder="Search title or slug" aria-label="Search pages" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <select className={`${FIELD} w-44`} aria-label="Filter by type" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">All types</option>
            {PAGE_TYPES.map((t) => <option key={t} value={t}>{PAGE_TYPE_META[t].label}</option>)}
          </select>
        </div>
      </div>

      {pagesQ.isPending ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-40 rounded-[14px]" />)}</div>
      ) : pages && pages.length === 0 ? (
        <div className="grid place-items-center gap-2 rounded-[14px] border border-dashed bg-card px-4 py-14 text-center">
          <FileText className="size-8 text-muted-foreground" aria-hidden />
          <p className="font-semibold">No pages yet</p>
          <p className="text-sm text-muted-foreground">Create your first FAQ, Terms page, or landing content.</p>
          <Button asChild className="mt-2"><Link href="/cms/new">Create page</Link></Button>
        </div>
      ) : rows.length === 0 ? (
        <EmptyNote>No pages match these filters.</EmptyNote>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-label="CMS pages">
          {rows.map((p) => (
            <li key={p.id} className="flex min-w-0 flex-col gap-2.5 rounded-[14px] border bg-card p-4 transition-shadow hover:shadow-md">
              <div className="flex items-start gap-2">
                <Link href={`/cms/${p.slug}`} className="min-w-0 flex-1 rounded-sm text-[15px] font-semibold leading-snug outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring">
                  <span className="line-clamp-2">{p.title}</span>
                </Link>
                <Chip tone={p.isPublished ? 'green' : 'amber'}>{p.isPublished ? 'Published' : 'Draft'}</Chip>
              </div>
              <p className="truncate font-mono text-xs text-muted-foreground">/{p.slug}</p>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Chip tone="blue">{PAGE_TYPE_META[p.type].label}</Chip>
                <span>Edited {relTime(p.updatedAt, now) || new Date(p.updatedAt).toLocaleDateString()}</span>
                {p.isPublished && p.publishedAt ? <span>· live since {new Date(p.publishedAt).toLocaleDateString()}</span> : null}
              </div>
              {confirming === p.slug ? (
                <ConfirmRow text={`Delete “${p.title}”? This can't be undone.`} confirmLabel="Delete" busy={deletePage.isPending} onCancel={() => setConfirming(null)} onConfirm={() => remove(p)} />
              ) : (
                <div className="mt-auto flex justify-end gap-2 pt-1">
                  <Button size="sm" variant="outline" asChild><Link href={`/cms/${p.slug}`}>Edit</Link></Button>
                  <Button size="sm" variant="outline" className="text-destructive" aria-label={`Delete ${p.title}`} onClick={() => setConfirming(p.slug)}><Trash2 className="size-4" aria-hidden /></Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {stats.latest ? <p className="text-xs text-muted-foreground">Last edit: {stats.latest.title}</p> : null}
    </div>
  );
}
