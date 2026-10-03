'use client';

import { useDebouncedValue } from '@/hooks/use-debounced-value';
import * as React from 'react';
import Link from 'next/link';
import { AlertTriangle, Download, Upload, UserPlus, Users } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Pagination } from '@/components/ui/pagination';
import { Skeleton } from '@/components/ui/skeleton';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { useCurrentBranch } from '@/features/branch/hooks/use-branches';
import { BulkBar } from '@/features/members/components/list/bulk-bar';
import { MemberCard, type MemberCardAction } from '@/features/members/components/list/member-card';
import { MembersHero, MembersInsights, MembersKpis } from '@/features/members/components/list/members-overview';
import { MembersToolbar } from '@/features/members/components/list/members-toolbar';
import { toMemberError, useBulkImportMembers, useBulkMemberAction, useMemberList, useMemberStats, useMemberStatusAction } from '@/features/members/hooks/use-members';
import { memberService } from '@/features/members/services/member.service';
import type { ListMembersParams, MemberBulkImportRow, MemberStatus } from '@/features/members/types';
import { useStaffList } from '@/features/staff/hooks/use-staff';

type SortableColumn = NonNullable<ListMembersParams['sortBy']>;
type SingleStatusAction = 'activate' | 'deactivate' | 'restore' | 'delete';
type BulkStatusAction = 'activate' | 'deactivate' | 'delete';

/** Minimal CSV parser for the import sheet: header row `firstname,lastname,email,phone,memberid,branchname,traineremail,planname`. */
function parseCsv(text: string): MemberBulkImportRow[] {
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
      email: row.email,
      phone: row.phone,
      memberId: row.memberid,
      branchName: row.branchname ?? row.branch,
      trainerEmail: row.traineremail,
      planName: row.planname ?? row.plan,
    };
  });
}

