'use client';

import { useDebouncedValue } from '@/hooks/use-debounced-value';
import * as React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowDown, ArrowLeft, ArrowUp, ArrowUpDown, Download, DoorOpen, LogIn, LogOut, MoreHorizontal, Search } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Pagination } from '@/components/ui/pagination';
import { AttendanceMethodBadge, AttendanceStatusBadge } from '@/features/attendance/components/attendance-badges';
import { toAttendanceError, useAttendanceList, useAttendanceSummary, useDeleteAttendance, useUpdateAttendance } from '@/features/attendance/hooks/use-attendance';
import { attendanceService } from '@/features/attendance/services/attendance.service';
import type { AttendanceMethod, AttendanceRecord, AttendanceStatus, ListAttendanceParams } from '@/features/attendance/types';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { useCurrentBranch } from '@/features/branch/hooks/use-branches';
import { accentVar, CountUp, type Accent } from '@/features/members/components/detail/detail-ui';
import { BranchSelect } from '@/features/members/components/branch-select';
import { cn } from '@/lib/utils';

const selectClassName = cn(
  'h-10 rounded-xl border border-input bg-background px-2.5 text-sm shadow-xs transition-all duration-150',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:border-ring',
);

type SortableColumn = NonNullable<ListAttendanceParams['sortBy']>;

interface EditState {
  id: string;
  memberName: string;
  memberCode: string;
  checkInTime: string;
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

function GlanceChip({ icon: Icon, label, value, accent }: { icon: typeof LogIn; label: string; value: number; accent: Accent }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-sm shadow-xs" style={{ borderColor: `color-mix(in oklch, ${accentVar(accent)} 22%, transparent)` }}>
      <Icon className="size-3.5" style={{ color: accentVar(accent) }} aria-hidden />
      <b className="tabular-nums" style={{ color: accentVar(accent) }}><CountUp value={value} /></b>
      <span className="text-muted-foreground">{label}</span>
    </span>
  );
}

