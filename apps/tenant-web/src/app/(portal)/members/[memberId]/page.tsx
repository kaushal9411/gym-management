'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { AttendanceMethodBadge, AttendanceStatusBadge } from '@/features/attendance/components/attendance-badges';
import { toAttendanceError, useMemberAttendance, useManualCheckIn, useManualCheckOut } from '@/features/attendance/hooks/use-attendance';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { AvatarUpload } from '@/features/iam/components/avatar-upload';
import { UnsavedChangesBar } from '@/features/gym-settings/components/unsaved-changes-bar';
import { BranchSelect } from '@/features/members/components/branch-select';
import { DocumentUpload } from '@/features/members/components/document-upload';
import { FreezeHistoryTable, MembershipHistoryTable } from '@/features/members/components/membership-history-table';
import { MembershipPlanSelect } from '@/features/members/components/membership-plan-select';
import { MemberStatusBadge } from '@/features/members/components/member-status-badge';
import { QrCodeDisplay } from '@/features/members/components/qr-code-display';
import { TrainerSelect } from '@/features/members/components/trainer-select';
import {
  toMemberError,
  useAssignMembership,
  useAssignTrainer,
  useCancelMembership,
  useDowngradeMembership,
  useExtendMembership,
  useFreezeMember,
  useMemberDetail,
  useMemberStatusAction,
  useRenewMembership,
  useResumeMembership,
  useTransferBranch,
  useUpdateMember,
  useUpgradeMembership,
} from '@/features/members/hooks/use-members';
import type { BloodGroup, Gender, MemberDetail } from '@/features/members/types';

interface FormState {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  memberId: string;
  profilePhotoUrl: string | null;
  gender: string;
  dateOfBirth: string;
  bloodGroup: string;
  height: string;
  weight: string;
  occupation: string;
  addressLine: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContactRelation: string;
  medicalConditions: string;
  allergies: string;
  fitnessGoals: string;
  notes: string;
}

function toFormState(m: MemberDetail): FormState {
  return {
    firstName: m.firstName,
    lastName: m.lastName,
    email: m.email ?? '',
    phone: m.phone ?? '',
    memberId: m.memberId,
    profilePhotoUrl: m.profilePhotoUrl,
    gender: m.gender ?? '',
    dateOfBirth: m.dateOfBirth ? m.dateOfBirth.slice(0, 10) : '',
    bloodGroup: m.bloodGroup ?? '',
    height: m.height ?? '',
    weight: m.weight ?? '',
    occupation: m.occupation ?? '',
    addressLine: m.addressLine ?? '',
    city: m.city ?? '',
    state: m.state ?? '',
    country: m.country ?? '',
    postalCode: m.postalCode ?? '',
    emergencyContactName: m.emergencyContactName ?? '',
    emergencyContactPhone: m.emergencyContactPhone ?? '',
    emergencyContactRelation: m.emergencyContactRelation ?? '',
    medicalConditions: m.medicalConditions ?? '',
    allergies: m.allergies ?? '',
    fitnessGoals: m.fitnessGoals ?? '',
    notes: m.notes ?? '',
  };
}

type StatusActionKind = 'activate' | 'deactivate' | 'restore' | 'delete';

const selectClassName =
  'h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm disabled:cursor-not-allowed disabled:opacity-50';

