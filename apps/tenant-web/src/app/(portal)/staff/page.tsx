'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowDown, ArrowUp, ArrowUpDown, Download, MoreHorizontal, Upload, UserPlus, Users } from 'lucide-react';
import { toast } from 'sonner';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { SearchBar } from '@/components/ui/search-bar';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { UserStatusBadge } from '@/features/iam/components/status-badge';
import { staffService } from '@/features/staff/services/staff.service';
import { toStaffError, useBulkImportStaff, useBulkStaffAction, useStaffList, useStaffStatusAction } from '@/features/staff/hooks/use-staff';
import type { ListStaffParams, StaffBulkImportRow, StaffListItem, StaffRole, UserStatus, WorkStatus } from '@/features/staff/types';
import { cn } from '@/lib/utils';

const selectClassName = cn(
  'h-9 rounded-md border border-input bg-background px-2 text-sm shadow-sm',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
);

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
  const [search, setSearch] = React.useState('');
  const [status, setStatus] = React.useState<UserStatus | ''>('');
  const [role, setRole] = React.useState<StaffRole | ''>('');
  const [workStatus, setWorkStatus] = React.useState<WorkStatus | ''>('');
  const [page, setPage] = React.useState(1);
  const [sortBy, setSortBy] = React.useState<SortableColumn>('createdAt');
  const [sortDir, setSortDir] = React.useState<'asc' | 'desc'>('desc');
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [confirmAction, setConfirmAction] = React.useState<{ kind: 'single' | 'bulk'; action: StatusAction; ids: string[] } | null>(
    null,
  );

  const staff = useStaffList({
    page,
    limit: 20,
    search: search || undefined,
    status: status || undefined,
    role: role || undefined,
    workStatus: workStatus || undefined,
    includeDeleted: true,
    sortBy,
    sortDir,
  });
  const statusAction = useStaffStatusAction();
  const bulkAction = useBulkStaffAction();
  const bulkImport = useBulkImportStaff();
  const importInputRef = React.useRef<HTMLInputElement>(null);

  const canManage = hasPermission('staff:update');
  const canCreate = hasPermission('staff:create');
  const canActivate = hasPermission('staff:activate');
  const canDelete = hasPermission('staff:delete');
  const canRestore = hasPermission('staff:restore');

  const data = staff.data;
  const items = data?.items ?? [];

  const toggleSort = (column: SortableColumn) => {
    if (sortBy === column) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
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

  const exportCsv = async () => {
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
  };

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

  const columns: DataTableColumn<StaffListItem>[] = [
    {
      key: 'select',
      header: (
        <Checkbox checked={allSelected} onCheckedChange={(checked) => toggleSelectAll(checked === true)} aria-label="Select all" />
      ),
      className: 'w-8',
      render: (s) => (
        <Checkbox
          checked={selected.has(s.id)}
          onCheckedChange={(checked) => toggleSelectOne(s.id, checked === true)}
          aria-label={`Select ${s.name}`}
        />
      ),
    },
    {
      key: 'staff',
      header: sortableHeader('Staff', 'name'),
      render: (s) => (
        <Link href={`/staff/${s.id}`} className="flex items-center gap-2.5 hover:underline">
          <Avatar className="size-8">
            {s.avatarUrl ? <AvatarImage src={s.avatarUrl} alt="" /> : null}
            <AvatarFallback className="text-xs">
              {s.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span>
            <span className="block font-medium">{s.name}</span>
            <span className="block text-xs text-muted-foreground">{s.email}</span>
          </span>
        </Link>
      ),
    },
    {
      key: 'employeeId',
      header: sortableHeader('Employee ID', 'employeeId'),
      render: (s) => s.employeeId || '—',
    },
    { key: 'role', header: 'Role', render: (s) => <Badge variant="secondary">{s.role}</Badge> },
    { key: 'branch', header: 'Primary branch', render: (s) => s.primaryBranch?.branchName ?? '—' },
    { key: 'status', header: 'Status', render: (s) => <UserStatusBadge status={s.status} deleted={!!s.deletedAt} /> },
    { key: 'workStatus', header: 'Work status', render: (s) => s.workStatus.replace('_', ' ') },
    {
      key: 'joiningDate',
      header: sortableHeader('Joining date', 'joiningDate'),
      render: (s) => new Date(s.joiningDate).toLocaleDateString(),
    },
    {
      key: 'actions',
      header: '',
      className: 'w-10',
      render: (s) =>
        canManage || canActivate || canDelete || canRestore ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8" aria-label={`Actions for ${s.name}`}>
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={`/staff/${s.id}`}>View / edit</Link>
              </DropdownMenuItem>
              {s.deletedAt || s.status === 'SUSPENDED' || s.status === 'DEACTIVATED' ? (
                canRestore ? (
                  <DropdownMenuItem
                    onClick={() =>
                      setConfirmAction({ kind: 'single', action: s.deletedAt ? 'restore' : 'activate', ids: [s.id] })
                    }
                  >
                    Restore / activate
                  </DropdownMenuItem>
                ) : null
              ) : canActivate ? (
                <>
                  <DropdownMenuItem onClick={() => setConfirmAction({ kind: 'single', action: 'suspend', ids: [s.id] })}>
                    Suspend
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setConfirmAction({ kind: 'single', action: 'deactivate', ids: [s.id] })}>
                    Deactivate
                  </DropdownMenuItem>
                </>
              ) : null}
              {!s.deletedAt && canDelete ? (
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => setConfirmAction({ kind: 'single', action: 'delete', ids: [s.id] })}
                >
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
          <h1 className="text-2xl font-semibold tracking-tight">Staff</h1>
          <p className="text-muted-foreground">Managers, trainers, and receptionists at your gym.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {hasPermission('staff:view') ? (
            <Button variant="outline" size="sm" onClick={() => void exportCsv()}>
              <Download className="size-4" /> Export
            </Button>
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
              <Button size="sm" asChild>
                <Link href="/staff/new">
                  <UserPlus className="size-4" /> Add staff
                </Link>
              </Button>
            </>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SearchBar
          containerClassName="max-w-xs"
          placeholder="Search name, email, phone, employee ID…"
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
            setStatus(e.target.value as UserStatus | '');
            setPage(1);
          }}
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          {(['ACTIVE', 'PENDING_VERIFICATION', 'LOCKED', 'SUSPENDED', 'DEACTIVATED'] as const).map((s) => (
            <option key={s} value={s}>{s.replace('_', ' ')}</option>
          ))}
        </select>
        <select
          className={selectClassName}
          value={role}
          onChange={(e) => {
            setRole(e.target.value as StaffRole | '');
            setPage(1);
          }}
          aria-label="Filter by role"
        >
          <option value="">All roles</option>
          <option value="MANAGER">Manager</option>
          <option value="TRAINER">Trainer</option>
          <option value="RECEPTIONIST">Receptionist</option>
        </select>
        <select
          className={selectClassName}
          value={workStatus}
          onChange={(e) => {
            setWorkStatus(e.target.value as WorkStatus | '');
            setPage(1);
          }}
          aria-label="Filter by work status"
        >
          <option value="">All work statuses</option>
          <option value="WORKING">Working</option>
          <option value="ON_LEAVE">On leave</option>
          <option value="NOTICE_PERIOD">Notice period</option>
          <option value="TERMINATED">Terminated</option>
        </select>
      </div>

      {selected.size > 0 && (canActivate || canDelete) ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/40 p-2.5 text-sm">
          <span className="font-medium">{selected.size} selected</span>
          {canActivate ? (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setConfirmAction({ kind: 'bulk', action: 'activate', ids: [...selected] })}
              >
                Bulk activate
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setConfirmAction({ kind: 'bulk', action: 'deactivate', ids: [...selected] })}
              >
                Bulk deactivate
              </Button>
            </>
          ) : null}
          {canDelete ? (
            <Button
              size="sm"
              variant="destructive"
              onClick={() => setConfirmAction({ kind: 'bulk', action: 'delete', ids: [...selected] })}
            >
              Bulk delete
            </Button>
          ) : null}
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
            Clear
          </Button>
        </div>
      ) : null}

      <DataTable
        columns={columns}
        rows={items}
        rowKey={(s) => s.id}
        loading={staff.isPending}
        emptyMessage="No staff match these filters."
      />

      {data && data.totalPages > 1 ? (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Page {data.page} of {data.totalPages} · {data.total} staff
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

      {!staff.isPending && (data?.total ?? 0) === 0 && !search && !status && !role && !workStatus ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="size-4" /> Add your first staff member to get started.
        </p>
      ) : null}

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
    </div>
  );
}
