'use client';

import * as React from 'react';
import { Fingerprint, Plus } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { AttendanceDeviceCard, type DeviceCardAction } from '@/features/attendance-device/components/attendance-device-card';
import { AttendanceDevicesHero } from '@/features/attendance-device/components/attendance-devices-hero';
import { AttendanceDevicesInsights, AttendanceDevicesKpis } from '@/features/attendance-device/components/attendance-devices-overview';
import { AttendanceDevicesToolbar } from '@/features/attendance-device/components/attendance-devices-toolbar';
import { RegenerateKeyDialog } from '@/features/attendance-device/components/regenerate-key-dialog';
import { RegisterDeviceDialog } from '@/features/attendance-device/components/register-device-dialog';
import { toAttendanceDeviceError, useAttendanceDevices, useDeleteAttendanceDevice, useUpdateAttendanceDevice } from '@/features/attendance-device/hooks/use-attendance-devices';
import type { AttendanceDevice } from '@/features/attendance-device/types';

type StatusAction = 'activate' | 'deactivate' | 'delete';

export default function AttendanceDevicesPage() {
  const { hasPermission } = usePermissions();
  const canManage = hasPermission('attendance-devices:manage');

  const devices = useAttendanceDevices();
  const updateDevice = useUpdateAttendanceDevice();
  const deleteDevice = useDeleteAttendanceDevice();

  const [search, setSearch] = React.useState('');
  const [isActiveFilter, setIsActiveFilter] = React.useState<'true' | 'false' | ''>('');
  const [view, setView] = React.useState<'grid' | 'list'>('grid');
  const [registerOpen, setRegisterOpen] = React.useState(false);
  const [keyDevice, setKeyDevice] = React.useState<AttendanceDevice | null>(null);
  const [confirmAction, setConfirmAction] = React.useState<{ action: StatusAction; device: AttendanceDevice } | null>(null);

  const allItems = devices.data ?? [];
  const items = allItems.filter((d) => {
    if (isActiveFilter !== '' && String(d.isActive) !== isActiveFilter) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return d.name.toLowerCase().includes(q) || d.branchName.toLowerCase().includes(q);
  });

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

  const handleCardAction = (device: AttendanceDevice, action: DeviceCardAction) => {
    if (action === 'regenerate-key') {
      setKeyDevice(device);
      return;
    }
    setConfirmAction({ action, device });
  };

  return (
    <div className="w-full space-y-5">
      <AttendanceDevicesHero
        total={allItems.length}
        devices={allItems}
        actions={
          canManage ? (
            <Button size="sm" data-solid className="border-0 bg-white text-indigo-700 shadow-lg hover:bg-white/90" onClick={() => setRegisterOpen(true)}>
              <Plus className="size-4" /> Register device
            </Button>
          ) : null
        }
      />

      <p className="max-w-3xl text-sm text-muted-foreground">
        After registering a device here, enroll each member&apos;s fingerprint on the physical unit and enter the matching ID in their profile&apos;s
        &quot;Fingerprint check-in&quot; field. Most readers need a small bridge agent running on a PC at the gym to forward punches — see{' '}
        <code>tools/attendance-bridge</code> in the project, or your device&apos;s own cloud-push setup if it supports one.
      </p>

      <AttendanceDevicesKpis devices={allItems} loading={devices.isPending} isActiveFilter={isActiveFilter} onStatus={setIsActiveFilter} />

      <AttendanceDevicesInsights devices={allItems} loading={devices.isPending} />

      <AttendanceDevicesToolbar search={search} onSearch={setSearch} status={isActiveFilter} onStatus={setIsActiveFilter} view={view} onView={setView} />

      {devices.error ? (
        <EmptyState
          title="Couldn't load this data"
          description={devices.error instanceof Error ? devices.error.message : 'Something went wrong loading this data.'}
          className="border-destructive/30"
          action={
            <Button variant="outline" size="sm" onClick={() => devices.refetch()}>
              Retry
            </Button>
          }
        />
      ) : devices.isPending ? (
        <div className={view === 'grid' ? 'grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-4' : 'space-y-3'}>
          {Array.from({ length: view === 'grid' ? 3 : 3 }).map((_, i) => (
            <Skeleton key={i} className={view === 'grid' ? 'h-[220px] w-full rounded-3xl' : 'h-20 w-full rounded-2xl'} />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState icon={Fingerprint} title={!search && !isActiveFilter ? 'Register your first attendance device to get started.' : 'No devices match these filters.'} />
      ) : (
        <div className={view === 'grid' ? 'grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-4' : 'space-y-2.5'}>
          {items.map((d, i) => (
            <AttendanceDeviceCard key={d.id} device={d} index={i} variant={view} canManage={canManage} onRequestAction={(action) => handleCardAction(d, action)} />
          ))}
        </div>
      )}

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
