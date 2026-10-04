'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { AlertTriangle, Briefcase, GitBranch, KeyRound, Lock, Mail, MapPin, MoreHorizontal, ShieldCheck, StickyNote, UserRound } from 'lucide-react';
import { toast } from 'sonner';

import { AvatarUpload } from '@/features/iam/components/avatar-upload';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { UserStatusBadge } from '@/features/iam/components/status-badge';
import { PanelCard } from '@/features/members/components/detail/detail-ui';
import { useMotionSafe } from '@/features/reports/lib/motion';
import { StaffDetailHero, StaffDetailKpis, roleLabel } from '@/features/staff/components/staff-detail-hero';
import { UnsavedChangesBar } from '@/features/gym-settings/components/unsaved-changes-bar';
import { EmploymentInfoFields, type EmploymentInfoValue } from '@/features/staff/components/employment-info-fields';
import { StaffBranchesEditor } from '@/features/staff/components/staff-branches-editor';
import { STAFF_ROLE_OPTIONS, StaffRoleSelect } from '@/features/staff/components/staff-role-select';
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
  const m = useMotionSafe();

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

  if (staffMember.isError) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 rounded-3xl border bg-card p-8 text-center shadow-xs">
        <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
          <AlertTriangle className="size-6" aria-hidden />
        </span>
        <h1 className="text-xl font-bold">Staff member not found</h1>
        <p className="text-sm text-muted-foreground">Couldn&apos;t load this staff member — they may not exist, or you may not have access. Try refreshing.</p>
        <div className="flex justify-center gap-2">
          <Button variant="outline" onClick={() => void staffMember.refetch()}>Retry</Button>
          <Button asChild><Link href="/staff">Back to staff</Link></Button>
        </div>
      </div>
    );
  }

  if (staffMember.isPending || !form) {
    return (
      <div className="space-y-5" aria-busy="true">
        <Skeleton className="h-44 w-full rounded-3xl" />
        <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
        </div>
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <Skeleton className="h-96 rounded-2xl" />
          <Skeleton className="h-96 rounded-2xl" />
        </div>
      </div>
    );
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

  const inactive = !!data.deletedAt || data.status === 'SUSPENDED' || data.status === 'DEACTIVATED';
  const showLifecycle = !inactive && canActivate;
  const showDelete = !data.deletedAt && canDelete;
  const roleInfo = STAFF_ROLE_OPTIONS.find((o) => o.value === (role ?? data.role));
  const fieldSelect =
    'h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:border-ring disabled:cursor-not-allowed disabled:opacity-50';
  const field = (id: keyof FormState, label: string, props: React.ComponentProps<typeof Input> = {}, required = false) => (
    <div className="min-w-0 space-y-2">
      <Label htmlFor={id} required={required}>{label}</Label>
      <Input id={id} value={form[id] as string} disabled={!canUpdate} onChange={(e) => set(id, e.target.value as never)} {...props} />
    </div>
  );

  const actions = (
    <>
      {canInvite && data.status === 'PENDING_VERIFICATION' ? (
        <Button size="sm" variant="outline" disabled={resendActivation.isPending} onClick={handleResendActivation}>
          <Mail className="size-4" /> {resendActivation.isPending ? 'Resending…' : 'Resend activation'}
        </Button>
      ) : null}
      {inactive && canRestore ? (
        <Button variant="success" size="sm" onClick={() => setConfirmStatusAction(data.deletedAt ? 'restore' : 'activate')}>
          {data.deletedAt ? 'Restore' : 'Activate'}
        </Button>
      ) : null}
      {canUpdate || showLifecycle || showDelete ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="outline" aria-label="More actions">
              <MoreHorizontal className="size-4" /> More
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-48">
            {canUpdate ? (
              <DropdownMenuItem onSelect={() => setConfirmResetPassword(true)}>
                <KeyRound className="size-4" /> Reset password
              </DropdownMenuItem>
            ) : null}
            {showLifecycle ? (
              <>
                <DropdownMenuItem onSelect={() => setConfirmStatusAction('suspend')}>Suspend</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setConfirmStatusAction('deactivate')}>Deactivate</DropdownMenuItem>
              </>
            ) : null}
            {showDelete ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => setConfirmStatusAction('delete')}>
                  Delete
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </>
  );

  return (
    <div className="mx-auto w-full min-w-0 max-w-7xl space-y-5">
      <StaffDetailHero data={data} avatarUrl={form.avatarUrl} actions={actions} />

      {canUpdate ? (
        // Sticks below the app header (the bar's own `top-0` would hide it behind the header).
        <div className="sticky top-[4.5rem] z-20">
          <UnsavedChangesBar isDirty={isDirty} saving={updateStaff.isPending} onSave={handleSave} onCancel={handleCancel} />
        </div>
      ) : null}

      <StaffDetailKpis data={data} />

      <div className="grid min-w-0 items-start gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-5">
          <PanelCard icon={UserRound} accent="primary" title="Personal details" delay={0.1}>
            <AvatarUpload name={data.name} value={form.avatarUrl} onChange={(v) => set('avatarUrl', v)} disabled={!canUpdate} />
            <div className="grid gap-4 sm:grid-cols-2">
              {field('firstName', 'First name', {}, true)}
              {field('lastName', 'Last name', {}, true)}
              {field('email', 'Email', { type: 'email' }, true)}
              {field('phone', 'Phone', { type: 'tel' })}
              {field('employeeId', 'Employee ID')}
              <div className="space-y-2">
                <Label htmlFor="gender">Gender</Label>
                <select id="gender" className={fieldSelect} value={form.gender} disabled={!canUpdate} onChange={(e) => set('gender', e.target.value)}>
                  <option value="">Not specified</option>
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                  <option value="OTHER">Other</option>
                  <option value="PREFER_NOT_TO_SAY">Prefer not to say</option>
                </select>
              </div>
              {field('dateOfBirth', 'Date of birth', { type: 'date' })}
            </div>
          </PanelCard>

          <PanelCard icon={MapPin} accent="aqua" title="Address & emergency contact" delay={0.16}>
            {field('addressLine', 'Address')}
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {field('city', 'City')}
              {field('state', 'State')}
              {field('country', 'Country')}
              {field('postalCode', 'Postal code')}
            </div>
            <p className="border-t pt-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Emergency contact</p>
            <div className="grid gap-4 sm:grid-cols-3">
              {field('emergencyContactName', 'Name')}
              {field('emergencyContactPhone', 'Phone', { type: 'tel' })}
              {field('emergencyContactRelation', 'Relation')}
            </div>
          </PanelCard>

          <PanelCard icon={Briefcase} accent="violet" title="Employment" delay={0.22}>
            <EmploymentInfoFields value={form.employment} onChange={(v) => set('employment', v)} disabled={!canUpdate} />
          </PanelCard>

          <PanelCard icon={StickyNote} accent="warning" title="Notes" delay={0.28}>
            <textarea
              id="notes"
              aria-label="Notes"
              className="flex min-h-24 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:border-ring disabled:cursor-not-allowed disabled:opacity-50"
              value={form.notes}
              disabled={!canUpdate}
              onChange={(e) => set('notes', e.target.value)}
            />
          </PanelCard>
        </div>

        <div className="min-w-0 space-y-5">
          <PanelCard icon={ShieldCheck} accent="primary" title="Role" delay={0.14}>
            <div className="space-y-3">
              <StaffRoleSelect id="role" value={role ?? data.role} onChange={setRole} disabled={!canAssignRole} />
              {roleInfo ? <p className="rounded-xl bg-muted/60 p-3 text-sm text-muted-foreground"><b className="text-foreground">{roleInfo.label}</b> — {roleInfo.description}</p> : null}
              {canAssignRole ? (
                <Button size="sm" disabled={assignRole.isPending || role === data.role} onClick={handleSaveRole}>
                  {assignRole.isPending ? 'Saving…' : 'Save role'}
                </Button>
              ) : null}
            </div>
          </PanelCard>

          <PanelCard icon={GitBranch} accent="aqua" title="Assigned branches" delay={0.2}>
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
          </PanelCard>

          <PanelCard icon={Lock} accent="success" title="Account & security" delay={0.26}>
            <dl className="space-y-2.5 text-sm">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">Account status</dt>
                <dd><UserStatusBadge status={data.status} deleted={!!data.deletedAt} /></dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">Activation</dt>
                <dd className="font-medium">{data.status === 'PENDING_VERIFICATION' ? 'Awaiting activation' : 'Activated'}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">Last sign-in</dt>
                <dd className="text-right font-medium">{data.lastLoginAt ? new Date(data.lastLoginAt).toLocaleString() : 'Never'}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">Profile updated</dt>
                <dd className="font-medium">{new Date(data.updatedAt).toLocaleDateString()}</dd>
              </div>
            </dl>
            {(canInvite && data.status === 'PENDING_VERIFICATION') || canUpdate ? (
              <div className="flex flex-wrap gap-2 border-t pt-4">
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
              </div>
            ) : null}
          </PanelCard>

          {showLifecycle || showDelete ? (
            <motion.section
              initial={m.reduce ? false : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.32 }}
              className="overflow-hidden rounded-2xl border border-destructive/25 bg-card shadow-xs"
            >
              <header className="flex items-center gap-3 border-b border-destructive/15 bg-destructive/5 px-5 py-3.5">
                <span className="flex size-8 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
                  <AlertTriangle className="size-4" aria-hidden />
                </span>
                <h2 className="text-base font-semibold tracking-tight">Danger zone</h2>
              </header>
              <div className="space-y-3 p-5">
                <p className="text-sm text-muted-foreground">
                  {roleLabel(data.role)} access to FitCloud can be paused or removed. Every step asks for confirmation and deleted accounts can be restored.
                </p>
                <div className="flex flex-wrap gap-2">
                  {showLifecycle ? (
                    <>
                      <Button variant="outline" size="sm" onClick={() => setConfirmStatusAction('deactivate')}>Deactivate</Button>
                      <Button variant="outline" size="sm" className="border-warning/50 text-warning" onClick={() => setConfirmStatusAction('suspend')}>Suspend</Button>
                    </>
                  ) : null}
                  {showDelete ? (
                    <Button variant="destructive" size="sm" onClick={() => setConfirmStatusAction('delete')}>Delete</Button>
                  ) : null}
                </div>
              </div>
            </motion.section>
          ) : null}
        </div>
      </div>

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
