'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, KeyRound, Mail } from 'lucide-react';
import { toast } from 'sonner';

import { AvatarUpload } from '@/features/iam/components/avatar-upload';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { UserStatusBadge } from '@/features/iam/components/status-badge';
import { UnsavedChangesBar } from '@/features/gym-settings/components/unsaved-changes-bar';
import { EmploymentInfoFields, type EmploymentInfoValue } from '@/features/staff/components/employment-info-fields';
import { StaffBranchesEditor } from '@/features/staff/components/staff-branches-editor';
import { StaffRoleSelect } from '@/features/staff/components/staff-role-select';
import {
  toStaffError,
  useAssignStaffBranches,
  useAssignStaffRole,
  useResendStaffActivation,
  useResetStaffPassword,
  useStaffDetail,
  useStaffStatusAction,
  useUpdateStaff,
} from '@/features/staff/hooks/use-staff';
import type { Gender, StaffDetail, StaffRole } from '@/features/staff/types';

interface FormState {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  employeeId: string;
  avatarUrl: string | null;
  gender: string;
  dateOfBirth: string;
  addressLine: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  notes: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContactRelation: string;
  employment: EmploymentInfoValue;
}

function toFormState(staffMember: StaffDetail): FormState {
  return {
    firstName: staffMember.firstName,
    lastName: staffMember.lastName,
    email: staffMember.email,
    phone: staffMember.phone ?? '',
    employeeId: staffMember.employeeId,
    avatarUrl: staffMember.avatarUrl,
    gender: staffMember.gender ?? '',
    dateOfBirth: staffMember.dateOfBirth ? staffMember.dateOfBirth.slice(0, 10) : '',
    addressLine: staffMember.addressLine ?? '',
    city: staffMember.city ?? '',
    state: staffMember.state ?? '',
    country: staffMember.country ?? '',
    postalCode: staffMember.postalCode ?? '',
    notes: staffMember.notes ?? '',
    emergencyContactName: staffMember.emergencyContactName ?? '',
    emergencyContactPhone: staffMember.emergencyContactPhone ?? '',
    emergencyContactRelation: staffMember.emergencyContactRelation ?? '',
    employment: {
      employmentType: staffMember.employmentType,
      salaryType: staffMember.salaryType,
      salaryAmount: staffMember.salaryAmount ?? '',
      shift: staffMember.shift ?? '',
      weeklyOff: staffMember.weeklyOff ?? '',
      workStatus: staffMember.workStatus,
    },
  };
}

type StatusActionKind = 'activate' | 'deactivate' | 'suspend' | 'restore' | 'delete';

