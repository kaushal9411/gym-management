'use client';

import { useParams } from 'next/navigation';

import { Skeleton } from '@/components/ui/skeleton';
import { CmsPageForm } from '@/features/cms/components/cms-page-form';
import { useCmsPage } from '@/features/cms/hooks/use-cms';
import { BackLink, Banner, NotFoundCard } from '@/features/payments/components/pay-kit';
import { Chip } from '@/features/dashboard/components/ui';
import { PAGE_TYPE_META } from '@/features/cms/constants';

export default function EditCmsPage() {
  const params = useParams<{ slug: string }>();
  const { data: page, isLoading, isError, error, refetch } = useCmsPage(params.slug);

  if (isError) return <NotFoundCard what="Page" message={error instanceof Error ? error.message : undefined} backHref="/cms" backLabel="Back to CMS" onRetry={() => void refetch()} />;

  return (
    <div className="mx-auto max-w-[1600px] space-y-4">
      <BackLink href="/cms">Back to CMS</BackLink>
      <Banner>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight">{page ? page.title : 'Edit page'}</h1>
          {page ? <Chip tone={page.isPublished ? 'green' : 'amber'}>{page.isPublished ? 'Published' : 'Draft'}</Chip> : null}
        </div>
        <p className="mt-0.5 font-mono text-[13px] text-teal-100">{page ? `/${page.slug} · ${PAGE_TYPE_META[page.type].label}` : params.slug}</p>
      </Banner>
      {isLoading || !page ? <Skeleton className="h-96 rounded-[14px]" /> : <CmsPageForm page={page} />}
    </div>
  );
}
