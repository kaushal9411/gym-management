'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { ClassScheduleEditor } from '@/features/classes/components/class-schedule-editor';
import { DEFAULT_GROUP_CLASS_FORM_STATE, GroupClassFormFields, type GroupClassFormState } from '@/features/classes/components/group-class-form-fields';
import {
  toClassError,
  useClassStatusAction,
  useGenerateSessions,
  useGroupClass,
  useSetClassSchedule,
  useUpdateClass,
} from '@/features/classes/hooks/use-classes';
import type { GroupClass, ScheduleSlot } from '@/features/classes/types';
import { UnsavedChangesBar } from '@/features/gym-settings/components/unsaved-changes-bar';

type StatusActionKind = 'delete' | 'restore';

function toFormState(groupClass: GroupClass): GroupClassFormState {
  return {
    name: groupClass.name,
    description: groupClass.description ?? '',
    trainerId: groupClass.trainer?.id ?? '',
    branchId: groupClass.branch.id,
    capacity: String(groupClass.capacity),
    durationMinutes: String(groupClass.durationMinutes),
    isActive: groupClass.isActive,
  };
}

export default function ClassDetailPage() {
  const params = useParams<{ classId: string }>();
  const { hasPermission } = usePermissions();
  const classId = params.classId;

  const groupClass = useGroupClass(classId);
  const updateClass = useUpdateClass();
  const setSchedule = useSetClassSchedule();
  const statusAction = useClassStatusAction();
  const generateSessions = useGenerateSessions();

  const canUpdate = hasPermission('classes:update');
  const canDelete = hasPermission('classes:delete');
  const canRestore = hasPermission('classes:restore');

  const [form, setForm] = React.useState<GroupClassFormState | null>(null);
  const [confirmStatusAction, setConfirmStatusAction] = React.useState<StatusActionKind | null>(null);
  const [scheduleSlots, setScheduleSlots] = React.useState<ScheduleSlot[]>([]);
  const [scheduleDirty, setScheduleDirty] = React.useState(false);

  React.useEffect(() => {
    if (groupClass.data && !form) setForm(toFormState(groupClass.data));
  }, [groupClass.data, form]);

  if (groupClass.isPending || !form) {
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (groupClass.isError || !groupClass.data) {
    return <p className="text-sm text-destructive">Couldn&apos;t load this class — try refreshing.</p>;
  }

  const data = groupClass.data;
  const baseline = toFormState(data);
  const isDirty = JSON.stringify(form) !== JSON.stringify(baseline);

  const handleCancel = () => setForm(baseline);

  const handleSave = () => {
    updateClass.mutate(
      {
        id: classId,
        payload: {
          name: form.name,
          description: form.description || undefined,
          trainerId: form.trainerId || null,
          branchId: form.branchId,
          capacity: Number(form.capacity),
          durationMinutes: Number(form.durationMinutes),
          isActive: form.isActive,
        },
      },
      {
        onSuccess: () => toast.success('Class updated'),
        onError: (err) => toast.error(toClassError(err).message),
      },
    );
  };

  const handleSaveSchedule = () => {
    setSchedule.mutate(
      { id: classId, slots: scheduleSlots },
      {
        onSuccess: () => {
          toast.success('Weekly schedule saved.');
          setScheduleDirty(false);
        },
        onError: (err) => toast.error(toClassError(err).message),
      },
    );
  };

  const handleGenerate = () => {
    generateSessions.mutate(undefined, {
      onSuccess: (result) => toast.success(`${result.created} session(s) generated.`),
      onError: (err) => toast.error(toClassError(err).message),
    });
  };

  const runStatusAction = (action: StatusActionKind) => {
    statusAction.mutate(
      { id: classId, action },
      {
        onSuccess: () => toast.success(`Class ${action === 'delete' ? 'deleted' : 'restored'}.`),
        onError: (err) => toast.error(toClassError(err).message),
      },
    );
    setConfirmStatusAction(null);
  };

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/classes">
          <ArrowLeft className="size-4" /> Back to classes
        </Link>
      </Button>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{data.name}</h1>
          <p className="text-muted-foreground">{data.branch.name}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {data.deletedAt ? (
            <Badge variant="outline" className="border-dashed text-muted-foreground">Deleted</Badge>
          ) : (
            <Badge variant={data.isActive ? 'secondary' : 'outline'}>{data.isActive ? 'Active' : 'Inactive'}</Badge>
          )}
          {data.deletedAt ? (
            canRestore ? (
              <Button size="sm" onClick={() => setConfirmStatusAction('restore')}>
                Restore
              </Button>
            ) : null
          ) : canDelete ? (
            <Button variant="destructive" size="sm" onClick={() => setConfirmStatusAction('delete')}>
              Delete
            </Button>
          ) : null}
        </div>
      </div>

      {canUpdate ? <UnsavedChangesBar isDirty={isDirty} saving={updateClass.isPending} onSave={handleSave} onCancel={handleCancel} /> : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Class details</CardTitle>
        </CardHeader>
        <CardContent>
          <GroupClassFormFields value={form} onChange={setForm} disabled={!canUpdate} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-base">Weekly schedule</CardTitle>
          {canUpdate ? (
            <Button variant="outline" size="sm" disabled={generateSessions.isPending} onClick={handleGenerate}>
              <RefreshCw className="size-3.5" /> {generateSessions.isPending ? 'Generating…' : 'Regenerate sessions now'}
            </Button>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            A recurring template — the scheduler expands it into dated, bookable sessions for a rolling 4-week window every night.
          </p>
          <ClassScheduleEditor
            initialSlots={data.schedule}
            disabled={!canUpdate}
            onChange={(next, dirty) => {
              setScheduleSlots(next);
              setScheduleDirty(dirty);
            }}
          />
          {canUpdate ? (
            <Button size="sm" disabled={!scheduleDirty || setSchedule.isPending} onClick={handleSaveSchedule}>
              {setSchedule.isPending ? 'Saving…' : 'Save weekly schedule'}
            </Button>
          ) : null}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirmStatusAction !== null}
        onOpenChange={(open) => !open && setConfirmStatusAction(null)}
        title={confirmStatusAction ? `${confirmStatusAction === 'delete' ? 'Delete' : 'Restore'} "${data.name}"?` : ''}
        description={
          confirmStatusAction === 'delete'
            ? 'This soft-deletes the class and excludes it from future session generation — existing sessions are unaffected.'
            : 'This makes the class assignable and schedulable again.'
        }
        destructive={confirmStatusAction === 'delete'}
        loading={statusAction.isPending}
        onConfirm={() => confirmStatusAction && runStatusAction(confirmStatusAction)}
      />
    </div>
  );
}
