'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  EmploymentInfoFields,
  type EmploymentInfoValue,
} from '@/features/staff/components/employment-info-fields';
import { StaffBranchesEditor } from '@/features/staff/components/staff-branches-editor';
import { StaffRoleSelect } from '@/features/staff/components/staff-role-select';
import { toStaffError, useCreateStaff } from '@/features/staff/hooks/use-staff';
import type { StaffRole } from '@/features/staff/types';

const DEFAULT_EMPLOYMENT: EmploymentInfoValue = {
  employmentType: 'FULL_TIME',
  salaryType: 'MONTHLY',
  salaryAmount: '',
  shift: '',
  weeklyOff: '',
  workStatus: 'WORKING',
};

/** Creates the staff account and sends them an activation email to set their own password. */
export default function NewStaffPage() {
  const router = useRouter();
  const createStaff = useCreateStaff();

  const [firstName, setFirstName] = React.useState('');
  const [lastName, setLastName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [employeeId, setEmployeeId] = React.useState('');
  const [role, setRole] = React.useState<StaffRole>('TRAINER');
  const [branches, setBranches] = React.useState<{ branchIds: string[]; primaryBranchId: string | null }>({
    branchIds: [],
    primaryBranchId: null,
  });
  const [employment, setEmployment] = React.useState<EmploymentInfoValue>(DEFAULT_EMPLOYMENT);
  const [error, setError] = React.useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!branches.primaryBranchId) {
      setError('Assign at least one branch (and mark one as primary).');
      return;
    }
    createStaff.mutate(
      {
        firstName,
        lastName,
        email,
        phone: phone || undefined,
        employeeId: employeeId || undefined,
        role,
        primaryBranchId: branches.primaryBranchId,
        branchIds: branches.branchIds,
        employmentType: employment.employmentType,
        salaryType: employment.salaryType,
        salaryAmount: employment.salaryAmount ? Number(employment.salaryAmount) : undefined,
        shift: employment.shift || undefined,
        weeklyOff: employment.weeklyOff || undefined,
        workStatus: employment.workStatus,
      },
      {
        onSuccess: (staffMember) => {
          toast.success(`${staffMember.name} created — activation email sent`);
          router.push(`/staff/${staffMember.id}`);
        },
        onError: (err) => setError(toStaffError(err).message),
      },
    );
  };

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/staff">
          <ArrowLeft className="size-4" /> Back to staff
        </Link>
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>Add a staff member</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-5">
            {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="firstName">First name</Label>
                <Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} disabled={createStaff.isPending} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last name</Label>
                <Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} disabled={createStaff.isPending} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={createStaff.isPending} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone (optional)</Label>
                <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={createStaff.isPending} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="employeeId">Employee ID (optional — auto-generated if left blank)</Label>
                <Input id="employeeId" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} disabled={createStaff.isPending} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <StaffRoleSelect id="role" value={role} onChange={setRole} disabled={createStaff.isPending} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Branches (assign at least one, mark one primary)</Label>
              <StaffBranchesEditor
                branchIds={branches.branchIds}
                primaryBranchId={branches.primaryBranchId}
                onChange={setBranches}
                disabled={createStaff.isPending}
              />
            </div>

            <div className="space-y-2">
              <Label>Employment information</Label>
              <EmploymentInfoFields value={employment} onChange={setEmployment} disabled={createStaff.isPending} />
            </div>

            <Button type="submit" className="w-full" disabled={createStaff.isPending}>
              {createStaff.isPending ? 'Creating…' : 'Create staff member'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
