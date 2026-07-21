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
import { PasswordInput } from '@/features/auth/components/password-input';
import { PasswordStrengthMeter } from '@/features/auth/components/password-strength-meter';
import { BranchAccessEditor, type BranchAssignment } from '@/features/iam/components/branch-access-editor';
import { RoleMultiSelect } from '@/features/iam/components/role-select';
import { toIamError, useCreateUser } from '@/features/iam/hooks/use-iam';

/** Direct account creation — for staff standing next to you; email lands already verified. */
export default function NewUserPage() {
  const router = useRouter();
  const createUser = useCreateUser();

  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [roleIds, setRoleIds] = React.useState<string[]>([]);
  const [branchAccess, setBranchAccess] = React.useState<{ allBranches: boolean; branches: BranchAssignment[] }>({
    allBranches: true,
    branches: [],
  });
  const [error, setError] = React.useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (roleIds.length === 0) {
      setError('Assign at least one role.');
      return;
    }
    createUser.mutate(
      {
        name,
        email,
        phone: phone || undefined,
        password,
        roleIds,
        allBranches: branchAccess.allBranches,
        branches: branchAccess.allBranches ? undefined : branchAccess.branches,
      },
      {
        onSuccess: (user) => {
          toast.success(`${user.name} created`);
          router.push(`/users/${user.id}`);
        },
        onError: (err) => setError(toIamError(err).message),
      },
    );
  };

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/users">
          <ArrowLeft className="size-4" /> Back to users
        </Link>
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>Create a user</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Full name</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} disabled={createUser.isPending} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={createUser.isPending} />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone (optional)</Label>
                <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={createUser.isPending} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Temporary password</Label>
                <PasswordInput id="password" value={password} onChange={(e) => setPassword(e.target.value)} disabled={createUser.isPending} />
                <PasswordStrengthMeter password={password} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Roles</Label>
              <RoleMultiSelect selected={roleIds} onChange={setRoleIds} disabled={createUser.isPending} />
            </div>

            <div className="space-y-2">
              <Label>Branch access</Label>
              <BranchAccessEditor
                allBranches={branchAccess.allBranches}
                branches={branchAccess.branches}
                onChange={setBranchAccess}
                disabled={createUser.isPending}
              />
            </div>

            <Button type="submit" className="w-full" disabled={createUser.isPending}>
              {createUser.isPending ? 'Creating…' : 'Create user'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
