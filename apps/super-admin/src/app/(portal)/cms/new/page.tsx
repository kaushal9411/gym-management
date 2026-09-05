'use client';

import Link from 'next/link';
import { ArrowLeft, FileText } from 'lucide-react';

import { CmsPageForm } from '@/features/cms/components/cms-page-form';

export default function NewCmsPage() {
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
            <h1 className="text-2xl font-semibold tracking-tight">Create page</h1>
            <p className="text-muted-foreground">Pick a type — it comes pre-filled with a starting draft you can edit.</p>
          </div>
        </div>
      </div>

      <CmsPageForm />
    </div>
  );
}
