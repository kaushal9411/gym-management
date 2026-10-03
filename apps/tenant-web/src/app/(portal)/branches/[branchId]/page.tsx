'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Star } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { BranchDetailHero } from '@/features/branch/components/branch-detail-hero';
import { BranchFormFields, DEFAULT_BRANCH_FORM_STATE, type BranchFormState } from '@/features/branch/components/branch-form-fields';
import {
  toBranchError,
  useActivateBranch,
  useBranchDetail,
  useDeactivateBranch,
  useDeleteBranch,
  useRestoreBranch,
  useSetDefaultBranch,
  useUpdateBranch,
} from '@/features/branch/hooks/use-branches';
import type { BranchDetail } from '@/features/branch/types';
import { UnsavedChangesBar } from '@/features/gym-settings/components/unsaved-changes-bar';

type StatusActionKind = 'activate' | 'deactivate' | 'restore' | 'delete';

function toFormState(branch: BranchDetail): BranchFormState {
  return {
    name: branch.name,
    branchCode: branch.branchCode,
    email: branch.email ?? '',
    phone: branch.phone ?? '',
    whatsappNumber: branch.whatsappNumber ?? '',
    addressLine1: branch.addressLine1 ?? '',
    addressLine2: branch.addressLine2 ?? '',
    city: branch.city ?? '',
    state: branch.state ?? '',
    country: branch.country ?? '',
    postalCode: branch.postalCode ?? '',
    latitude: branch.latitude ?? '',
    longitude: branch.longitude ?? '',
    timezone: branch.timezone,
    operatingHours: branch.operatingHours ?? {},
    holidays: branch.holidays ?? [],
    capacity: branch.capacity === null ? '' : String(branch.capacity),
    maxMembers: branch.maxMembers === null ? '' : String(branch.maxMembers),
    maxStaff: branch.maxStaff === null ? '' : String(branch.maxStaff),
    allowCheckIn: branch.allowCheckIn,
    notes: branch.notes ?? '',
  };
}

function toNumberOrUndefined(value: string): number | undefined {
  return value.trim() === '' ? undefined : Number(value);
}

