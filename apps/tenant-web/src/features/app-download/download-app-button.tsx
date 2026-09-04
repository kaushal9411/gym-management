'use client';

import { Smartphone } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useLatestAppRelease } from './use-latest-app-release';

/**
 * "Get the app" — visible to every signed-in user regardless of role
 * (unlike the rest of the sidebar, this is never permission-gated; anyone
 * with an account should be able to grab the mobile app). Renders nothing
 * until a release has actually been published (`useLatestAppRelease`
 * resolves `null` on 404, not an error) — no dead button before the
 * super-admin's first upload.
 */
export function DownloadAppButton({ className }: { className?: string }) {
  const { data: release } = useLatestAppRelease();
  if (!release) return null;

  return (
    <Button variant="ghost" size="icon" className={className} asChild title={`Get the app · v${release.version}`}>
      <a href={release.fileUrl} target="_blank" rel="noreferrer" aria-label="Download the mobile app">
        <Smartphone className="size-4" />
      </a>
    </Button>
  );
}