export default function MembersListPage() {
  const { hasPermission } = usePermissions();
  const { currentBranchId } = useCurrentBranch();
  const [search, setSearch] = React.useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [status, setStatus] = React.useState<MemberStatus | ''>('');
  const [trainerId, setTrainerId] = React.useState('');
  const [page, setPage] = React.useState(1);
  const trainers = useStaffList({ role: 'TRAINER', status: 'ACTIVE', limit: 100 });
  const [sortBy, setSortBy] = React.useState<SortableColumn>('createdAt');
  const [sortDir, setSortDir] = React.useState<'asc' | 'desc'>('desc');
  const [view, setView] = React.useState<'grid' | 'list'>('grid');
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [confirmAction, setConfirmAction] = React.useState<
    | { kind: 'single'; action: SingleStatusAction; ids: string[] }
    | { kind: 'bulk'; action: BulkStatusAction; ids: string[] }
    | null
  >(null);

  const members = useMemberList({
    page,
    limit: 20,
    search: debouncedSearch || undefined,
    status: status || undefined,
    branchId: currentBranchId ?? undefined,
    trainerId: trainerId || undefined,
    includeDeleted: true,
    sortBy,
    sortDir,
  });
  const statusAction = useMemberStatusAction();
  const bulkAction = useBulkMemberAction();
  const bulkImport = useBulkImportMembers();
  const importInputRef = React.useRef<HTMLInputElement>(null);

  const canManage = hasPermission('members:update');
  const canCreate = hasPermission('members:create');
  const canDelete = hasPermission('members:delete');
  const canRestore = hasPermission('members:restore');
  const canExport = hasPermission('members:export');
  const canImport = hasPermission('members:import');
  const canAssignMembership = hasPermission('memberships:assign');
  const canRenew = hasPermission('memberships:renew');
  const canCheckIn = hasPermission('attendance:checkin');

  const data = members.data;
  const items = data?.items ?? [];

  // Header branch switch re-scopes the whole list — back to page 1 like any other filter change.
  React.useEffect(() => {
    setPage(1);
  }, [currentBranchId]);

  const runSingleAction = (id: string, action: SingleStatusAction) => {
    statusAction.mutate(
      { id, action },
      {
        onSuccess: () => toast.success(`Member ${action}d.`),
        onError: (err) => toast.error(toMemberError(err).message),
      },
    );
  };

  const runBulkAction = (ids: string[], action: BulkStatusAction) => {
    bulkAction.mutate(
      { memberIds: ids, action },
      {
        onSuccess: (result) => {
          toast.success(`${result.succeeded.length} member(s) ${action}d${result.failed.length ? `, ${result.failed.length} failed` : ''}.`);
          setSelected(new Set());
        },
        onError: (err) => toast.error(toMemberError(err).message),
      },
    );
  };

  const confirmAndRun = () => {
    if (!confirmAction) return;
    if (confirmAction.kind === 'single') runSingleAction(confirmAction.ids[0]!, confirmAction.action);
    else runBulkAction(confirmAction.ids, confirmAction.action);
    setConfirmAction(null);
  };

  const exportCsv = async () => {
    try {
      const url = await memberService.exportCsvUrl();
      const a = document.createElement('a');
      a.href = url;
      a.download = 'members-export.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(toMemberError(err).message);
    }
  };

  const handleImportFile = async (file: File | undefined) => {
    if (!file) return;
    const rows = parseCsv(await file.text());
    if (rows.length === 0) {
      toast.error('No rows found — the first line must be a header: firstName,lastName,email,phone,memberId,branchName,trainerEmail,planName');
      return;
    }
    bulkImport.mutate(rows, {
      onSuccess: (result) => {
        toast.success(`${result.created} member(s) imported${result.failed.length ? `, ${result.failed.length} failed` : ''}`);
        for (const failure of result.failed.slice(0, 3)) {
          toast.error(`Row ${failure.row} (${failure.name}): ${failure.reason}`);
        }
      },
      onError: (err) => toast.error(toMemberError(err).message),
    });
  };

  const allSelected = items.length > 0 && items.every((i) => selected.has(i.id));
  const toggleSelectAll = (checked: boolean) => setSelected(checked ? new Set(items.map((i) => i.id)) : new Set());
  const toggleSelectOne = (id: string, checked: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });

  const handleCardAction = (id: string, action: MemberCardAction) => setConfirmAction({ kind: 'single', action, ids: [id] });

  const stats = useMemberStats(currentBranchId ?? undefined);

  return (
    <div className="w-full space-y-5">
      <MembersHero
        total={stats.data?.total ?? data?.total ?? 0}
        faces={items}
        actions={
          <>
            {canExport ? (
              <Button variant="outline" size="sm" onClick={() => void exportCsv()}>
                <Download className="size-4" /> Export
              </Button>
            ) : null}
            {canImport ? (
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
              </>
            ) : null}
            {canCreate ? (
              <Button size="sm" asChild className="border-0 bg-white text-indigo-700 shadow-lg hover:bg-white/90">
                <Link href="/members/new">
                  <UserPlus className="size-4" /> Add member
                </Link>
              </Button>
            ) : null}
          </>
        }
      />

      <MembersKpis
        stats={stats.data}
        loading={stats.isPending}
        status={status}
        onStatus={(s) => {
          setStatus(s);
          setPage(1);
        }}
      />
      <MembersInsights stats={stats.data} loading={stats.isPending} />

      <MembersToolbar
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
        stats={stats.data}
        trainerId={trainerId}
        onTrainer={(v) => {
          setTrainerId(v);
          setPage(1);
        }}
        trainers={(trainers.data?.items ?? []).map((t) => ({ id: t.id, name: t.name }))}
        sort={`${sortBy}:${sortDir}`}
        onSort={(v) => {
          const [nextSortBy, nextSortDir] = v.split(':') as [SortableColumn, 'asc' | 'desc'];
          setSortBy(nextSortBy);
          setSortDir(nextSortDir);
        }}
        view={view}
        onView={setView}
      />

      {(canManage || canDelete || canRestore) && items.length > 0 ? (
        <label className="flex w-fit items-center gap-2 text-sm text-muted-foreground">
          <Checkbox checked={allSelected} onCheckedChange={(checked) => toggleSelectAll(checked === true)} aria-label="Select all" />
          Select all on this page
        </label>
      ) : null}

      {members.error ? (
        <EmptyState
          icon={AlertTriangle}
          title="Couldn't load this data"
          description={members.error instanceof Error ? members.error.message : 'Something went wrong loading this data.'}
          className="border-destructive/30"
          action={
            <Button variant="outline" size="sm" onClick={() => members.refetch()}>
              Retry
            </Button>
          }
        />
      ) : members.isPending ? (
        <div className={view === 'grid' ? 'grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4' : 'space-y-3'}>
          {Array.from({ length: view === 'grid' ? 8 : 5 }).map((_, i) => (
            <Skeleton key={i} className={view === 'grid' ? 'h-[420px] w-full rounded-3xl' : 'h-20 w-full rounded-2xl'} />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState icon={Users} title={!search && !status ? 'Add your first member to get started.' : 'No members match these filters.'} />
      ) : (
        <div className={view === 'grid' ? 'grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4' : 'space-y-2.5'}>
          {items.map((m, i) => (
            <MemberCard
              key={m.id}
              member={m}
              index={i}
              variant={view}
              selected={selected.has(m.id)}
              onToggleSelect={(checked) => toggleSelectOne(m.id, checked)}
              canManage={canManage}
              canDelete={canDelete}
              canRestore={canRestore}
              canAssignMembership={canAssignMembership}
              canRenew={canRenew}
              canCheckIn={canCheckIn}
              onRequestAction={(action) => handleCardAction(m.id, action)}
            />
          ))}
        </div>
      )}

      {data ? <Pagination page={page} totalPages={data.totalPages} onPageChange={setPage} totalItems={data.total} pageSize={20} /> : null}

      <BulkBar
        count={selected.size}
        canManage={canManage}
        canDelete={canDelete}
        onActivate={() => setConfirmAction({ kind: 'bulk', action: 'activate', ids: [...selected] })}
        onDeactivate={() => setConfirmAction({ kind: 'bulk', action: 'deactivate', ids: [...selected] })}
        onDelete={() => setConfirmAction({ kind: 'bulk', action: 'delete', ids: [...selected] })}
        onClear={() => setSelected(new Set())}
      />

      <ConfirmDialog
        open={!!confirmAction}
        onOpenChange={(open) => !open && setConfirmAction(null)}
        title={
          confirmAction?.kind === 'bulk'
            ? `${confirmAction.action[0]!.toUpperCase()}${confirmAction.action.slice(1)} ${confirmAction.ids.length} member(s)?`
            : `${confirmAction ? confirmAction.action[0]!.toUpperCase() + confirmAction.action.slice(1) : ''} this member?`
        }
        description={confirmAction?.action === 'delete' ? 'This soft-deletes the member — it can be restored later.' : 'This action can be reversed later if needed.'}
        destructive={confirmAction?.action === 'delete'}
        loading={statusAction.isPending || bulkAction.isPending}
        onConfirm={confirmAndRun}
      />
    </div>
  );
}