export default function AttendanceHistoryPage() {
  const { hasPermission } = usePermissions();
  const { currentBranchId } = useCurrentBranch();
  const [search, setSearch] = React.useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
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

  // Defaults from, and stays in sync with, the header's branch switcher —
  // still locally overridable (e.g. back to "all branches") for this page view.
  React.useEffect(() => {
    setBranchId(currentBranchId ?? '');
    setPage(1);
  }, [currentBranchId]);

  const params: ListAttendanceParams = {
    page,
    limit: 20,
    search: debouncedSearch || undefined,
    branchId: branchId || undefined,
    status: status || undefined,
    method: method || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    sortBy,
    sortDir,
  };
  const records = useAttendanceList(params);
  // Today's headline figures, for the glance strip — reuses the same summary endpoint the dashboard uses.
  const glance = useAttendanceSummary({ branchId: branchId || undefined });
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
                    setEditState({
                      id: r.id,
                      memberName: r.member.name,
                      memberCode: r.member.memberId,
                      checkInTime: r.checkInTime,
                      checkOutTime: toLocalInputValue(r.checkOutTime),
                      notes: r.notes ?? '',
                      status: r.status,
                    })
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
    <div className="w-full space-y-5">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/attendance">
          <ArrowLeft className="size-4" /> Back to attendance
        </Link>
      </Button>

      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative grid gap-4 overflow-hidden rounded-3xl p-6 text-white shadow-lg lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:px-7"
        style={{ backgroundImage: 'radial-gradient(900px 320px at 88% -30%, color-mix(in oklch, #c026d3 75%, transparent), transparent 60%), linear-gradient(115deg, #4338ca, #7c3aed 62%, #c026d3)' }}
      >
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-60" style={{ backgroundImage: 'repeating-linear-gradient(135deg, rgba(255,255,255,.06) 0 1px, transparent 1px 14px)' }} />
        <div className="relative min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-widest text-white/80">Log</p>
          <h1 className="mt-0.5 text-3xl font-extrabold tracking-tight sm:text-4xl">Attendance history</h1>
          <p className="mt-1 text-white/85">Every check-in and check-out, searchable and filterable.</p>
        </div>
        {canExport ? (
          <div className="relative flex flex-wrap items-center gap-2 [&_button]:border-white/30 [&_button]:bg-white/15 [&_button]:text-white [&_button:hover]:bg-white/25">
            <Button variant="secondary" size="sm" onClick={() => void exportAs('csv')}>
              <Download className="size-4" /> Export CSV
            </Button>
            <Button variant="secondary" size="sm" onClick={() => void exportAs('excel')}>
              <Download className="size-4" /> Export Excel
            </Button>
          </div>
        ) : null}
      </motion.section>

      <div className="flex flex-wrap items-center gap-2.5">
        <GlanceChip icon={LogIn} label="checked in today" value={glance.data?.totalCheckInsToday ?? 0} accent="success" />
        <GlanceChip icon={LogOut} label="checked out today" value={glance.data?.totalCheckOutsToday ?? 0} accent="aqua" />
        <GlanceChip icon={DoorOpen} label="inside right now" value={glance.data?.currentlyInside ?? 0} accent="primary" />
      </div>

      <div className="sticky top-2 z-10 flex flex-wrap items-center gap-2.5 rounded-2xl border bg-card/90 p-2.5 shadow-sm backdrop-blur">
        <label className="flex h-10 min-w-[200px] flex-1 items-center gap-2 rounded-xl border bg-background px-3 transition-all focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/15">
          <Search className="size-4 text-muted-foreground" aria-hidden />
          <input
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search member name or ID…"
            aria-label="Search attendance"
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </label>
        <div className="w-44">
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
          className="h-10 w-40 rounded-xl"
          aria-label="From date"
          value={dateFrom}
          onChange={(e) => {
            setDateFrom(e.target.value);
            setPage(1);
          }}
        />
        <Input
          type="date"
          className="h-10 w-40 rounded-xl"
          aria-label="To date"
          value={dateTo}
          onChange={(e) => {
            setDateTo(e.target.value);
            setPage(1);
          }}
        />
      </div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }}>
        <DataTable columns={columns} rows={items} rowKey={(r) => r.id} loading={records.isPending} error={records.error} onRetry={() => records.refetch()} emptyMessage="No attendance records match these filters." />
      </motion.div>

      {data ? (
        <Pagination page={page} totalPages={data.totalPages} onPageChange={setPage} totalItems={data.total} pageSize={20} />
      ) : null}

      <Dialog open={!!editState} onOpenChange={(open) => !open && setEditState(null)}>
        <DialogContent className="max-w-md gap-0 overflow-hidden p-0">
          {editState ? (
            <>
              <div
                className="relative overflow-hidden p-5 text-white"
                style={{ backgroundImage: 'linear-gradient(115deg, #4338ca, #7c3aed 62%, #c026d3)' }}
              >
                <div aria-hidden className="pointer-events-none absolute inset-0 opacity-60" style={{ backgroundImage: 'repeating-linear-gradient(135deg, rgba(255,255,255,.06) 0 1px, transparent 1px 14px)' }} />
                <DialogHeader className="relative">
                  <DialogTitle className="text-white">Edit attendance record</DialogTitle>
                </DialogHeader>
                <div className="relative mt-3 flex items-center gap-3">
                  <span
                    className="flex size-10 shrink-0 items-center justify-center rounded-full text-[12px] font-extrabold text-white"
                    style={{ backgroundImage: 'linear-gradient(135deg, var(--chart-3), var(--chart-7))' }}
                  >
                    {editState.memberName.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{editState.memberName}</p>
                    <p className="truncate text-xs text-white/80">
                      {editState.memberCode} · Checked in {new Date(editState.checkInTime).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4 p-5">
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
                    className="flex min-h-20 w-full rounded-lg border border-input bg-background px-3.5 py-2 text-sm shadow-xs transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:border-ring"
                    value={editState.notes}
                    onChange={(e) => setEditState({ ...editState, notes: e.target.value })}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setEditState(null)}>
                    Cancel
                  </Button>
                  <Button
                    disabled={updateAttendance.isPending}
                    onClick={saveEdit}
                    className="border-0 text-white shadow-md"
                    style={{ backgroundImage: 'linear-gradient(120deg, var(--success), var(--chart-3))' }}
                  >
                    {updateAttendance.isPending ? 'Saving…' : 'Save changes'}
                  </Button>
                </div>
              </div>
            </>
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
