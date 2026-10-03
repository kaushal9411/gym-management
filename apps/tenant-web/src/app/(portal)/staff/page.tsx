'use client';

import { useDebouncedValue } from '@/hooks/use-debounced-value';
import * as React from 'react';
import Link from 'next/link';
import { Copy, Download, Upload, UserPlus, Users } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { LoadingButton } from '@/components/ui/loading-button';
import { Pagination } from '@/components/ui/pagination';
import { Skeleton } from '@/components/ui/skeleton';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { useCurrentBranch } from '@/features/branch/hooks/use-branches';
import { StaffCard, type StaffCardAction } from '@/features/staff/components/staff-card';
import { StaffHero } from '@/features/staff/components/staff-hero';
import { StaffInsights } from '@/features/staff/components/staff-insights';
import { StaffKpis } from '@/features/staff/components/staff-kpis';
import { StaffToolbar } from '@/features/staff/components/staff-toolbar';
import { staffService } from '@/features/staff/services/staff.service';
import {
  toStaffError,
  useBulkImportStaff,
  useBulkStaffAction,
  useManualActivateStaff,
  useResendStaffActivation,
  useStaffList,
  useStaffStatusAction,
} from '@/features/staff/hooks/use-staff';
import type { ListStaffParams, StaffBulkImportRow, StaffListItem, StaffRole, UserStatus, WorkStatus } from '@/features/staff/types';
import { useSubmitHandler } from '@/hooks/use-submit-handler';

type SortableColumn = NonNullable<ListStaffParams['sortBy']>;
type StatusAction = 'activate' | 'deactivate' | 'suspend' | 'restore' | 'delete';

/** Minimal CSV parser for the import sheet: header row `firstname,lastname,email,phone,role,primarybranchname,employeeid`. */
function parseCsv(text: string): StaffBulkImportRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const headers = lines[0]!.split(',').map((h) => h.trim().toLowerCase());
  return lines.slice(1).map((line) => {
    const cells = line.split(',').map((c) => c.trim());
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      if (cells[i]) row[h] = cells[i]!;
    });
    return {
      firstName: row.firstname ?? '',
      lastName: row.lastname ?? '',
      email: row.email ?? '',
      phone: row.phone,
      role: row.role,
      primaryBranchName: row.primarybranchname ?? row.branch,
      employeeId: row.employeeid,
    };
  });
}

