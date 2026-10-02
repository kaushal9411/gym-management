'use client';

import * as React from 'react';
import { Fingerprint, KeyRound, MoreHorizontal, Plus } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { AttendanceDeviceStatusBadge, AttendanceDeviceVendorBadge } from '@/features/attendance-device/components/attendance-device-badges';
import { RegenerateKeyDialog } from '@/features/attendance-device/components/regenerate-key-dialog';
import { RegisterDeviceDialog } from '@/features/attendance-device/components/register-device-dialog';
import { toAttendanceDeviceError, useAttendanceDevices, useDeleteAttendanceDevice, useUpdateAttendanceDevice } from '@/features/attendance-device/hooks/use-attendance-devices';
import type { AttendanceDevice } from '@/features/attendance-device/types';

type StatusAction = 'activate' | 'deactivate' | 'delete';

function formatLastSeen(lastSeenAt: string | null): string {
  if (!lastSeenAt) return 'Never synced';
  const diffMs = Date.now() - new Date(lastSeenAt).getTime();
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return 'Synced just now';
  if (minutes < 60) return `Synced ${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Synced ${hours}h ago`;
  const days = Math.round(hours / 24);
  return days <= 3 ? `Synced ${days}d ago` : `Last synced ${new Date(lastSeenAt).toLocaleDateString()}`;
}

export default function AttendanceDevicesPage() {
  const { hasPermission } = usePermissions();
  const canManage = hasPermission('attendance-devices:manage');

  const devices = useAttendanceDevices();
  const updateDevice = useUpdateAttendanceDevice();
  const deleteDevice = useDeleteAttendanceDevice();

  const [registerOpen, setRegisterOpen] = React.useState(false);
  const [keyDevice, setKeyDevice] = React.useState<AttendanceDevice | null>(null);
  const [confirmAction, setConfirmAction] = React.useState<{ action: StatusAction; device: AttendanceDevice } | null>(null);

  const runAction = () => {
    if (!confirmAction) return;
    const { action, device } = confirmAction;
    if (action === 'delete') {
      deleteDevice.mutate(device.id, {
        onSuccess: () => toast.success('Device removed.'),
        onError: (err) => toast.error(toAttendanceDeviceError(err).message),
      });
    } else {
      updateDevice.mutate(
        { deviceId: device.id, input: { isActive: action === 'activate' } },
        {
          onSuccess: () => toast.success(action === 'activate' ? 'Device activated.' : 'Device disabled.'),
          onError: (err) => toast.error(toAttendanceDeviceError(err).message),
        },
      );
    }
    setConfirmAction(null);
  };

  const columns: DataTableColumn<AttendanceDevice>[] = [
    {
      key: 'name',
      header: 'Device',
      render: (d) => (
        <div>
          <span className="flex items-center gap-1.5 font-medium">{d.name}</span>
          <span className="block text-xs text-muted-foreground">{d.branchName}</span>
        </div>
      ),
    },
    { key: 'vendor', header: 'Vendor', render: (d) => <AttendanceDeviceVendorBadge vendor={d.vendor} /> },
    { key: 'status', header: 'Status', render: (d) => <AttendanceDeviceStatusBadge isActive={d.isActive} /> },
    { key: 'lastSeen', header: 'Sync', render: (d) => <span className="text-sm text-muted-foreground">{formatLastSeen(d.lastSeenAt)}</span> },
    {
      key: 'actions',
      header: '',
      className: 'w-10',
      render: (d) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-8" aria-label={`Actions for ${d.name}`}>
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {canManage ? (
              <>
                <DropdownMenuItem onClick={() => setKeyDevice(d)}>
                  <KeyRound className="size-4" /> Regenerate key
                </DropdownMenuItem>
                {d.isActive ? (
                  <DropdownMenuItem onClick={() => setConfirmAction({ action: 'deactivate', device: d })}>Disable</DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={() => setConfirmAction({ action: 'activate', device: d })}>Activate</DropdownMenuItem>
                )}
                <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setConfirmAction({ action: 'delete', device: d })}>
                  Remove
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3.5">
          <span
            className="flex size-10 shrink-0 items-center justify-center rounded-xl sm:size-11"
            style={{
              backgroundColor: 'color-mix(in oklch, var(--primary) 16%, transparent)',
              color: 'var(--primary)',
              boxShadow: '0 0 0 1px color-mix(in oklch, var(--primary) 18%, transparent)',
            }}
          >
            <Fingerprint className="size-5" aria-hidden />
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Attendance Devices</h1>
            <p className="text-muted-foreground">Fingerprint/biometric readers that check members in automatically.</p>
          </div>
        </div>
        {canManage ? (
          <Button size="sm" onClick={() => setRegisterOpen(true)}>
            <Plus className="size-4" /> Register device
          </Button>
        ) : null}
      </div>

      <p className="max-w-3xl text-sm text-muted-foreground">
        After registering a device here, enroll each member&apos;s fingerprint on the physical unit and enter the matching ID in their profile&apos;s
        &quot;Fingerprint check-in&quot; field. Most readers need a small bridge agent running on a PC at the gym to forward punches — see{' '}
        <code>tools/attendance-bridge</code> in the project, or your device&apos;s own cloud-push setup if it supports one.
      </p>

      <DataTable
        columns={columns}
        rows={devices.data ?? []}
        rowKey={(d) => d.id}
        loading={devices.isPending}
        error={devices.error}
        onRetry={() => devices.refetch()}
        emptyMessage="No attendance devices registered yet."
      />

      <RegisterDeviceDialog open={registerOpen} onOpenChange={setRegisterOpen} />
      <RegenerateKeyDialog device={keyDevice} onOpenChange={(open) => !open && setKeyDevice(null)} />

      <ConfirmDialog
        open={!!confirmAction}
        onOpenChange={(open) => !open && setConfirmAction(null)}
        title={confirmAction ? `${confirmAction.action[0]!.toUpperCase()}${confirmAction.action.slice(1)} "${confirmAction.device.name}"?` : ''}
        description={
          confirmAction?.action === 'delete'
            ? 'This removes the device — its API key stops working immediately. This cannot be undone from here.'
            : 'The device keeps its API key either way — this only toggles whether its punches are accepted.'
        }
        destructive={confirmAction?.action === 'delete'}
        loading={updateDevice.isPending || deleteDevice.isPending}
        onConfirm={runAction}
      />
    </div>
  );
}
