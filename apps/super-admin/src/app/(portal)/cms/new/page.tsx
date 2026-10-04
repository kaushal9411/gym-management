'use client';

import { BackLink, Banner } from '@/features/payments/components/pay-kit';
import { CmsPageForm } from '@/features/cms/components/cms-page-form';

export default function NewCmsPage() {
  return (
    <div className="mx-auto max-w-[1600px] space-y-4">
      <BackLink href="/cms">Back to CMS</BackLink>
      <Banner>
        <h1 className="text-2xl font-bold tracking-tight">Create page</h1>
        <p className="mt-0.5 text-[13px] text-teal-100">Pick a type — it comes pre-filled with a starting draft you can edit.</p>
      </Banner>
      <CmsPageForm />
    </div>
  );
}
