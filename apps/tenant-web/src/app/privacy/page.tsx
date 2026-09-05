import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Privacy Policy' };

interface CmsPageApiResponse {
  success: boolean;
  data: Array<{ title: string; content: { body?: string } }>;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

/** Same pattern as `app/terms/page.tsx` — see its doc comment. Fetches the published `PRIVACY` CMS page. */
async function getPrivacyPage() {
  try {
    const res = await fetch(`${API_URL}/public/cms/pages?type=PRIVACY`, { next: { revalidate: 300 } });
    if (!res.ok) return null;
    const body = (await res.json()) as CmsPageApiResponse;
    return body.data?.[0] ?? null;
  } catch {
    return null;
  }
}

export default async function PrivacyPage() {
  const page = await getPrivacyPage();

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">{page?.title ?? 'Privacy Policy'}</h1>
      <div className="mt-6 space-y-4 text-sm leading-relaxed text-muted-foreground">
        {page?.content.body ? (
          page.content.body.split('\n\n').map((paragraph, i) => <p key={i}>{paragraph}</p>)
        ) : (
          <p>This page hasn&apos;t been published yet — check back soon.</p>
        )}
      </div>
    </div>
  );
}