/** Same hero + PanelCard-sections shell as the Member/Staff detail pages — every field/handler/mutation below is exactly as before, only the wrapping layout changed. */
export default function BranchDetailPage() {
  const params = useParams<{ branchId: string }>();
  const { hasPermission } = usePermissions();
  const branchId = params.branchId;

  const branch = useBranchDetail(branchId);
  const updateBranch = useUpdateBranch();
  const activateBranch = useActivateBranch();
  const deactivateBranch = useDeactivateBranch();
  const deleteBranch = useDeleteBranch();
  const restoreBranch = useRestoreBranch();
  const setDefaultBranch = useSetDefaultBranch();

  const canUpdate = hasPermission('branches:update');
  const canDelete = hasPermission('branches:delete');
  const canRestore = hasPermission('branches:restore');
  const canActivate = hasPermission('branches:activate');

  const [form, setForm] = React.useState<BranchFormState | null>(null);
  const [confirmStatusAction, setConfirmStatusAction] = React.useState<StatusActionKind | null>(null);
  const [confirmSetDefault, setConfirmSetDefault] = React.useState(false);

  React.useEffect(() => {
    if (branch.data && !form) setForm(toFormState(branch.data));
  }, [branch.data, form]);

  if (branch.isPending || !form) {
    return (
      <div className="w-full space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-44 w-full rounded-3xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (branch.isError || !branch.data) {
    return <p className="text-sm text-destructive">Couldn&apos;t load this branch — try refreshing.</p>;
  }

  const data = branch.data;
  const baseline = toFormState(data);
  const isDirty = JSON.stringify(form) !== JSON.stringify(DEFAULT_BRANCH_FORM_STATE) && JSON.stringify(form) !== JSON.stringify(baseline);

  const handleCancel = () => setForm(baseline);

  const handleSave = () => {
    updateBranch.mutate(
      {
        branchId,
        input: {
          name: form.name,
          branchCode: form.branchCode || undefined,
          email: form.email || undefined,
          phone: form.phone || undefined,
          whatsappNumber: form.whatsappNumber || undefined,
          addressLine1: form.addressLine1 || undefined,
          addressLine2: form.addressLine2 || undefined,
          city: form.city || undefined,
          state: form.state || undefined,
          country: form.country || undefined,
          postalCode: form.postalCode || undefined,
          latitude: toNumberOrUndefined(form.latitude),
          longitude: toNumberOrUndefined(form.longitude),
          timezone: form.timezone || undefined,
          operatingHours: Object.keys(form.operatingHours).length > 0 ? form.operatingHours : undefined,
          holidays: form.holidays,
          capacity: toNumberOrUndefined(form.capacity),
          maxMembers: toNumberOrUndefined(form.maxMembers),
          maxStaff: toNumberOrUndefined(form.maxStaff),
          allowCheckIn: form.allowCheckIn,
          notes: form.notes || undefined,
        },
      },
      {
        onSuccess: () => toast.success('Branch updated'),
        onError: (err) => toast.error(toBranchError(err).message),
      },
    );
  };

  const runStatusAction = (action: StatusActionKind) => {
    const mutation = action === 'activate' ? activateBranch : action === 'deactivate' ? deactivateBranch : action === 'restore' ? restoreBranch : deleteBranch;
    mutation.mutate(branchId, {
      onSuccess: () => toast.success(`Branch ${action}d.`),
      onError: (err) => toast.error(toBranchError(err).message),
    });
    setConfirmStatusAction(null);
  };

  return (
    <div className="w-full space-y-5">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/branches">
          <ArrowLeft className="size-4" /> Back to branches
        </Link>
      </Button>

      <BranchDetailHero
        data={data}
        actions={
          <>
            {canUpdate && !data.isDefault && data.isActive && !data.deletedAt ? (
              <Button variant="secondary" size="sm" onClick={() => setConfirmSetDefault(true)}>
                <Star className="size-4" /> Set as default
              </Button>
            ) : null}
            {data.deletedAt ? (
              canRestore ? (
                <Button variant="secondary" size="sm" onClick={() => setConfirmStatusAction('restore')}>
                  Restore
                </Button>
              ) : null
            ) : canActivate ? (
              data.isActive ? (
                <Button variant="secondary" size="sm" onClick={() => setConfirmStatusAction('deactivate')}>
                  Deactivate
                </Button>
              ) : (
                <Button variant="secondary" size="sm" onClick={() => setConfirmStatusAction('activate')}>
                  Activate
                </Button>
              )
            ) : null}
            {!data.deletedAt && canDelete ? (
              <Button variant="destructive" size="sm" onClick={() => setConfirmStatusAction('delete')}>
                Delete
              </Button>
            ) : null}
          </>
        }
      />

      {canUpdate ? <UnsavedChangesBar isDirty={isDirty} saving={updateBranch.isPending} onSave={handleSave} onCancel={handleCancel} /> : null}

      <BranchFormFields value={form} onChange={setForm} disabled={!canUpdate} isEditing />

      <ConfirmDialog
        open={confirmStatusAction !== null}
        onOpenChange={(open) => !open && setConfirmStatusAction(null)}
        title={confirmStatusAction ? `${confirmStatusAction[0]!.toUpperCase()}${confirmStatusAction.slice(1)} "${data.name}"?` : ''}
        description={
          confirmStatusAction === 'delete'
            ? "This soft-deletes the branch — it can be restored later. The default branch and a tenant's last active branch can't be deleted."
            : confirmStatusAction === 'deactivate'
              ? "The default branch and a tenant's last active branch can't be deactivated."
              : 'This action can be reversed later if needed.'
        }
        destructive={confirmStatusAction === 'delete'}
        loading={activateBranch.isPending || deactivateBranch.isPending || deleteBranch.isPending || restoreBranch.isPending}
        onConfirm={() => confirmStatusAction && runStatusAction(confirmStatusAction)}
      />

      <ConfirmDialog
        open={confirmSetDefault}
        onOpenChange={setConfirmSetDefault}
        title={`Set "${data.name}" as the default branch?`}
        description="Only one branch can be the default at a time."
        loading={setDefaultBranch.isPending}
        onConfirm={() => {
          setDefaultBranch.mutate(branchId, {
            onSuccess: () => toast.success('Default branch updated.'),
            onError: (err) => toast.error(toBranchError(err).message),
          });
          setConfirmSetDefault(false);
        }}
      />
    </div>
  );
}
