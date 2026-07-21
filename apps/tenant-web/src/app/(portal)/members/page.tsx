'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowDown, ArrowUp, ArrowUpDown, Download, MoreHorizontal, Upload, UserPlus, Users } from 'lucide-react';
import { toast } from 'sonner';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { SearchBar } from '@/components/ui/search-bar';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { MemberStatusBadge } from '@/features/members/components/member-status-badge';
import { toMemberError, useBulkImportMembers, useBulkMemberAction, useMemberList, useMemberStatusAction } from '@/features/members/hooks/use-members';
import { memberService } from '@/features/members/services/member.service';
import type { ListMembersParams, MemberBulkImportRow, MemberListItem, MemberStatus } from '@/features/members/types';
import { cn } from '@/lib/utils';

const selectClassName = cn(
  'h-9 rounded-md border border-input bg-background px-2 text-sm shadow-sm',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
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
  const [search, setSearch] = React.useState('');
  const [status, setStatus] = React.useState<MemberStatus | ''>('');
  const [page, setPage] = React.useState(1);
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
    search: search || undefined,
    status: status || undefined,
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

  const data = members.data;
  const items = data?.items ?? [];

  const toggleSort = (column: SortableColumn) => {
    if (sortBy === column) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortBy(column);
      setSortDir('asc');
    }
  };

  const sortIcon = (column: SortableColumn) => {
    if (sortBy !== column) return <ArrowUpDown className="size-3.5 text-muted-foreground" />;
    return sortDir === 'asc' ? <ArrowUp className="size-3.5" /> : <ArrowDown className="size-3.5" />;
  };

  const sortableHeader = (label: string, column: SortableColumn) => (
    <button type="button" className="flex items-center gap-1 font-medium hover:text-foreground" onClick={() => toggleSort(column)}>
      {label} {sortIcon(column)}
    </button>
  );

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

  const columns: DataTableColumn<MemberListItem>[] = [
    {
      key: 'select',
      header: <Checkbox checked={allSelected} onCheckedChange={(checked) => toggleSelectAll(checked === true)} aria-label="Select all" />,
      className: 'w-8',
      render: (m) => (
        <Checkbox checked={selected.has(m.id)} onCheckedChange={(checked) => toggleSelectOne(m.id, checked === true)} aria-label={`Select ${m.name}`} />
      ),
    },
    {
      key: 'member',
      header: sortableHeader('Member', 'name'),
      render: (m) => (
        <Link href={`/members/${m.id}`} className="flex items-center gap-2.5 hover:underline">
          <Avatar className="size-8">
            {m.profilePhotoUrl ? <AvatarImage src={m.profilePhotoUrl} alt="" /> : null}
            <AvatarFallback className="text-xs">
              {m.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span>
            <span className="block font-medium">{m.name}</span>
            <span className="block text-xs text-muted-foreground">{m.email ?? m.phone ?? '—'}</span>
          </span>
        </Link>
      ),
    },
    { key: 'memberId', header: sortableHeader('Member ID', 'memberId'), render: (m) => m.memberId || '—' },
    { key: 'branch', header: 'Branch', render: (m) => m.branch.name },
    { key: 'trainer', header: 'Trainer', render: (m) => m.trainer?.name ?? '—' },
    {
      key: 'plan',
      header: 'Membership',
      render: (m) =>
        m.currentMembership ? (
          <Link href={`/members/${m.id}#membership`} className="hover:underline">
            {m.currentMembership.planName} <Badge variant="secondary">{m.currentMembership.status}</Badge>
          </Link>
        ) : canAssignMembership && !m.deletedAt ? (
          <Button variant="link" size="sm" className="h-auto p-0 text-muted-foreground" asChild>
            <Link href={`/members/${m.id}#membership`}>Assign membership</Link>
          </Button>
        ) : (
          <span className="text-muted-foreground">No active plan</span>
        ),
    },
    { key: 'status', header: 'Status', render: (m) => <MemberStatusBadge status={m.status} deleted={!!m.deletedAt} /> },
    {
      key: 'joiningDate',
      header: sortableHeader('Joining date', 'joiningDate'),
      render: (m) => new Date(m.joiningDate).toLocaleDateString(),
    },
    {
      key: 'actions',
      header: '',
      className: 'w-10',
      render: (m) =>
        canManage || canDelete || canRestore || canAssignMembership ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8" aria-label={`Actions for ${m.name}`}>
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={`/members/${m.id}`}>View / edit</Link>
              </DropdownMenuItem>
              {canAssignMembership && !m.deletedAt && !m.currentMembership ? (
                <DropdownMenuItem asChild>
                  <Link href={`/members/${m.id}#membership`}>Assign membership</Link>
                </DropdownMenuItem>
              ) : null}
              {m.deletedAt ? (
                canRestore ? (
                  <DropdownMenuItem onClick={() => setConfirmAction({ kind: 'single', action: 'restore', ids: [m.id] })}>
                    Restore
                  </DropdownMenuItem>
                ) : null
              ) : canManage ? (
                m.status === 'ACTIVE' ? (
                  <DropdownMenuItem onClick={() => setConfirmAction({ kind: 'single', action: 'deactivate', ids: [m.id] })}>
                    Deactivate
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={() => setConfirmAction({ kind: 'single', action: 'activate', ids: [m.id] })}>
                    Activate
                  </DropdownMenuItem>
                )
              ) : null}
              {!m.deletedAt && canDelete ? (
                <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setConfirmAction({ kind: 'single', action: 'delete', ids: [m.id] })}>
                  Delete
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null,
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Members</h1>
          <p className="text-muted-foreground">Everyone training at your gym.</p>
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
          placeholder="Search name, email, phone, member ID…"
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

      <DataTable columns={columns} rows={items} rowKey={(m) => m.id} loading={members.isPending} emptyMessage="No members match these filters." />

      {data && data.totalPages > 1 ? (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Page {data.page} of {data.totalPages} · {data.total} members
          </span>
          <span className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <Button variant="outline" size="sm" disabled={page >= data.totalPages} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </span>
        </div>
      ) : null}

      {!members.isPending && (data?.total ?? 0) === 0 && !search && !status ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="size-4" /> Add your first member to get started.
        </p>
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
