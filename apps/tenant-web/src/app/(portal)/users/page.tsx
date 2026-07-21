'use client';

import * as React from 'react';
import Link from 'next/link';
import { Download, MoreHorizontal, Upload, UserPlus, Users } from 'lucide-react';
import { toast } from 'sonner';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SearchBar } from '@/components/ui/search-bar';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { IamNav } from '@/features/iam/components/iam-nav';
import { InviteDialog } from '@/features/iam/components/invite-dialog';
import { UserStatusBadge } from '@/features/iam/components/status-badge';
import { iamService } from '@/features/iam/services/iam.service';
import {
  toIamError,
  useBulkImportUsers,
  useRoles,
  useUserStatusAction,
  useUsers,
} from '@/features/iam/hooks/use-iam';
import type { UserListItem, UserStatus } from '@/features/iam/types';
import { cn } from '@/lib/utils';

const selectClassName = cn(
  'h-9 rounded-md border border-input bg-background px-2 text-sm shadow-sm',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
);

/** Minimal CSV parser for the import sheet: header row `name,email,phone,roleName,password`. */
function parseCsv(text: string): Array<{ name: string; email: string; phone?: string; roleName?: string; password?: string }> {
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
      name: row.name ?? '',
      email: row.email ?? '',
      phone: row.phone,
      roleName: row.rolename ?? row.role,
      password: row.password,
    };
  });
}

export default function UsersPage() {
  const { hasPermission } = usePermissions();
  const [search, setSearch] = React.useState('');
  const [status, setStatus] = React.useState<UserStatus | ''>('');
  const [roleId, setRoleId] = React.useState('');
  const [page, setPage] = React.useState(1);

  const users = useUsers({
    page,
    limit: 20,
    search: search || undefined,
    status: status || undefined,
    roleId: roleId || undefined,
    includeDeleted: true,
  });
  const roles = useRoles();
  const statusAction = useUserStatusAction();
  const bulkImport = useBulkImportUsers();
  const importInputRef = React.useRef<HTMLInputElement>(null);

  const canManage = hasPermission('users:manage');

  const runAction = (user: UserListItem, action: 'suspend' | 'deactivate' | 'restore' | 'delete') => {
    statusAction.mutate(
      { userId: user.id, action },
      {
        onSuccess: () => toast.success(`${user.name}: ${action}d`.replace('deleted', 'deleted (soft)')),
        onError: (err) => toast.error(toIamError(err).message),
      },
    );
  };

  const exportCsv = async () => {
    try {
      const url = await iamService.exportUsersCsvUrl();
      const a = document.createElement('a');
      a.href = url;
      a.download = 'staff-export.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(toIamError(err).message);
    }
  };

  const handleImportFile = async (file: File | undefined) => {
    if (!file) return;
    const rows = parseCsv(await file.text());
    if (rows.length === 0) {
      toast.error('No rows found — the first line must be a header: name,email,phone,roleName,password');
      return;
    }
    bulkImport.mutate(rows, {
      onSuccess: (result) => {
        toast.success(`${result.created} user(s) imported${result.failed.length ? `, ${result.failed.length} failed` : ''}`);
        for (const failure of result.failed.slice(0, 3)) {
          toast.error(`Row ${failure.row} (${failure.email}): ${failure.reason}`);
        }
      },
      onError: (err) => toast.error(toIamError(err).message),
    });
  };

  const columns: DataTableColumn<UserListItem>[] = [
    {
      key: 'user',
      header: 'User',
      render: (u) => (
        <Link href={`/users/${u.id}`} className="flex items-center gap-2.5 hover:underline">
          <Avatar className="size-8">
            {u.avatarUrl ? <AvatarImage src={u.avatarUrl} alt="" /> : null}
            <AvatarFallback className="text-xs">
              {u.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span>
            <span className="block font-medium">{u.name}</span>
            <span className="block text-xs text-muted-foreground">{u.email}</span>
          </span>
        </Link>
      ),
    },
    {
      key: 'roles',
      header: 'Roles',
      render: (u) => (
        <span className="flex flex-wrap gap-1">
          {u.roles.map((r) => (
            <Badge key={r.id} variant={r.isSystem ? 'secondary' : 'outline'}>{r.name}</Badge>
          ))}
        </span>
      ),
    },
    {
      key: 'branches',
      header: 'Branches',
      render: (u) => (u.allBranches ? 'All' : u.branches.map((b) => b.branchName).join(', ') || '—'),
    },
    { key: 'status', header: 'Status', render: (u) => <UserStatusBadge status={u.status} deleted={!!u.deletedAt} /> },
    {
      key: 'lastLogin',
      header: 'Last login',
      render: (u) => (u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : 'Never'),
    },
    {
      key: 'actions',
      header: '',
      className: 'w-10',
      render: (u) =>
        canManage ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8" aria-label={`Actions for ${u.name}`}>
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={`/users/${u.id}`}>View / edit</Link>
              </DropdownMenuItem>
              {u.deletedAt || u.status === 'SUSPENDED' || u.status === 'DEACTIVATED' ? (
                <DropdownMenuItem onClick={() => runAction(u, 'restore')}>Restore</DropdownMenuItem>
              ) : (
                <>
                  <DropdownMenuItem onClick={() => runAction(u, 'suspend')}>Suspend</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => runAction(u, 'deactivate')}>Deactivate</DropdownMenuItem>
                </>
              )}
              {!u.deletedAt ? (
                <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => runAction(u, 'delete')}>
                  Delete
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null,
    },
  ];

  const data = users.data;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Staff &amp; Access</h1>
          <p className="text-muted-foreground">Manage your team, their roles, and what they can do.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {hasPermission('users:export') ? (
            <Button variant="outline" size="sm" onClick={() => void exportCsv()}>
              <Download className="size-4" /> Export
            </Button>
          ) : null}
          {canManage ? (
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
          {hasPermission('users:invite') ? <InviteDialog /> : null}
          {canManage ? (
            <Button size="sm" asChild>
              <Link href="/users/new">
                <UserPlus className="size-4" /> New user
              </Link>
            </Button>
          ) : null}
        </div>
      </div>

      <IamNav />

      <div className="flex flex-wrap items-center gap-2">
        <SearchBar
          containerClassName="max-w-xs"
          placeholder="Search name, email, phone…"
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
          value={roleId}
          onChange={(e) => {
            setRoleId(e.target.value);
            setPage(1);
          }}
          aria-label="Filter by role"
        >
          <option value="">All roles</option>
          {(roles.data ?? []).map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
      </div>

      <DataTable
        columns={columns}
        rows={data?.items ?? []}
        rowKey={(u) => u.id}
        loading={users.isPending}
        emptyMessage="No users match these filters."
      />

      {data && data.totalPages > 1 ? (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Page {data.page} of {data.totalPages} · {data.total} users
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

      {!users.isPending && (data?.total ?? 0) === 0 && !search && !status && !roleId ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="size-4" /> Invite your first staff member to get started.
        </p>
      ) : null}
    </div>
  );
}
