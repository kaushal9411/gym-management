'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, FileText } from 'lucide-react';

import { Skeleton } from '@/components/ui/skeleton';
import { CmsPageForm } from '@/features/cms/components/cms-page-form';
import { useCmsPage } from '@/features/cms/hooks/use-cms';

export default function EditCmsPage() {
  const params = useParams<{ slug: string }>();
  const { data: page, isLoading } = useCmsPage(params.slug);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/cms" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-3.5" aria-hidden />
          Back to CMS
        </Link>
        <div className="mt-3 flex items-center gap-3">
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
            <h1 className="text-2xl font-semibold tracking-tight">{page ? `Edit "${page.title}"` : 'Edit page'}</h1>
            <p className="text-muted-foreground">{page?.slug}</p>
          </div>
        </div>
      </div>

      {isLoading || !page ? <Skeleton className="h-96 rounded-xl" /> : <CmsPageForm page={page} />}
    </div>
  );
}
