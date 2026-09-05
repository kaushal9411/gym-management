'use client';

import Link from 'next/link';
import { toast } from 'sonner';
import { FileText, Plus } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { DataTable, type DataTableColumn } from '@/components/data-table';
import { PAGE_TYPE_META } from '@/features/cms/constants';
import { toCmsError, useCmsPages, useDeleteCmsPage } from '@/features/cms/hooks/use-cms';
import type { CmsPage } from '@/features/cms/types';

export default function CmsListPage() {
  const { data: pages, isLoading } = useCmsPages();
  const deletePage = useDeleteCmsPage();

  const columns: DataTableColumn<CmsPage>[] = [
    {
      key: 'title',
      header: 'Title',
      render: (p) => (
        <Link href={`/cms/${p.slug}`} className="font-medium hover:underline">
          {p.title}
        </Link>
      ),
    },
    { key: 'slug', header: 'Slug', render: (p) => <span className="text-muted-foreground">{p.slug}</span> },
    { key: 'type', header: 'Type', render: (p) => PAGE_TYPE_META[p.type].label },
    {
      key: 'status',
      header: 'Status',
      render: (p) => <Badge variant={p.isPublished ? 'success' : 'secondary'}>{p.isPublished ? 'Published' : 'Draft'}</Badge>,
    },
    { key: 'updatedAt', header: 'Updated', render: (p) => new Date(p.updatedAt).toLocaleDateString() },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (p) => (
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="outline" asChild>
            <Link href={`/cms/${p.slug}`}>Edit</Link>
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => {
              if (!window.confirm(`Delete "${p.title}"?`)) return;
              deletePage.mutate(p.slug, { onError: (err) => toast.error(toCmsError(err).message) });
            }}
          >
            Delete
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div
            className="flex size-10 shrink-0 items-center justify-center rounded-xl"
            style={{
              backgroundColor: 'color-mix(in oklch, var(--chart-5) 16%, transparent)',
              color: 'var(--chart-5)',
              boxShadow: '0 0 0 1px color-mix(in oklch, var(--chart-5) 18%, transparent)',
            }}
          >
            <FileText className="size-5" aria-hidden />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">CMS</h1>
            <p className="text-muted-foreground">Landing page content, blogs, FAQs, testimonials, and legal pages.</p>
          </div>
        </div>
        <Button asChild>
          <Link href="/cms/new">
            <Plus className="mr-1.5 size-4" aria-hidden />
            Create page
          </Link>
        </Button>
      </div>

      {isLoading || !pages ? (
        <Skeleton className="h-72 rounded-xl" />
      ) : pages.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center">
          <FileText className="mx-auto size-8 text-muted-foreground" aria-hidden />
          <p className="mt-3 text-sm font-medium">No pages yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Create your first FAQ, Terms page, or landing content.</p>
          <Button asChild className="mt-4">
            <Link href="/cms/new">Create page</Link>
          </Button>
        </div>
      ) : (
        <DataTable columns={columns} rows={pages} rowKey={(p) => p.id} />
      )}
    </div>
  );
}
