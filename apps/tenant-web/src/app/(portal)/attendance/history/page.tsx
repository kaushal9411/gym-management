'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowDown, ArrowLeft, ArrowUp, ArrowUpDown, Download, MoreHorizontal } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SearchBar } from '@/components/ui/search-bar';
import { AttendanceMethodBadge, AttendanceStatusBadge } from '@/features/attendance/components/attendance-badges';
import { toAttendanceError, useAttendanceList, useDeleteAttendance, useUpdateAttendance } from '@/features/attendance/hooks/use-attendance';
import { attendanceService } from '@/features/attendance/services/attendance.service';
import type { AttendanceMethod, AttendanceRecord, AttendanceStatus, ListAttendanceParams } from '@/features/attendance/types';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { BranchSelect } from '@/features/members/components/branch-select';
import { cn } from '@/lib/utils';

const selectClassName = cn(
  'h-9 rounded-md border border-input bg-background px-2 text-sm shadow-sm',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
);

type SortableColumn = NonNullable<ListAttendanceParams['sortBy']>;

interface EditState {
  id: string;
  checkOutTime: string;
  notes: string;
  status: AttendanceStatus;
}

function toLocalInputValue(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function AttendanceHistoryPage() {
  const { hasPermission } = usePermissions();
  const [search, setSearch] = React.useState('');
  const [branchId, setBranchId] = React.useState('');
  const [status, setStatus] = React.useState<AttendanceStatus | ''>('');
  const [method, setMethod] = React.useState<AttendanceMethod | ''>('');
  const [dateFrom, setDateFrom] = React.useState('');
  const [dateTo, setDateTo] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [sortBy, setSortBy] = React.useState<SortableColumn>('checkInTime');
  const [sortDir, setSortDir] = React.useState<'asc' | 'desc'>('desc');
  const [editState, setEditState] = React.useState<EditState | null>(null);
  const [deleteId, setDeleteId] = React.useState<string | null>(null);

  const canUpdate = hasPermission('attendance:update');
  const canDelete = hasPermission('attendance:delete');
  const canExport = hasPermission('attendance:export');

  const params: ListAttendanceParams = {
    page,
    limit: 20,
    search: search || undefined,
    branchId: branchId || undefined,
    status: status || undefined,
    method: method || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    sortBy,
    sortDir,
  };
  const records = useAttendanceList(params);
  const updateAttendance = useUpdateAttendance();
  const deleteAttendance = useDeleteAttendance();

  const data = records.data;
  const items = data?.items ?? [];

  const toggleSort = (column: SortableColumn) => {
    if (sortBy === column) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortBy(column);
      setSortDir('desc');
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

  const exportAs = async (format: 'csv' | 'excel') => {
    try {
      const url = format === 'csv' ? await attendanceService.exportCsvUrl(params) : await attendanceService.exportExcelUrl(params);
      const a = document.createElement('a');
      a.href = url;
      a.download = `attendance-export.${format === 'csv' ? 'csv' : 'xlsx'}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(toAttendanceError(err).message);
    }
  };

  const saveEdit = () => {
    if (!editState) return;
    updateAttendance.mutate(
      {
        id: editState.id,
        payload: {
          checkOutTime: editState.checkOutTime ? new Date(editState.checkOutTime).toISOString() : null,
          notes: editState.notes,
          status: editState.status,
        },
      },
      {
        onSuccess: () => {
          toast.success('Attendance record updated.');
          setEditState(null);
        },
        onError: (err) => toast.error(toAttendanceError(err).message),
      },
    );
  };

  const confirmDelete = () => {
    if (!deleteId) return;
    deleteAttendance.mutate(deleteId, {
      onSuccess: () => {
        toast.success('Attendance record deleted.');
        setDeleteId(null);
      },
      onError: (err) => {
        toast.error(toAttendanceError(err).message);
        setDeleteId(null);
      },
    });
  };

  const columns: DataTableColumn<AttendanceRecord>[] = [
    {
      key: 'member',
      header: 'Member',
      render: (r) => (
        <Link href={`/members/${r.member.id}`} className="hover:underline">
          <span className="block font-medium">{r.member.name}</span>
          <span className="block text-xs text-muted-foreground">{r.member.memberId}</span>
        </Link>
      ),
    },
    { key: 'branch', header: 'Branch', render: (r) => r.branch.name },
    {
      key: 'checkInTime',
      header: sortableHeader('Check in', 'checkInTime'),
      render: (r) => new Date(r.checkInTime).toLocaleString(),
    },
    { key: 'checkOutTime', header: 'Check out', render: (r) => (r.checkOutTime ? new Date(r.checkOutTime).toLocaleString() : '—') },
    { key: 'method', header: 'Method', render: (r) => <AttendanceMethodBadge method={r.method} /> },
    { key: 'status', header: 'Status', render: (r) => <AttendanceStatusBadge status={r.status} /> },
    {
      key: 'actions',
      header: '',
      className: 'w-10',
      render: (r) =>
        canUpdate || canDelete ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8" aria-label={`Actions for ${r.member.name}`}>
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {canUpdate ? (
                <DropdownMenuItem
                  onClick={() =>
                    setEditState({ id: r.id, checkOutTime: toLocalInputValue(r.checkOutTime), notes: r.notes ?? '', status: r.status })
                  }
                >
                  Edit
                </DropdownMenuItem>
              ) : null}
              {canDelete ? (
                <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeleteId(r.id)}>
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
          <Button variant="ghost" size="sm" asChild className="-ml-2 mb-1">
            <Link href="/attendance">
              <ArrowLeft className="size-4" /> Back to attendance
            </Link>
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight">Attendance history</h1>
          <p className="text-muted-foreground">Every check-in and check-out, searchable and filterable.</p>
        </div>
        {canExport ? (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => void exportAs('csv')}>
              <Download className="size-4" /> Export CSV
            </Button>
            <Button variant="outline" size="sm" onClick={() => void exportAs('excel')}>
              <Download className="size-4" /> Export Excel
            </Button>
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SearchBar
          containerClassName="max-w-xs"
          placeholder="Search member name or ID…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <div className="w-48">
          <BranchSelect
            value={branchId}
            onChange={(v) => {
              setBranchId(v);
              setPage(1);
            }}
          />
        </div>
        <select
          className={selectClassName}
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as AttendanceStatus | '');
            setPage(1);
          }}
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          <option value="CHECKED_IN">Checked in</option>
          <option value="CHECKED_OUT">Checked out</option>
        </select>
        <select
          className={selectClassName}
          value={method}
          onChange={(e) => {
            setMethod(e.target.value as AttendanceMethod | '');
            setPage(1);
          }}
          aria-label="Filter by method"
        >
          <option value="">All methods</option>
          <option value="QR_CODE">QR Code</option>
          <option value="MANUAL">Manual</option>
          <option value="BIOMETRIC">Biometric</option>
          <option value="FACE_RECOGNITION">Face Recognition</option>
          <option value="NFC">NFC</option>
          <option value="RFID">RFID</option>
        </select>
        <Input
          type="date"
          className="h-9 w-40"
          aria-label="From date"
          value={dateFrom}
          onChange={(e) => {
            setDateFrom(e.target.value);
            setPage(1);
          }}
        />
        <Input
          type="date"
          className="h-9 w-40"
          aria-label="To date"
          value={dateTo}
          onChange={(e) => {
            setDateTo(e.target.value);
            setPage(1);
          }}
        />
      </div>

      <DataTable columns={columns} rows={items} rowKey={(r) => r.id} loading={records.isPending} emptyMessage="No attendance records match these filters." />

      {data && data.totalPages > 1 ? (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Page {data.page} of {data.totalPages} · {data.total} records
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

      <Dialog open={!!editState} onOpenChange={(open) => !open && setEditState(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit attendance record</DialogTitle>
          </DialogHeader>
          {editState ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="editCheckOutTime">Check-out time</Label>
                <Input
                  id="editCheckOutTime"
                  type="datetime-local"
                  value={editState.checkOutTime}
                  onChange={(e) => setEditState({ ...editState, checkOutTime: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="editStatus">Status</Label>
                <select
                  id="editStatus"
                  className={cn(selectClassName, 'w-full')}
                  value={editState.status}
                  onChange={(e) => setEditState({ ...editState, status: e.target.value as AttendanceStatus })}
                >
                  <option value="CHECKED_IN">Checked in</option>
                  <option value="CHECKED_OUT">Checked out</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="editNotes">Notes</Label>
                <textarea
                  id="editNotes"
                  className="flex min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm"
                  value={editState.notes}
                  onChange={(e) => setEditState({ ...editState, notes: e.target.value })}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setEditState(null)}>
                  Cancel
                </Button>
                <Button disabled={updateAttendance.isPending} onClick={saveEdit}>
                  {updateAttendance.isPending ? 'Saving…' : 'Save changes'}
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Delete this attendance record?"
        description="This soft-deletes the record — it stays in the database but drops out of reports and history."
        destructive
        loading={deleteAttendance.isPending}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