export default function StaffListPage() {
  const { hasPermission } = usePermissions();
  const { currentBranchId } = useCurrentBranch();
  const [search, setSearch] = React.useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [status, setStatus] = React.useState<UserStatus | ''>('');
  const [role, setRole] = React.useState<StaffRole | ''>('');
  const [workStatus, setWorkStatus] = React.useState<WorkStatus | ''>('');
  const [page, setPage] = React.useState(1);
  const [sortBy, setSortBy] = React.useState<SortableColumn>('createdAt');
  const [sortDir, setSortDir] = React.useState<'asc' | 'desc'>('desc');
  const [view, setView] = React.useState<'grid' | 'list'>('grid');
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [confirmAction, setConfirmAction] = React.useState<{ kind: 'single' | 'bulk'; action: StatusAction; ids: string[] } | null>(
    null,
  );

  const staff = useStaffList({
    page,
    limit: 20,
    search: debouncedSearch || undefined,
    status: status || undefined,
    role: role || undefined,
    workStatus: workStatus || undefined,
    branchId: currentBranchId ?? undefined,
    includeDeleted: true,
    sortBy,
    sortDir,
  });
  const statusAction = useStaffStatusAction();
  const bulkAction = useBulkStaffAction();
  const bulkImport = useBulkImportStaff();
  const manualActivate = useManualActivateStaff();
  const resendActivation = useResendStaffActivation();
  const [activationResult, setActivationResult] = React.useState<{ name: string; email: string; temporaryPassword: string } | null>(null);
  const importInputRef = React.useRef<HTMLInputElement>(null);

  const canManage = hasPermission('staff:update');
  const canCreate = hasPermission('staff:create');
  const canActivate = hasPermission('staff:activate');
  const canDelete = hasPermission('staff:delete');
  const canRestore = hasPermission('staff:restore');

  // Header branch switch re-scopes the whole list — back to page 1 like any other filter change.
  React.useEffect(() => {
    setPage(1);
  }, [currentBranchId]);

  const data = staff.data;
  const items = data?.items ?? [];

  const handleManualActivate = (s: StaffListItem) => {
    manualActivate.mutate(s.id, {
      onSuccess: (result) => setActivationResult({ name: s.name, ...result }),
      onError: (err) => toast.error(toStaffError(err).message),
    });
  };

  const handleResendActivation = (s: StaffListItem) => {
    resendActivation.mutate(s.id, {
      onSuccess: () => toast.success(`Activation email resent to ${s.name}.`),
      onError: (err) => toast.error(toStaffError(err).message),
    });
  };

  const requestAction = (s: StaffListItem, action: StaffCardAction) => {
    setConfirmAction({ kind: 'single', action, ids: [s.id] });
  };

  const runSingleAction = (staffId: string, action: StatusAction) => {
    statusAction.mutate(
      { staffId, action },
      {
        onSuccess: () => toast.success(`Staff member ${action}d.`),
        onError: (err) => toast.error(toStaffError(err).message),
      },
    );
  };

  const runBulkAction = (ids: string[], action: 'activate' | 'deactivate' | 'delete') => {
    bulkAction.mutate(
      { userIds: ids, action },
      {
        onSuccess: (result) => {
          toast.success(`${result.succeeded.length} staff member(s) ${action}d${result.failed.length ? `, ${result.failed.length} failed` : ''}.`);
          setSelected(new Set());
        },
        onError: (err) => toast.error(toStaffError(err).message),
      },
    );
  };

  const confirmAndRun = () => {
    if (!confirmAction) return;
    if (confirmAction.kind === 'single') {
      runSingleAction(confirmAction.ids[0]!, confirmAction.action);
    } else {
      runBulkAction(confirmAction.ids, confirmAction.action as 'activate' | 'deactivate' | 'delete');
    }
    setConfirmAction(null);
  };

  const { isSubmitting: exporting, submit: exportCsv } = useSubmitHandler(async () => {
    try {
      const url = await staffService.exportCsvUrl();
      const a = document.createElement('a');
      a.href = url;
      a.download = 'staff-export.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(toStaffError(err).message);
    }
  });

  const handleImportFile = async (file: File | undefined) => {
    if (!file) return;
    const rows = parseCsv(await file.text());
    if (rows.length === 0) {
      toast.error('No rows found — the first line must be a header: firstName,lastName,email,phone,role,primaryBranchName,employeeId');
      return;
    }
    bulkImport.mutate(rows, {
      onSuccess: (result) => {
        toast.success(`${result.created} staff member(s) imported${result.failed.length ? `, ${result.failed.length} failed` : ''}`);
        for (const failure of result.failed.slice(0, 3)) {
          toast.error(`Row ${failure.row} (${failure.email}): ${failure.reason}`);
        }
      },
      onError: (err) => toast.error(toStaffError(err).message),
    });
  };

  const allSelected = items.length > 0 && items.every((i) => selected.has(i.id));
  const toggleSelectAll = (checked: boolean) => {
    setSelected(checked ? new Set(items.map((i) => i.id)) : new Set());
  };
  const toggleSelectOne = (id: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  return (
    <div className="w-full space-y-5">
      <StaffHero
        total={data?.total ?? 0}
        faces={items}
        actions={
          <>
            {hasPermission('staff:view') ? (
              <LoadingButton variant="outline" size="sm" loading={exporting} loadingText="Exporting…" onClick={() => void exportCsv()}>
                <Download className="size-4" /> Export
              </LoadingButton>
            ) : null}
            {canCreate ? (
              <>
                <Button variant="outline" size="sm" disabled={bulkImport.isPending} onClick={() => importInputRef.current?.click()}>
                  <Upload className="size-4" /> {bulkImport.isPending ? 'Importing…' : 'Import'}
                </Button>
                <input
                  ref={importInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => {
                    void handleImportFile(e.target.files?.[0]);
                    e.target.value = '';
                  }}
                />
                <Button size="sm" asChild data-solid className="border-0 bg-white text-indigo-700 shadow-lg hover:bg-white/90">
                  <Link href="/staff/new">
                    <UserPlus className="size-4" /> Add staff
                  </Link>
                </Button>
              </>
            ) : null}
          </>
        }
      />

      <StaffKpis
        branchId={currentBranchId ?? undefined}
        status={status}
        onStatus={(s) => {
          setStatus(s);
          setPage(1);
        }}
      />

      <StaffInsights branchId={currentBranchId ?? undefined} />

      <StaffToolbar
        search={search}
        onSearch={(v) => {
          setSearch(v);
          setPage(1);
        }}
        status={status}
        onStatus={(s) => {
          setStatus(s);
          setPage(1);
        }}
        role={role}
        onRole={(v) => {
          setRole(v);
          setPage(1);
        }}
        workStatus={workStatus}
        onWorkStatus={(v) => {
          setWorkStatus(v);
          setPage(1);
        }}
        sort={`${sortBy}:${sortDir}`}
        onSort={(v) => {
          const [by, dir] = v.split(':') as [SortableColumn, 'asc' | 'desc'];
          setSortBy(by);
          setSortDir(dir);
        }}
        view={view}
        onView={setView}
      />

      {items.length > 0 && (canManage || canDelete || canRestore) ? (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border bg-card/90 p-3 shadow-sm backdrop-blur">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={allSelected} onChange={(e) => toggleSelectAll(e.target.checked)} className="size-4 accent-primary" />
            {selected.size > 0 ? <span className="font-medium">{selected.size} selected</span> : <span className="text-muted-foreground">Select all on this page</span>}
          </label>
          {selected.size > 0 ? (
            <>
              {canActivate ? (
                <>
                  <Button size="sm" variant="success" onClick={() => setConfirmAction({ kind: 'bulk', action: 'activate', ids: [...selected] })}>
                    Bulk activate
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setConfirmAction({ kind: 'bulk', action: 'deactivate', ids: [...selected] })}>
                    Bulk deactivate
                  </Button>
                </>
              ) : null}
              {canDelete ? (
                <Button size="sm" variant="destructive" onClick={() => setConfirmAction({ kind: 'bulk', action: 'delete', ids: [...selected] })}>
                  Bulk delete
                </Button>
              ) : null}
              <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
                Clear
              </Button>
            </>
          ) : null}
        </div>
      ) : null}

      {staff.error ? (
        <EmptyState
          title="Couldn't load this data"
          description={staff.error instanceof Error ? staff.error.message : 'Something went wrong loading this data.'}
          className="border-destructive/30"
          action={
            <Button variant="outline" size="sm" onClick={() => staff.refetch()}>
              Retry
            </Button>
          }
        />
      ) : staff.isPending ? (
        <div className={view === 'grid' ? 'grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-4' : 'space-y-3'}>
          {Array.from({ length: view === 'grid' ? 8 : 5 }).map((_, i) => (
            <Skeleton key={i} className={view === 'grid' ? 'h-[300px] w-full rounded-3xl' : 'h-20 w-full rounded-2xl'} />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState icon={Users} title={!search && !status && !role && !workStatus ? 'Add your first staff member to get started.' : 'No staff match these filters.'} />
      ) : (
        <div className={view === 'grid' ? 'grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-4' : 'space-y-2.5'}>
          {items.map((s, i) => (
            <StaffCard
              key={s.id}
              staff={s}
              index={i}
              variant={view}
              selected={selected.has(s.id)}
              onToggleSelect={(checked) => toggleSelectOne(s.id, checked)}
              canManage={canManage}
              canActivate={canActivate}
              canDelete={canDelete}
              canRestore={canRestore}
              onManualActivate={() => handleManualActivate(s)}
              onResendActivation={() => handleResendActivation(s)}
              onRequestAction={(action) => requestAction(s, action)}
            />
          ))}
        </div>
      )}

      {data ? <Pagination page={page} totalPages={data.totalPages} onPageChange={setPage} totalItems={data.total} pageSize={20} /> : null}

      <ConfirmDialog
        open={!!confirmAction}
        onOpenChange={(open) => !open && setConfirmAction(null)}
        title={
          confirmAction?.kind === 'bulk'
            ? `${confirmAction.action[0]!.toUpperCase()}${confirmAction.action.slice(1)} ${confirmAction.ids.length} staff member(s)?`
            : `${confirmAction ? confirmAction.action[0]!.toUpperCase() + confirmAction.action.slice(1) : ''} this staff member?`
        }
        description={
          confirmAction?.action === 'delete'
            ? 'This soft-deletes the account — it can be restored later.'
            : 'This action can be reversed later if needed.'
        }
        destructive={confirmAction?.action === 'delete' || confirmAction?.action === 'suspend'}
        confirmLabel="Confirm"
        loading={statusAction.isPending || bulkAction.isPending}
        onConfirm={confirmAndRun}
      />

      <Dialog open={!!activationResult} onOpenChange={(open) => !open && setActivationResult(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{activationResult?.name} is now active</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Share this temporary password with them directly (call, message, in person) — it won&apos;t be shown again. They should change it after
              signing in.
            </p>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Email</p>
              <Input readOnly value={activationResult?.email ?? ''} className="h-9 text-sm" />
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Temporary password</p>
              <div className="flex items-center gap-2">
                <Input readOnly value={activationResult?.temporaryPassword ?? ''} className="h-9 font-mono text-sm" />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (!activationResult) return;
                    void navigator.clipboard.writeText(activationResult.temporaryPassword);
                    toast.success('Password copied.');
                  }}
                >
                  <Copy className="size-3.5" />
                </Button>
              </div>
            </div>
            <Button variant="outline" className="w-full" onClick={() => setActivationResult(null)}>
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
