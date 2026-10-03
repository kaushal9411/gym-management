'use client';

import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useSubmitHandler } from '@/hooks/use-submit-handler';
import * as React from 'react';
import Link from 'next/link';
import { AlertTriangle, Download, Upload, UserPlus, Users } from 'lucide-react';
import { toast } from 'sonner';

import { LoadingButton } from '@/components/ui/loading-button';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Pagination } from '@/components/ui/pagination';
import { Skeleton } from '@/components/ui/skeleton';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { useCurrentBranch } from '@/features/branch/hooks/use-branches';
import { IamHero } from '@/features/iam/components/iam-hero';
import { InviteDialog } from '@/features/iam/components/invite-dialog';
import { UserCard } from '@/features/iam/components/user-card';
import { UsersInsights, UsersKpis } from '@/features/iam/components/users-overview';
import { UsersToolbar } from '@/features/iam/components/users-toolbar';
import { iamService } from '@/features/iam/services/iam.service';
import {
  toIamError,
  useBulkImportUsers,
  useRoles,
  useUserStats,
  useUserStatusAction,
  useUsers,
} from '@/features/iam/hooks/use-iam';
import type { UserListItem, UserStatus } from '@/features/iam/types';

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
  const { currentBranchId } = useCurrentBranch();
  const [search, setSearch] = React.useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [status, setStatus] = React.useState<UserStatus | ''>('');
  const [roleId, setRoleId] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [view, setView] = React.useState<'grid' | 'list'>('grid');

  const users = useUsers({
    page,
    limit: 20,
    search: debouncedSearch || undefined,
    status: status || undefined,
    roleId: roleId || undefined,
    branchId: currentBranchId ?? undefined,
    includeDeleted: true,
  });

  // Header branch switch re-scopes the whole list — back to page 1 like any other filter change.
  React.useEffect(() => {
    setPage(1);
  }, [currentBranchId]);
  const roles = useRoles();
  const stats = useUserStats(currentBranchId ?? undefined);
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

  const { isSubmitting: exporting, submit: exportCsv } = useSubmitHandler(async () => {
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
  });

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

  const data = users.data;
  const items = data?.items ?? [];

  return (
    <div className="w-full space-y-5">
      <IamHero
        title="Staff & Access"
        subtitle="Manage your team, their roles, and what they can do."
        actions={
          <>
            {hasPermission('users:export') ? (
              <LoadingButton variant="outline" size="sm" loading={exporting} loadingText="Exporting…" onClick={() => void exportCsv()}>
                <Download className="size-4" /> Export
              </LoadingButton>
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
              <Button size="sm" asChild data-solid className="border-0 bg-white text-indigo-700 shadow-lg hover:bg-white/90">
                <Link href="/users/new">
                  <UserPlus className="size-4" /> New user
                </Link>
              </Button>
            ) : null}
          </>
        }
      />

      <UsersKpis
        stats={stats.data}
        loading={stats.isPending}
        status={status}
        onStatus={(s) => {
          setStatus(s);
          setPage(1);
        }}
      />
      <UsersInsights stats={stats.data} loading={stats.isPending} />

      <UsersToolbar
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
        roleId={roleId}
        onRole={(v) => {
          setRoleId(v);
          setPage(1);
        }}
        roles={roles.data ?? []}
        view={view}
        onView={setView}
      />

      {users.error ? (
        <EmptyState
          icon={AlertTriangle}
          title="Couldn't load this data"
          description={users.error instanceof Error ? users.error.message : 'Something went wrong loading this data.'}
          className="border-destructive/30"
          action={
            <Button variant="outline" size="sm" onClick={() => users.refetch()}>
              Retry
            </Button>
          }
        />
      ) : users.isPending ? (
        <div className={view === 'grid' ? 'grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4' : 'space-y-3'}>
          {Array.from({ length: view === 'grid' ? 8 : 5 }).map((_, i) => (
            <Skeleton key={i} className={view === 'grid' ? 'h-[300px] w-full rounded-3xl' : 'h-20 w-full rounded-2xl'} />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState icon={Users} title={!search && !status && !roleId ? 'Invite your first staff member to get started.' : 'No users match these filters.'} />
      ) : (
        <div className={view === 'grid' ? 'grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4' : 'space-y-2.5'}>
          {items.map((u, i) => (
            <UserCard key={u.id} user={u} index={i} variant={view} canManage={canManage} onAction={(action) => runAction(u, action)} />
          ))}
        </div>
      )}

      {data ? <Pagination page={page} totalPages={data.totalPages} onPageChange={setPage} totalItems={data.total} pageSize={20} /> : null}
    </div>
  );
}