export default function MemberDetailPage() {
  const params = useParams<{ memberId: string }>();
  const { hasPermission } = usePermissions();
  const memberId = params.memberId;

  const member = useMemberDetail(memberId);
  const updateMember = useUpdateMember();
  const statusAction = useMemberStatusAction();
  const freeze = useFreezeMember();
  const assignMembership = useAssignMembership();
  const renewMembership = useRenewMembership();
  const upgradeMembership = useUpgradeMembership();
  const downgradeMembership = useDowngradeMembership();
  const extendMembership = useExtendMembership();
  const cancelMembership = useCancelMembership();
  const resumeMembership = useResumeMembership();
  const transferBranch = useTransferBranch();
  const assignTrainer = useAssignTrainer();
  const memberAttendance = useMemberAttendance(memberId, 1, 5);
  const manualCheckIn = useManualCheckIn();
  const manualCheckOut = useManualCheckOut();

  const canUpdate = hasPermission('members:update');
  const canDelete = hasPermission('members:delete');
  const canRestore = hasPermission('members:restore');
  const canAssignTrainer = hasPermission('members:assign-trainer');
  const canAssign = hasPermission('memberships:assign');
  const canRenew = hasPermission('memberships:renew');
  const canUpgrade = hasPermission('memberships:upgrade');
  const canFreeze = hasPermission('memberships:freeze');
  const canCheckIn = hasPermission('attendance:checkin');
  const canCheckOut = hasPermission('attendance:checkout');

  const [form, setForm] = React.useState<FormState | null>(null);
  const [confirmStatusAction, setConfirmStatusAction] = React.useState<StatusActionKind | null>(null);
  const [confirmFreeze, setConfirmFreeze] = React.useState(false);
  const [confirmCancel, setConfirmCancel] = React.useState(false);
  const [branchId, setBranchId] = React.useState<string | null>(null);
  const [trainerId, setTrainerId] = React.useState<string | null>(null);
  const [assignPlanId, setAssignPlanId] = React.useState('');
  const [assignAutoRenew, setAssignAutoRenew] = React.useState(false);
  const [renewPlanId, setRenewPlanId] = React.useState('');
  const [upgradePlanId, setUpgradePlanId] = React.useState('');
  const [downgradePlanId, setDowngradePlanId] = React.useState('');
  const [extendDays, setExtendDays] = React.useState('');

  React.useEffect(() => {
    if (member.data && !form) setForm(toFormState(member.data));
    if (member.data && branchId === null) setBranchId(member.data.branch.id);
    if (member.data && trainerId === null) setTrainerId(member.data.trainer?.id ?? '');
  }, [member.data, form, branchId, trainerId]);

  React.useEffect(() => {
    if (!member.data || !window.location.hash) return;
    const hash = window.location.hash;
    const timer = setTimeout(() => {
      document.querySelector(hash)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
    return () => clearTimeout(timer);
  }, [member.data]);

  if (member.isPending || !form) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (member.isError) {
    return <p className="text-sm text-destructive">Couldn&apos;t load this member — try refreshing.</p>;
  }

  const data = member.data;
  const baseline = toFormState(data);
  const isDirty = JSON.stringify(form) !== JSON.stringify(baseline);
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((prev) => (prev ? { ...prev, [key]: value } : prev));

  const handleCancel = () => setForm(baseline);

  const handleSave = () => {
    updateMember.mutate(
      {
        id: memberId,
        payload: {
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email || null,
          phone: form.phone || null,
          memberId: form.memberId,
          profilePhotoUrl: form.profilePhotoUrl,
          gender: (form.gender || null) as Gender | null,
          dateOfBirth: form.dateOfBirth || null,
          bloodGroup: (form.bloodGroup || null) as BloodGroup | null,
          height: form.height ? Number(form.height) : null,
          weight: form.weight ? Number(form.weight) : null,
          occupation: form.occupation || null,
          addressLine: form.addressLine || null,
          city: form.city || null,
          state: form.state || null,
          country: form.country || null,
          postalCode: form.postalCode || null,
          emergencyContactName: form.emergencyContactName || null,
          emergencyContactPhone: form.emergencyContactPhone || null,
          emergencyContactRelation: form.emergencyContactRelation || null,
          medicalConditions: form.medicalConditions || null,
          allergies: form.allergies || null,
          fitnessGoals: form.fitnessGoals || null,
          notes: form.notes || null,
        },
      },
      {
        onSuccess: () => toast.success('Member updated'),
        onError: (err) => toast.error(toMemberError(err).message),
      },
    );
  };

  const runStatusAction = (action: StatusActionKind) => {
    statusAction.mutate(
      { id: memberId, action },
      {
        onSuccess: () => toast.success(`Member ${action}d.`),
        onError: (err) => toast.error(toMemberError(err).message),
      },
    );
    setConfirmStatusAction(null);
  };

  const handleResume = () => {
    resumeMembership.mutate(memberId, {
      onSuccess: () => toast.success('Membership resumed.'),
      onError: (err) => toast.error(toMemberError(err).message),
    });
  };

  const handleFreeze = () => {
    freeze.mutate(
      { id: memberId },
      { onSuccess: () => toast.success('Member frozen.'), onError: (err) => toast.error(toMemberError(err).message) },
    );
    setConfirmFreeze(false);
  };

  const handleSaveBranch = () => {
    if (!branchId) return;
    transferBranch.mutate(
      { id: memberId, branchId },
      { onSuccess: () => toast.success('Branch updated.'), onError: (err) => toast.error(toMemberError(err).message) },
    );
  };

  const handleSaveTrainer = () => {
    assignTrainer.mutate(
      { id: memberId, trainerId: trainerId || null },
      { onSuccess: () => toast.success('Trainer assignment updated.'), onError: (err) => toast.error(toMemberError(err).message) },
    );
  };

  const handleAssignMembership = () => {
    if (!assignPlanId) {
      toast.error('Select a membership plan.');
      return;
    }
    assignMembership.mutate(
      { id: memberId, payload: { planId: assignPlanId, autoRenew: assignAutoRenew } },
      {
        onSuccess: () => {
          toast.success('Membership assigned.');
          setAssignPlanId('');
        },
        onError: (err) => toast.error(toMemberError(err).message),
      },
    );
  };

  const handleRenew = () => {
    renewMembership.mutate(
      { id: memberId, payload: { planId: renewPlanId || undefined } },
      {
        onSuccess: () => {
          toast.success('Membership renewed.');
          setRenewPlanId('');
        },
        onError: (err) => toast.error(toMemberError(err).message),
      },
    );
  };

  const handleUpgrade = () => {
    if (!upgradePlanId) {
      toast.error('Select a plan to upgrade to.');
      return;
    }
    upgradeMembership.mutate(
      { id: memberId, payload: { planId: upgradePlanId } },
      {
        onSuccess: () => {
          toast.success('Membership upgraded.');
          setUpgradePlanId('');
        },
        onError: (err) => toast.error(toMemberError(err).message),
      },
    );
  };

  const handleDowngrade = () => {
    if (!downgradePlanId) {
      toast.error('Select a plan to downgrade to.');
      return;
    }
    downgradeMembership.mutate(
      { id: memberId, payload: { planId: downgradePlanId } },
      {
        onSuccess: () => {
          toast.success('Membership downgraded.');
          setDowngradePlanId('');
        },
        onError: (err) => toast.error(toMemberError(err).message),
      },
    );
  };

  const handleQuickCheckIn = () => {
    manualCheckIn.mutate(
      { memberId },
      { onSuccess: () => toast.success('Checked in.'), onError: (err) => toast.error(toAttendanceError(err).message) },
    );
  };

  const handleQuickCheckOut = () => {
    manualCheckOut.mutate(
      { memberId },
      { onSuccess: () => toast.success('Checked out.'), onError: (err) => toast.error(toAttendanceError(err).message) },
    );
  };

  const handleExtend = () => {
    const days = Number(extendDays);
    if (!days || days <= 0) {
      toast.error('Enter a positive number of days.');
      return;
    }
    extendMembership.mutate(
      { id: memberId, payload: { days } },
      {
        onSuccess: () => {
          toast.success('Membership extended.');
          setExtendDays('');
        },
        onError: (err) => toast.error(toMemberError(err).message),
      },
    );
  };

  const handleCancelMembership = () => {
    cancelMembership.mutate(
      { id: memberId, payload: {} },
      { onSuccess: () => toast.success('Membership cancelled.'), onError: (err) => toast.error(toMemberError(err).message) },
    );
    setConfirmCancel(false);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/members">
          <ArrowLeft className="size-4" /> Back to members
        </Link>
      </Button>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Avatar className="size-12">
            {data.profilePhotoUrl ? <AvatarImage src={data.profilePhotoUrl} alt="" /> : null}
            <AvatarFallback>{data.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase()}</AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{data.name}</h1>
            <p className="text-muted-foreground">{data.memberId || 'No member ID'}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <MemberStatusBadge status={data.status} deleted={!!data.deletedAt} />
          {data.deletedAt ? (
            canRestore ? (
              <Button size="sm" onClick={() => setConfirmStatusAction('restore')}>
                Restore
              </Button>
            ) : null
          ) : (
            <>
              {canFreeze ? (
                data.status === 'FROZEN' ? (
                  <Button variant="outline" size="sm" onClick={handleResume}>
                    Resume
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" onClick={() => setConfirmFreeze(true)}>
                    Freeze
                  </Button>
                )
              ) : null}
              {canUpdate ? (
                data.status === 'ACTIVE' ? (
                  <Button variant="outline" size="sm" onClick={() => setConfirmStatusAction('deactivate')}>
                    Deactivate
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" onClick={() => setConfirmStatusAction('activate')}>
                    Activate
                  </Button>
                )
              ) : null}
            </>
          )}
          {!data.deletedAt && canDelete ? (
            <Button variant="destructive" size="sm" onClick={() => setConfirmStatusAction('delete')}>
              Delete
            </Button>
          ) : null}
        </div>
      </div>

      {canUpdate ? <UnsavedChangesBar isDirty={isDirty} saving={updateMember.isPending} onSave={handleSave} onCancel={handleCancel} /> : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profile photo</CardTitle>
        </CardHeader>
        <CardContent>
          <AvatarUpload name={data.name} value={form.profilePhotoUrl} onChange={(v) => set('profilePhotoUrl', v)} disabled={!canUpdate} />
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
              <Label htmlFor="memberId">Member ID</Label>
              <Input id="memberId" value={form.memberId} disabled={!canUpdate} onChange={(e) => set('memberId', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gender">Gender</Label>
              <select id="gender" className={selectClassName} value={form.gender} disabled={!canUpdate} onChange={(e) => set('gender', e.target.value)}>
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
            <div className="space-y-2">
              <Label htmlFor="bloodGroup">Blood group</Label>
              <select id="bloodGroup" className={selectClassName} value={form.bloodGroup} disabled={!canUpdate} onChange={(e) => set('bloodGroup', e.target.value)}>
                <option value="">Unknown</option>
                {['A_POSITIVE', 'A_NEGATIVE', 'B_POSITIVE', 'B_NEGATIVE', 'AB_POSITIVE', 'AB_NEGATIVE', 'O_POSITIVE', 'O_NEGATIVE'].map((bg) => (
                  <option key={bg} value={bg}>
                    {bg.replace('_', ' ')}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="height">Height (cm)</Label>
              <Input id="height" type="number" min={0} value={form.height} disabled={!canUpdate} onChange={(e) => set('height', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="weight">Weight (kg)</Label>
              <Input id="weight" type="number" min={0} value={form.weight} disabled={!canUpdate} onChange={(e) => set('weight', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="occupation">Occupation</Label>
              <Input id="occupation" value={form.occupation} disabled={!canUpdate} onChange={(e) => set('occupation', e.target.value)} />
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
            <Input id="emergencyContactName" value={form.emergencyContactName} disabled={!canUpdate} onChange={(e) => set('emergencyContactName', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="emergencyContactPhone">Phone</Label>
            <Input id="emergencyContactPhone" type="tel" value={form.emergencyContactPhone} disabled={!canUpdate} onChange={(e) => set('emergencyContactPhone', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="emergencyContactRelation">Relation</Label>
            <Input id="emergencyContactRelation" value={form.emergencyContactRelation} disabled={!canUpdate} onChange={(e) => set('emergencyContactRelation', e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Health &amp; fitness</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="medicalConditions">Medical conditions</Label>
            <textarea
              id="medicalConditions"
              className="flex min-h-16 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
              value={form.medicalConditions}
              disabled={!canUpdate}
              onChange={(e) => set('medicalConditions', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="allergies">Allergies</Label>
            <textarea
              id="allergies"
              className="flex min-h-16 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
              value={form.allergies}
              disabled={!canUpdate}
              onChange={(e) => set('allergies', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="fitnessGoals">Fitness goals</Label>
            <textarea
              id="fitnessGoals"
              className="flex min-h-16 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
              value={form.fitnessGoals}
              disabled={!canUpdate}
              onChange={(e) => set('fitnessGoals', e.target.value)}
            />
          </div>
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
          <CardTitle className="text-base">Branch &amp; trainer</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="branchId">Branch</Label>
            <BranchSelect id="branchId" value={branchId ?? ''} onChange={setBranchId} disabled={!canUpdate} />
            {canUpdate ? (
              <Button size="sm" disabled={transferBranch.isPending || branchId === data.branch.id} onClick={handleSaveBranch}>
                {transferBranch.isPending ? 'Saving…' : 'Save branch'}
              </Button>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="trainerId">Trainer</Label>
            <TrainerSelect id="trainerId" value={trainerId ?? ''} onChange={setTrainerId} disabled={!canAssignTrainer} />
            {canAssignTrainer ? (
              <Button size="sm" disabled={assignTrainer.isPending || trainerId === (data.trainer?.id ?? '')} onClick={handleSaveTrainer}>
                {assignTrainer.isPending ? 'Saving…' : 'Save trainer'}
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card id="membership">
        <CardHeader>
          <CardTitle className="text-base">Membership</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {data.currentMembership ? (
            <p className="text-sm">
              Currently on <span className="font-medium">{data.currentMembership.planName}</span> — ends{' '}
              {new Date(data.currentMembership.endDate).toLocaleDateString()}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">No active membership.</p>
          )}

          {canAssign && !data.currentMembership ? (
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-56 space-y-2">
                <Label htmlFor="assignPlan">Assign a plan</Label>
                <MembershipPlanSelect id="assignPlan" value={assignPlanId} onChange={setAssignPlanId} />
              </div>
              <div className="flex items-center gap-1.5 pb-2">
                <Checkbox id="assignAutoRenew" checked={assignAutoRenew} onCheckedChange={(c) => setAssignAutoRenew(c === true)} />
                <Label htmlFor="assignAutoRenew" className="cursor-pointer font-normal">
                  Auto-renew
                </Label>
              </div>
              <Button size="sm" disabled={assignMembership.isPending} onClick={handleAssignMembership}>
                {assignMembership.isPending ? 'Assigning…' : 'Assign membership'}
              </Button>
            </div>
          ) : null}

          {data.currentMembership ? (
            <div className="space-y-3">
              {canRenew ? (
                <div className="flex flex-wrap items-end gap-2">
                  <div className="min-w-56 space-y-2">
                    <Label htmlFor="renewPlan">Renew (same plan if left blank)</Label>
                    <MembershipPlanSelect id="renewPlan" value={renewPlanId} onChange={setRenewPlanId} />
                  </div>
                  <Button size="sm" disabled={renewMembership.isPending} onClick={handleRenew}>
                    {renewMembership.isPending ? 'Renewing…' : 'Renew'}
                  </Button>
                  <div className="max-w-32 space-y-2">
                    <Label htmlFor="extendDays">Extend by (days)</Label>
                    <Input id="extendDays" type="number" min={1} value={extendDays} onChange={(e) => setExtendDays(e.target.value)} />
                  </div>
                  <Button size="sm" variant="outline" disabled={extendMembership.isPending} onClick={handleExtend}>
                    {extendMembership.isPending ? 'Extending…' : 'Extend'}
                  </Button>
                </div>
              ) : null}
              {canUpgrade ? (
                <div className="flex flex-wrap items-end gap-2">
                  <div className="min-w-56 space-y-2">
                    <Label htmlFor="upgradePlan">Upgrade to</Label>
                    <MembershipPlanSelect id="upgradePlan" value={upgradePlanId} onChange={setUpgradePlanId} />
                  </div>
                  <Button size="sm" disabled={upgradeMembership.isPending} onClick={handleUpgrade}>
                    {upgradeMembership.isPending ? 'Upgrading…' : 'Upgrade'}
                  </Button>
                  <div className="min-w-56 space-y-2">
                    <Label htmlFor="downgradePlan">Downgrade to</Label>
                    <MembershipPlanSelect id="downgradePlan" value={downgradePlanId} onChange={setDowngradePlanId} />
                  </div>
                  <Button size="sm" variant="outline" disabled={downgradeMembership.isPending} onClick={handleDowngrade}>
                    {downgradeMembership.isPending ? 'Downgrading…' : 'Downgrade'}
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => setConfirmCancel(true)}>
                    Cancel membership
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}

          <div>
            <h3 className="mb-2 text-sm font-medium">Renewal history</h3>
            <MembershipHistoryTable entries={data.membershipHistory} />
          </div>
          <div>
            <h3 className="mb-2 text-sm font-medium">Freeze history</h3>
            <FreezeHistoryTable entries={data.freezeHistory} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Attendance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {canCheckIn ? (
              <Button size="sm" disabled={manualCheckIn.isPending} onClick={handleQuickCheckIn}>
                {manualCheckIn.isPending ? 'Checking in…' : 'Check in'}
              </Button>
            ) : null}
            {canCheckOut ? (
              <Button size="sm" variant="outline" disabled={manualCheckOut.isPending} onClick={handleQuickCheckOut}>
                {manualCheckOut.isPending ? 'Checking out…' : 'Check out'}
              </Button>
            ) : null}
            {!data.canCheckIn ? <span className="text-sm text-muted-foreground">Not eligible to check in right now.</span> : null}
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-medium">Recent visits</h3>
              <Link href="/attendance/history" className="text-sm text-muted-foreground hover:underline">
                View full history
              </Link>
            </div>
            {memberAttendance.isPending ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : (memberAttendance.data?.items.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground">No attendance recorded yet.</p>
            ) : (
              <div className="space-y-2">
                {memberAttendance.data!.items.map((record) => (
                  <div key={record.id} className="flex items-center justify-between gap-2 border-b pb-2 text-sm last:border-0 last:pb-0">
                    <span>
                      {new Date(record.checkInTime).toLocaleString()}
                      {record.checkOutTime ? ` – ${new Date(record.checkOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <AttendanceMethodBadge method={record.method} />
                      <AttendanceStatusBadge status={record.status} />
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">QR code</CardTitle>
        </CardHeader>
        <CardContent>
          <QrCodeDisplay memberId={memberId} qrCodeImageUrl={data.qrCodeImageUrl} canRegenerate={canUpdate} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Documents</CardTitle>
        </CardHeader>
        <CardContent>
          <DocumentUpload memberId={memberId} disabled={!canUpdate} />
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirmStatusAction !== null}
        onOpenChange={(open) => !open && setConfirmStatusAction(null)}
        title={confirmStatusAction ? `${confirmStatusAction[0]!.toUpperCase()}${confirmStatusAction.slice(1)} ${data.name}?` : ''}
        description={confirmStatusAction === 'delete' ? 'This soft-deletes the member — it can be restored later.' : 'This action can be reversed later if needed.'}
        destructive={confirmStatusAction === 'delete'}
        loading={statusAction.isPending}
        onConfirm={() => confirmStatusAction && runStatusAction(confirmStatusAction)}
      />

      <ConfirmDialog
        open={confirmFreeze}
        onOpenChange={setConfirmFreeze}
        title={`Freeze ${data.name}?`}
        description="A frozen member cannot check in until unfrozen."
        loading={freeze.isPending}
        onConfirm={handleFreeze}
      />

      <ConfirmDialog
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        title="Cancel this membership?"
        description="The current membership period will be cancelled. This can be preserved in history but not resumed — assign a new plan instead."
        destructive
        loading={cancelMembership.isPending}
        onConfirm={handleCancelMembership}
      />
    </div>
  );
}
