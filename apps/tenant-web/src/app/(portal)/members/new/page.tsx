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
import { BranchSelect } from '@/features/members/components/branch-select';
import { TrainerSelect } from '@/features/members/components/trainer-select';
import { toMemberError, useCreateMember } from '@/features/members/hooks/use-members';

export default function NewMemberPage() {
  const router = useRouter();
  const createMember = useCreateMember();

  const [firstName, setFirstName] = React.useState('');
  const [lastName, setLastName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [memberId, setMemberId] = React.useState('');
  const [branchId, setBranchId] = React.useState('');
  const [trainerId, setTrainerId] = React.useState('');
  const [fitnessGoals, setFitnessGoals] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!branchId) {
      setError('Select a branch.');
      return;
    }
    createMember.mutate(
      {
        firstName,
        lastName,
        email: email || undefined,
        phone: phone || undefined,
        memberId: memberId || undefined,
        branchId,
        trainerId: trainerId || undefined,
        fitnessGoals: fitnessGoals || undefined,
      },
      {
        onSuccess: (member) => {
          toast.success(`${member.name} created`);
          router.push(`/members/${member.id}`);
        },
        onError: (err) => setError(toMemberError(err).message),
      },
    );
  };

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/members">
          <ArrowLeft className="size-4" /> Back to members
        </Link>
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>Add a member</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="firstName">First name</Label>
                <Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} disabled={createMember.isPending} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last name</Label>
                <Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} disabled={createMember.isPending} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email (optional)</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={createMember.isPending} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone (optional)</Label>
                <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={createMember.isPending} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="memberId">Member ID (optional — auto-generated if left blank)</Label>
                <Input id="memberId" value={memberId} onChange={(e) => setMemberId(e.target.value)} disabled={createMember.isPending} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="branchId">Branch</Label>
                <BranchSelect id="branchId" value={branchId} onChange={setBranchId} disabled={createMember.isPending} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="trainerId">Trainer (optional)</Label>
                <TrainerSelect id="trainerId" value={trainerId} onChange={setTrainerId} disabled={createMember.isPending} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fitnessGoals">Fitness goals (optional)</Label>
                <Input id="fitnessGoals" value={fitnessGoals} onChange={(e) => setFitnessGoals(e.target.value)} disabled={createMember.isPending} />
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={createMember.isPending}>
              {createMember.isPending ? 'Creating…' : 'Create member'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