export default function StaffDetailPage() {
  const params = useParams<{ staffId: string }>();
  const { hasPermission } = usePermissions();
  const staffId = params.staffId;

  const staffMember = useStaffDetail(staffId);
  const updateStaff = useUpdateStaff();
  const statusAction = useStaffStatusAction();
  const resetPassword = useResetStaffPassword();
  const resendActivation = useResendStaffActivation();
  const assignBranches = useAssignStaffBranches();
  const assignRole = useAssignStaffRole();

  const canUpdate = hasPermission('staff:update');
  const canActivate = hasPermission('staff:activate');
  const canDelete = hasPermission('staff:delete');
  const canRestore = hasPermission('staff:restore');
  const canAssignBranch = hasPermission('staff:assign-branch');
  const canAssignRole = hasPermission('staff:assign-role');
  const canInvite = hasPermission('staff:invite');

  const [form, setForm] = React.useState<FormState | null>(null);
  const [confirmStatusAction, setConfirmStatusAction] = React.useState<StatusActionKind | null>(null);
  const [confirmResetPassword, setConfirmResetPassword] = React.useState(false);
  const [role, setRole] = React.useState<StaffRole | null>(null);
  const [branchSelection, setBranchSelection] = React.useState<{ branchIds: string[]; primaryBranchId: string | null } | null>(
    null,
  );

  React.useEffect(() => {
    if (staffMember.data && !form) setForm(toFormState(staffMember.data));
    if (staffMember.data && role === null) setRole(staffMember.data.role);
    if (staffMember.data && branchSelection === null) {
      setBranchSelection({
        branchIds: staffMember.data.branches.map((b) => b.branchId),
        primaryBranchId: staffMember.data.primaryBranch?.branchId ?? null,
      });
    }
  }, [staffMember.data, form, role, branchSelection]);

  if (staffMember.isPending || !form) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (staffMember.isError) {
    return <p className="text-sm text-destructive">Couldn&apos;t load this staff member — try refreshing.</p>;
  }

  const data = staffMember.data;
  const baseline = toFormState(data);
  const isDirty = JSON.stringify(form) !== JSON.stringify(baseline);
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((prev) => (prev ? { ...prev, [key]: value } : prev));

  const handleCancel = () => setForm(baseline);

  const handleSave = () => {
    updateStaff.mutate(
      {
        staffId,
        payload: {
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email,
          phone: form.phone || undefined,
          employeeId: form.employeeId,
          avatarUrl: form.avatarUrl,
          gender: (form.gender || null) as Gender | null,
          dateOfBirth: form.dateOfBirth || null,
          addressLine: form.addressLine || null,
          city: form.city || null,
          state: form.state || null,
          country: form.country || null,
          postalCode: form.postalCode || null,
          notes: form.notes || null,
          emergencyContactName: form.emergencyContactName || null,
          emergencyContactPhone: form.emergencyContactPhone || null,
          emergencyContactRelation: form.emergencyContactRelation || null,
          employmentType: form.employment.employmentType,
          salaryType: form.employment.salaryType,
          salaryAmount: form.employment.salaryAmount ? Number(form.employment.salaryAmount) : null,
          shift: form.employment.shift || null,
          weeklyOff: form.employment.weeklyOff || null,
          workStatus: form.employment.workStatus,
        },
      },
      {
        onSuccess: () => toast.success('Staff member updated'),
        onError: (err) => toast.error(toStaffError(err).message),
      },
    );
  };

  const runStatusAction = (action: StatusActionKind) => {
    statusAction.mutate(
      { staffId, action },
      {
        onSuccess: () => toast.success(`Staff member ${action}d.`),
        onError: (err) => toast.error(toStaffError(err).message),
      },
    );
    setConfirmStatusAction(null);
  };

  const handleResetPassword = () => {
    resetPassword.mutate(staffId, {
      onSuccess: () => toast.success('Password reset email sent.'),
      onError: (err) => toast.error(toStaffError(err).message),
    });
    setConfirmResetPassword(false);
  };

  const handleResendActivation = () => {
    resendActivation.mutate(staffId, {
      onSuccess: () => toast.success('Activation email resent.'),
      onError: (err) => toast.error(toStaffError(err).message),
    });
  };

  const handleSaveBranches = () => {
    if (!branchSelection?.primaryBranchId) {
      toast.error('Assign at least one branch and mark one as primary.');
      return;
    }
    assignBranches.mutate(
      { staffId, payload: { primaryBranchId: branchSelection.primaryBranchId, branchIds: branchSelection.branchIds } },
      {
        onSuccess: () => toast.success('Branch assignments updated.'),
        onError: (err) => toast.error(toStaffError(err).message),
      },
    );
  };

  const handleSaveRole = () => {
    if (!role) return;
    assignRole.mutate(
      { staffId, payload: { role } },
      {
        onSuccess: () => toast.success('Role updated.'),
        onError: (err) => toast.error(toStaffError(err).message),
      },
    );
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/staff">
          <ArrowLeft className="size-4" /> Back to staff
        </Link>
      </Button>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{data.name}</h1>
          <p className="text-muted-foreground">
            {data.role} · {data.employeeId || 'No employee ID'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <UserStatusBadge status={data.status} deleted={!!data.deletedAt} />
          {canInvite && data.status === 'PENDING_VERIFICATION' ? (
            <Button variant="outline" size="sm" disabled={resendActivation.isPending} onClick={handleResendActivation}>
              <Mail className="size-4" /> {resendActivation.isPending ? 'Resending…' : 'Resend activation'}
            </Button>
          ) : null}
          {canUpdate ? (
            <Button variant="outline" size="sm" onClick={() => setConfirmResetPassword(true)}>
              <KeyRound className="size-4" /> Reset password
            </Button>
          ) : null}
          {data.deletedAt || data.status === 'SUSPENDED' || data.status === 'DEACTIVATED' ? (
            canRestore ? (
              <Button size="sm" onClick={() => setConfirmStatusAction(data.deletedAt ? 'restore' : 'activate')}>
                {data.deletedAt ? 'Restore' : 'Activate'}
              </Button>
            ) : null
          ) : canActivate ? (
            <>
              <Button variant="outline" size="sm" onClick={() => setConfirmStatusAction('suspend')}>
                Suspend
              </Button>
              <Button variant="outline" size="sm" onClick={() => setConfirmStatusAction('deactivate')}>
                Deactivate
              </Button>
            </>
          ) : null}
          {!data.deletedAt && canDelete ? (
            <Button variant="destructive" size="sm" onClick={() => setConfirmStatusAction('delete')}>
              Delete
            </Button>
          ) : null}
        </div>
      </div>

      {canUpdate ? (
        <UnsavedChangesBar isDirty={isDirty} saving={updateStaff.isPending} onSave={handleSave} onCancel={handleCancel} />
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profile photo</CardTitle>
        </CardHeader>
        <CardContent>
          <AvatarUpload name={data.name} value={form.avatarUrl} onChange={(v) => set('avatarUrl', v)} disabled={!canUpdate} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Basic information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="firstName">First name</Label>
              <Input id="firstName" value={form.firstName} disabled={!canUpdate} onChange={(e) => set('firstName', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Last name</Label>
              <Input id="lastName" value={form.lastName} disabled={!canUpdate} onChange={(e) => set('lastName', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={form.email} disabled={!canUpdate} onChange={(e) => set('email', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" type="tel" value={form.phone} disabled={!canUpdate} onChange={(e) => set('phone', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="employeeId">Employee ID</Label>
              <Input id="employeeId" value={form.employeeId} disabled={!canUpdate} onChange={(e) => set('employeeId', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gender">Gender</Label>
              <select
                id="gender"
                className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
                value={form.gender}
                disabled={!canUpdate}
                onChange={(e) => set('gender', e.target.value)}
              >
                <option value="">Not specified</option>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
                <option value="PREFER_NOT_TO_SAY">Prefer not to say</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="dateOfBirth">Date of birth</Label>
              <Input id="dateOfBirth" type="date" value={form.dateOfBirth} disabled={!canUpdate} onChange={(e) => set('dateOfBirth', e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Address</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="addressLine">Address</Label>
            <Input id="addressLine" value={form.addressLine} disabled={!canUpdate} onChange={(e) => set('addressLine', e.target.value)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input id="city" value={form.city} disabled={!canUpdate} onChange={(e) => set('city', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="state">State</Label>
              <Input id="state" value={form.state} disabled={!canUpdate} onChange={(e) => set('state', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="country">Country</Label>
              <Input id="country" value={form.country} disabled={!canUpdate} onChange={(e) => set('country', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="postalCode">Postal code</Label>
              <Input id="postalCode" value={form.postalCode} disabled={!canUpdate} onChange={(e) => set('postalCode', e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Emergency contact</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="emergencyContactName">Name</Label>
            <Input
              id="emergencyContactName"
              value={form.emergencyContactName}
              disabled={!canUpdate}
              onChange={(e) => set('emergencyContactName', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="emergencyContactPhone">Phone</Label>
            <Input
              id="emergencyContactPhone"
              type="tel"
              value={form.emergencyContactPhone}
              disabled={!canUpdate}
              onChange={(e) => set('emergencyContactPhone', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="emergencyContactRelation">Relation</Label>
            <Input
              id="emergencyContactRelation"
              value={form.emergencyContactRelation}
              disabled={!canUpdate}
              onChange={(e) => set('emergencyContactRelation', e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Employment information</CardTitle>
        </CardHeader>
        <CardContent>
          <EmploymentInfoFields value={form.employment} onChange={(v) => set('employment', v)} disabled={!canUpdate} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <textarea
            id="notes"
            className="flex min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
            value={form.notes}
            disabled={!canUpdate}
            onChange={(e) => set('notes', e.target.value)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Assigned branches</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <StaffBranchesEditor
            branchIds={branchSelection?.branchIds ?? []}
            primaryBranchId={branchSelection?.primaryBranchId ?? null}
            onChange={setBranchSelection}
            disabled={!canAssignBranch}
          />
          {canAssignBranch ? (
            <Button size="sm" disabled={assignBranches.isPending} onClick={handleSaveBranches}>
              {assignBranches.isPending ? 'Saving…' : 'Save branch assignments'}
            </Button>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Role</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <StaffRoleSelect id="role" value={role ?? data.role} onChange={setRole} disabled={!canAssignRole} />
          {canAssignRole ? (
            <Button size="sm" disabled={assignRole.isPending || role === data.role} onClick={handleSaveRole}>
              {assignRole.isPending ? 'Saving…' : 'Save role'}
            </Button>
          ) : null}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirmStatusAction !== null}
        onOpenChange={(open) => !open && setConfirmStatusAction(null)}
        title={confirmStatusAction ? `${confirmStatusAction[0]!.toUpperCase()}${confirmStatusAction.slice(1)} ${data.name}?` : ''}
        description={
          confirmStatusAction === 'delete'
            ? 'This soft-deletes the account — it can be restored later.'
            : 'This action can be reversed later if needed.'
        }
        destructive={confirmStatusAction === 'delete' || confirmStatusAction === 'suspend'}
        loading={statusAction.isPending}
        onConfirm={() => confirmStatusAction && runStatusAction(confirmStatusAction)}
      />

      <ConfirmDialog
        open={confirmResetPassword}
        onOpenChange={setConfirmResetPassword}
        title={`Send a password reset email to ${data.name}?`}
        description="They'll receive an email with a link to set a new password."
        loading={resetPassword.isPending}
        onConfirm={handleResetPassword}
      />
    </div>
  );
}
