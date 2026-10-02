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
import { SearchBar } from '@/components/ui/search-bar';
import { Skeleton } from '@/components/ui/skeleton';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { useCurrentBranch } from '@/features/branch/hooks/use-branches';
import { type MemberCardAction, MemberListCard } from '@/features/members/components/member-list-card';
import { toMemberError, useBulkImportMembers, useBulkMemberAction, useMemberList, useMemberStatusAction } from '@/features/members/hooks/use-members';
import { memberService } from '@/features/members/services/member.service';
import type { ListMembersParams, MemberBulkImportRow, MemberStatus } from '@/features/members/types';
import { useStaffList } from '@/features/staff/hooks/use-staff';
import { cn } from '@/lib/utils';

const selectClassName = cn(
  'h-9 rounded-lg border border-input bg-background px-2.5 text-sm shadow-xs transition-all duration-150',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:border-ring',
);

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

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3.5">
          <div
            className="hidden size-10 shrink-0 items-center justify-center rounded-xl sm:flex"
            style={{
              backgroundColor: 'color-mix(in oklch, var(--primary) 16%, transparent)',
              color: 'var(--primary)',
              boxShadow: '0 0 0 1px color-mix(in oklch, var(--primary) 18%, transparent)',
            }}
          >
            <Users className="size-5" aria-hidden />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Members</h1>
            <p className="text-muted-foreground">Everyone training at your gym.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
            <Button size="sm" asChild>
              <Link href="/members/new">
                <UserPlus className="size-4" /> Add member
              </Link>
            </Button>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SearchBar
          containerClassName="max-w-xs"
          placeholder="Search name, member ID, or phone…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <select
          className={selectClassName}
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as MemberStatus | '');
            setPage(1);
          }}
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
          <option value="FROZEN">Frozen</option>
        </select>
        <select
          className={selectClassName}
          value={trainerId}
          onChange={(e) => {
            setTrainerId(e.target.value);
            setPage(1);
          }}
          aria-label="Filter by trainer"
        >
          <option value="">All trainers</option>
          {(trainers.data?.items ?? []).map((trainer) => (
            <option key={trainer.id} value={trainer.id}>
              {trainer.name}
            </option>
          ))}
        </select>
        <select
          className={selectClassName}
          value={`${sortBy}:${sortDir}`}
          onChange={(e) => {
            const [nextSortBy, nextSortDir] = e.target.value.split(':') as [SortableColumn, 'asc' | 'desc'];
            setSortBy(nextSortBy);
            setSortDir(nextSortDir);
          }}
          aria-label="Sort by"
        >
          <option value="createdAt:desc">Newest first</option>
          <option value="createdAt:asc">Oldest first</option>
          <option value="name:asc">Name (A–Z)</option>
          <option value="name:desc">Name (Z–A)</option>
          <option value="memberId:asc">Member ID (A–Z)</option>
          <option value="joiningDate:desc">Joining date (newest)</option>
          <option value="joiningDate:asc">Joining date (oldest)</option>
        </select>
      </div>

      {selected.size > 0 && (canManage || canDelete) ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/40 p-2.5 text-sm">
          <span className="font-medium">{selected.size} selected</span>
          {canManage ? (
            <>
              <Button size="sm" variant="outline" onClick={() => setConfirmAction({ kind: 'bulk', action: 'activate', ids: [...selected] })}>
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
        </div>
      ) : null}

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
        <div className="space-y-3">
          <Skeleton className="h-44 w-full" />
          <Skeleton className="h-44 w-full" />
          <Skeleton className="h-44 w-full" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={Users}
          title={!search && !status ? 'Add your first member to get started.' : 'No members match these filters.'}
        />
      ) : (
        <div className="space-y-3">
          {items.map((m) => (
            <MemberListCard
              key={m.id}
              member={m}
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

      {data ? (
        <Pagination page={page} totalPages={data.totalPages} onPageChange={setPage} totalItems={data.total} pageSize={20} />
      ) : null}

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
