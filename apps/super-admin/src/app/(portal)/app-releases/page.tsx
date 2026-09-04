'use client';

import * as React from 'react';
import { CheckCircle2, Download, Smartphone, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useActivateAppRelease,
  useAppReleases,
  useCreateAppRelease,
  useDeleteAppRelease,
} from '@/features/app-releases/hooks/use-app-releases';

function formatBytes(bytes: string): string {
  const n = Number(bytes);
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Super-admin uploads the mobile app's .apk here; every signed-in tenant
 * user (any role, any gym) can then download whichever release is marked
 * Active from the public, no-auth `/public/app-releases/latest` endpoint —
 * see `tenant-web`'s header "Get the app" link, the actual download entry
 * point for "all users". Exactly one release per platform is ever Active.
 */
export default function AppReleasesPage() {
  const releases = useAppReleases();
  const create = useCreateAppRelease();
  const activate = useActivateAppRelease();
  const remove = useDeleteAppRelease();

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [file, setFile] = React.useState<File | null>(null);
  const [version, setVersion] = React.useState('');
  const [versionCode, setVersionCode] = React.useState('');
  const [releaseNotes, setReleaseNotes] = React.useState('');
  const [progress, setProgress] = React.useState<number | null>(null);

  const handleUpload = () => {
    if (!file || !version.trim() || !versionCode.trim()) {
      toast.error('Choose a file and fill in version + version code.');
      return;
    }
    setProgress(0);
    create.mutate(
      {
        payload: {
          file,
          version: version.trim(),
          versionCode: Number(versionCode),
          releaseNotes: releaseNotes.trim() || undefined,
        },
        onProgress: setProgress,
      },
      {
        onSuccess: () => {
          toast.success('Release uploaded.');
          setFile(null);
          setVersion('');
          setVersionCode('');
          setReleaseNotes('');
          setProgress(null);
          if (fileInputRef.current) fileInputRef.current.value = '';
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : 'Upload failed.');
          setProgress(null);
        },
      },
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div
          className="flex size-10 shrink-0 items-center justify-center rounded-xl"
          style={{
            backgroundColor: 'color-mix(in oklch, var(--chart-2) 16%, transparent)',
            color: 'var(--chart-2)',
            boxShadow: '0 0 0 1px color-mix(in oklch, var(--chart-2) 18%, transparent)',
          }}
        >
          <Smartphone className="size-5" aria-hidden />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">App Releases</h1>
          <p className="text-muted-foreground">Upload the mobile app .apk — every user downloads whichever release is Active.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Upload a new release</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>APK file *</Label>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                <Upload className="size-4" /> Choose .apk
              </Button>
              {file ? <span className="text-sm text-muted-foreground">{file.name} ({formatBytes(String(file.size))})</span> : null}
              <input
                ref={fileInputRef}
                type="file"
                accept=".apk"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="version">Version *</Label>
              <Input id="version" placeholder="e.g. 1.4.2" value={version} onChange={(e) => setVersion(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="versionCode">Version code *</Label>
              <Input id="versionCode" type="number" placeholder="e.g. 14" value={versionCode} onChange={(e) => setVersionCode(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="releaseNotes">Release notes</Label>
            <textarea
              id="releaseNotes"
              className="flex min-h-16 w-full rounded-lg border border-input bg-background px-3.5 py-2 text-sm shadow-xs transition-all duration-150 placeholder:text-muted-foreground/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:border-ring"
              value={releaseNotes}
              onChange={(e) => setReleaseNotes(e.target.value)}
              placeholder="What's new (optional)"
            />
          </div>

          {progress !== null ? (
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
            </div>
          ) : null}

          <Button size="sm" disabled={create.isPending} onClick={handleUpload}>
            {create.isPending ? `Uploading… ${progress ?? 0}%` : 'Upload release'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">All releases</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {releases.isPending ? (
            <Skeleton className="h-24 w-full rounded-xl" />
          ) : (releases.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No releases uploaded yet.</p>
          ) : (
            releases.data!.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">v{r.version}</span>
                    <span className="text-xs text-muted-foreground">(code {r.versionCode})</span>
                    {r.isActive ? (
                      <Badge variant="success" className="gap-1">
                        <CheckCircle2 className="size-3" /> Active
                      </Badge>
                    ) : null}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {r.fileName} · {formatBytes(r.fileSizeBytes)} · {new Date(r.createdAt).toLocaleString()}
                    {r.uploadedBy ? ` · by ${r.uploadedBy.name}` : ''}
                  </p>
                  {r.releaseNotes ? <p className="mt-1 text-sm">{r.releaseNotes}</p> : null}
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <Button variant="ghost" size="sm" asChild>
                    <a href={r.fileUrl} target="_blank" rel="noreferrer">
                      <Download className="size-4" />
                    </a>
                  </Button>
                  {!r.isActive ? (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={activate.isPending}
                      onClick={() =>
                        activate.mutate(r.id, {
                          onSuccess: () => toast.success('Release activated.'),
                          onError: (err) => toast.error(err instanceof Error ? err.message : 'Could not activate.'),
                        })
                      }
                    >
                      Activate
                    </Button>
                  ) : null}
                  {!r.isActive ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 text-destructive"
                      disabled={remove.isPending}
                      onClick={() =>
                        remove.mutate(r.id, {
                          onSuccess: () => toast.success('Release deleted.'),
                          onError: (err) => toast.error(err instanceof Error ? err.message : 'Could not delete.'),
                        })
                      }
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
