'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, X } from 'lucide-react';
import { toast } from 'sonner';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { LoadingButton } from '@/components/ui/loading-button';
import { MemberCheckinSearch } from '@/features/attendance/components/member-checkin-search';
import { EMPTY_MEASUREMENT_FORM, MeasurementFormFields, measurementFormToPayload } from '@/features/measurements/components/measurement-form-fields';
import { toMeasurementError, useCreateMeasurement } from '@/features/measurements/hooks/use-measurements';
import type { BodyMeasurementFormValues } from '@/features/measurements/types';
import type { MemberListItem } from '@/features/members/types';

/**
 * Create-and-assign in one step — unlike Workout/Diet Plans there's no
 * separate reusable "plan" to build first (a measurement entry only ever
 * belongs to one member, no template concept), so this page combines what
 * those two split across "Create" + "Assign to member": pick the member,
 * fill the values, save. Reuses the same `MemberCheckinSearch` those two
 * features already use for their own assign flow.
 */
export default function NewMeasurementPage() {
  const router = useRouter();
  const [member, setMember] = React.useState<MemberListItem | null>(null);
  const [form, setForm] = React.useState<BodyMeasurementFormValues>(EMPTY_MEASUREMENT_FORM);
  const [error, setError] = React.useState<string | null>(null);
  const createMeasurement = useCreateMeasurement(member?.id ?? '');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!member) {
      setError('Select a member first.');
      return;
    }
    createMeasurement.mutate(measurementFormToPayload(form), {
      onSuccess: () => {
        toast.success(`Measurement recorded for ${member.name}.`);
        router.push(`/measurements/${member.id}`);
      },
      onError: (err) => setError(toMeasurementError(err).message),
    });
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/measurements">
          <ArrowLeft className="size-4" /> Back to Body Measurements
        </Link>
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>Record a measurement</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-6">
            {error ? (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            ) : null}

            <div className="space-y-2">
              <Label required>Member</Label>
              {member ? (
                <div className="flex items-center gap-2.5 rounded-lg border bg-muted/30 p-2.5">
                  <Avatar className="size-8">
                    {member.profilePhotoUrl ? <AvatarImage src={member.profilePhotoUrl} alt="" /> : null}
                    <AvatarFallback className="text-xs">
                      {member.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="flex-1">
                    <span className="block text-sm font-medium">{member.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {member.memberId} · {member.branch.name}
                    </span>
                  </span>
                  <Button type="button" variant="ghost" size="icon" className="size-8" aria-label="Change member" onClick={() => setMember(null)}>
                    <X className="size-4" />
                  </Button>
                </div>
              ) : (
                <MemberCheckinSearch onSelect={setMember} placeholder="Search member by name, email, or member ID…" />
              )}
            </div>

            <MeasurementFormFields value={form} onChange={setForm} disabled={createMeasurement.isPending} />

            <LoadingButton type="submit" className="w-full" loading={createMeasurement.isPending} loadingText="Saving…" disabled={!member}>
              Save measurement
            </LoadingButton>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
