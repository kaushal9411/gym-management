'use client';

/**
 * /app-releases — banner, KPI tiles, per-platform card (Android is the only platform the API models), upload panel and
 * a release timeline. Super-admin uploads the mobile .apk; every signed-in tenant user downloads whichever release is
 * Active from the public `/public/app-releases/latest` endpoint (tenant-web header "Get the app"). Exactly one release
 * per platform is ever Active.
 * Dropped (no backing data/field): min-version / force-update flag, rollout percentage, download counts.
 * Added: inline confirm before deleting a release (previously one click).
 */
import * as React from 'react';
import { CheckCircle2, Download, Smartphone, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { KpiCard } from '@/features/dashboard/components/kpi-card';
import { fmtInt } from '@/features/dashboard/components/format';
import { Chip, EmptyNote, Panel } from '@/features/dashboard/components/ui';
import { useNow } from '@/features/dashboard/components/use-now';
import { useActivateAppRelease, useAppReleases, useCreateAppRelease, useDeleteAppRelease } from '@/features/app-releases/hooks/use-app-releases';
import type { AppRelease } from '@/features/app-releases/types';
import { Banner, ConfirmRow, relTime } from '@/features/payments/components/pay-kit';
import { FIELD, Field, KpiGrid, TEXTAREA, fmtDateTime } from '@/features/shell/components/page-kit';
import { ErrorNote } from '@/features/tenants/components/detail/tabs/_shared/kit';

function formatBytes(bytes: string): string {
  const n = Number(bytes);
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export default function AppReleasesPage() {
  const releases = useAppReleases();
  const create = useCreateAppRelease();
  const activate = useActivateAppRelease();
  const remove = useDeleteAppRelease();
  const now = useNow();

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [file, setFile] = React.useState<File | null>(null);
  const [version, setVersion] = React.useState('');
  const [versionCode, setVersionCode] = React.useState('');
  const [releaseNotes, setReleaseNotes] = React.useState('');
  const [progress, setProgress] = React.useState<number | null>(null);
  const [confirmId, setConfirmId] = React.useState<string | null>(null);

  const list = React.useMemo(() => [...(releases.data ?? [])].sort((a, b) => b.versionCode - a.versionCode || b.createdAt.localeCompare(a.createdAt)), [releases.data]);
  const active = list.find((r) => r.isActive) ?? null;
  const totalBytes = list.reduce((s, r) => s + Number(r.fileSizeBytes), 0);

  const handleUpload = () => {
    if (!file || !version.trim() || !versionCode.trim()) {
      toast.error('Choose a file and fill in version + version code.');
      return;
    }
    setProgress(0);
    create.mutate(
      { payload: { file, version: version.trim(), versionCode: Number(versionCode), releaseNotes: releaseNotes.trim() || undefined }, onProgress: setProgress },
      {
        onSuccess: () => {
          toast.success('Release uploaded.');
          setFile(null); setVersion(''); setVersionCode(''); setReleaseNotes(''); setProgress(null);
          if (fileInputRef.current) fileInputRef.current.value = '';
        },
        onError: (err) => { toast.error(err instanceof Error ? err.message : 'Upload failed.'); setProgress(null); },
      },
    );
  };

  const doDelete = (r: AppRelease) =>
    remove.mutate(r.id, {
      onSuccess: () => { toast.success('Release deleted.'); setConfirmId(null); },
      onError: (err) => toast.error(err instanceof Error ? err.message : 'Could not delete.'),
    });

  return (
    <div className="mx-auto max-w-[1600px] space-y-4">
      <Banner>
        <h1 className="text-2xl font-bold tracking-tight">App Releases</h1>
        <p className="mt-0.5 text-[13px] text-teal-100">Upload the mobile app .apk — every user downloads whichever release is Active.</p>
      </Banner>

      {releases.isError ? <ErrorNote what="releases" message={releases.error instanceof Error ? releases.error.message : undefined} onRetry={() => void releases.refetch()} /> : null}

      <KpiGrid>
        <KpiCard index={0} label="Active version" value={active ? active.versionCode : 0} format={() => (active ? `v${active.version}` : 'None')} fallbackCaption={active ? `code ${active.versionCode}` : 'no active release'} color="var(--chart-1)" />
        <KpiCard index={1} label="Releases uploaded" value={list.length} format={fmtInt} fallbackCaption="all versions" color="var(--chart-2)" />
        <KpiCard index={2} label="Latest version code" value={list[0]?.versionCode ?? 0} format={fmtInt} fallbackCaption={list[0] && !list[0].isActive ? 'newer than the active release' : 'is the active release'} color="var(--chart-3)" />
        <KpiCard index={3} label="Storage used" value={totalBytes / (1024 * 1024)} format={(v) => `${v.toFixed(1)} MB`} fallbackCaption="across all APKs" color="var(--chart-4)" />
      </KpiGrid>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="min-w-0 space-y-4">
          <Panel title="Platforms" index={0}>
            <div className="rounded-xl border p-4">
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"><Smartphone className="size-5" aria-hidden /></span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">Android</p>
                  <p className="text-xs text-muted-foreground">{active ? `Serving v${active.version} (code ${active.versionCode})` : 'No release is being served'}</p>
                </div>
                <Chip tone={active ? 'green' : 'amber'}>{active ? 'Live' : 'Inactive'}</Chip>
              </div>
              {active ? (
                <div className="mt-3 space-y-2 border-t pt-3 text-[13px]">
                  <p className="text-muted-foreground">{active.fileName} · {formatBytes(active.fileSizeBytes)} · uploaded {relTime(active.createdAt, now) || fmtDateTime(active.createdAt)}{active.uploadedBy ? ` by ${active.uploadedBy.name}` : ''}</p>
                  <p className="whitespace-pre-wrap">{active.releaseNotes || <span className="text-muted-foreground">No release notes.</span>}</p>
                  <Button size="sm" variant="outline" asChild><a href={active.fileUrl} target="_blank" rel="noreferrer"><Download className="mr-1.5 size-4" aria-hidden />Download APK</a></Button>
                </div>
              ) : null}
            </div>
          </Panel>

          <Panel title="Upload a new release" index={1}>
            <div className="space-y-4">
              <Field label="APK file *">
                <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}><Upload className="size-4" aria-hidden /> Choose .apk</Button>
                  {file ? <span className="min-w-0 truncate text-sm text-muted-foreground">{file.name} ({formatBytes(String(file.size))})</span> : null}
                  <input ref={fileInputRef} type="file" accept=".apk" className="hidden" aria-label="APK file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                </div>
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Version *" htmlFor="version"><input id="version" className={FIELD} placeholder="e.g. 1.4.2" value={version} onChange={(e) => setVersion(e.target.value)} /></Field>
                <Field label="Version code *" htmlFor="versionCode"><input id="versionCode" className={FIELD} type="number" placeholder="e.g. 14" value={versionCode} onChange={(e) => setVersionCode(e.target.value)} /></Field>
              </div>
              <Field label="Release notes" htmlFor="releaseNotes">
                <textarea id="releaseNotes" className={`${TEXTAREA} min-h-20`} value={releaseNotes} onChange={(e) => setReleaseNotes(e.target.value)} placeholder="What's new (optional)" />
              </Field>
              {progress !== null ? (
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}><div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} /></div>
              ) : null}
              <Button size="sm" disabled={create.isPending} onClick={handleUpload}>{create.isPending ? `Uploading… ${progress ?? 0}%` : 'Upload release'}</Button>
            </div>
          </Panel>
        </div>

        <Panel title="Release timeline" hint={list.length ? `${list.length} releases` : undefined} index={2}>
          {releases.isPending ? (
            <Skeleton className="h-40 w-full rounded-xl" />
          ) : list.length === 0 ? (
            <EmptyNote>No releases uploaded yet.</EmptyNote>
          ) : (
            <ol className="relative space-y-3 border-l-2 border-border pl-5">
              {list.map((r) => (
                <li key={r.id} className="relative">
                  <i aria-hidden className={`absolute -left-[27px] top-3 size-3 rounded-full border-2 border-card ${r.isActive ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                  <div className="rounded-xl border p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">v{r.version}</span>
                      <span className="text-xs text-muted-foreground">code {r.versionCode}</span>
                      {r.isActive ? <Chip tone="green"><CheckCircle2 className="mr-1 size-3" aria-hidden />Active</Chip> : null}
                      <span className="ml-auto text-xs text-muted-foreground">{fmtDateTime(r.createdAt)}</span>
                    </div>
                    <p className="mt-1 break-all text-xs text-muted-foreground">{r.fileName} · {formatBytes(r.fileSizeBytes)}{r.uploadedBy ? ` · by ${r.uploadedBy.name}` : ''}</p>
                    {r.releaseNotes ? <p className="mt-1.5 whitespace-pre-wrap text-sm">{r.releaseNotes}</p> : null}
                    {confirmId === r.id ? (
                      <div className="mt-2"><ConfirmRow text={`Delete v${r.version}? The APK file is removed.`} confirmLabel="Delete" busy={remove.isPending} onCancel={() => setConfirmId(null)} onConfirm={() => doDelete(r)} /></div>
                    ) : (
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <Button variant="outline" size="sm" asChild><a href={r.fileUrl} target="_blank" rel="noreferrer" aria-label={`Download v${r.version}`}><Download className="size-4" aria-hidden /></a></Button>
                        {!r.isActive ? (
                          <Button variant="outline" size="sm" disabled={activate.isPending} onClick={() => activate.mutate(r.id, { onSuccess: () => toast.success('Release activated.'), onError: (err) => toast.error(err instanceof Error ? err.message : 'Could not activate.') })}>Activate</Button>
                        ) : null}
                        {!r.isActive ? (
                          <Button variant="outline" size="sm" className="text-destructive" aria-label={`Delete v${r.version}`} disabled={remove.isPending} onClick={() => setConfirmId(r.id)}><Trash2 className="size-4" aria-hidden /></Button>
                        ) : null}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Panel>
      </div>
    </div>
  );
}
