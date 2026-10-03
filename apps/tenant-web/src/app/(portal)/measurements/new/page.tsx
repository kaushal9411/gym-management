'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, Ruler, Search, X } from 'lucide-react';
import { toast } from 'sonner';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { LoadingButton } from '@/components/ui/loading-button';
import { MemberCheckinSearch } from '@/features/attendance/components/member-checkin-search';
import { accentVar, PanelCard } from '@/features/members/components/detail/detail-ui';
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
    <div className="w-full space-y-4">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/measurements">
          <ArrowLeft className="size-4" /> Back to Body Measurements
        </Link>
      </Button>

      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative overflow-hidden rounded-3xl p-6 text-white shadow-lg sm:px-7"
        style={{ backgroundImage: 'radial-gradient(900px 320px at 88% -30%, color-mix(in oklch, #c026d3 75%, transparent), transparent 60%), linear-gradient(115deg, #4338ca, #7c3aed 62%, #c026d3)' }}
      >
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-60" style={{ backgroundImage: 'repeating-linear-gradient(135deg, rgba(255,255,255,.06) 0 1px, transparent 1px 14px)' }} />
        <div className="relative">
          <p className="text-[11px] font-bold uppercase tracking-widest text-white/80">Progress</p>
          <h1 className="mt-0.5 text-3xl font-extrabold tracking-tight sm:text-4xl">Record a measurement</h1>
          <p className="mt-1 text-white/85">Pick a member and log their latest body measurements.</p>
        </div>
      </motion.section>

      <form onSubmit={submit} className="mx-auto max-w-3xl space-y-4">
        {error ? (
          <motion.p role="alert" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
            {error}
          </motion.p>
        ) : null}

        <PanelCard icon={Search} accent="primary" title="Member" delay={0}>
          {member ? (
            <div className="flex items-center gap-2.5 rounded-xl border p-2.5" style={{ backgroundColor: 'color-mix(in oklch, var(--primary) 6%, transparent)', borderColor: 'color-mix(in oklch, var(--primary) 16%, transparent)' }}>
              <Avatar className="size-9">
                {member.profilePhotoUrl ? <AvatarImage src={member.profilePhotoUrl} alt="" /> : null}
                <AvatarFallback className="text-xs font-extrabold text-white" style={{ backgroundImage: `linear-gradient(135deg, ${accentVar('primary')}, var(--chart-7))` }}>
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
        </PanelCard>

        <PanelCard icon={Ruler} accent="aqua" title="Measurement values" delay={0.05}>
          <MeasurementFormFields value={form} onChange={setForm} disabled={createMeasurement.isPending} />
        </PanelCard>

        <div className="sticky bottom-3 z-10 flex justify-end gap-3 rounded-2xl border bg-card/95 p-3.5 shadow-lg backdrop-blur">
          <Button type="button" variant="outline" asChild disabled={createMeasurement.isPending}>
            <Link href="/measurements">Cancel</Link>
          </Button>
          <LoadingButton
            type="submit"
            loading={createMeasurement.isPending}
            loadingText="Saving…"
            disabled={!member}
            className="border-0 px-6 text-white shadow-md"
            style={{ backgroundImage: 'linear-gradient(120deg, var(--success), var(--chart-3))' }}
          >
            Save measurement
          </LoadingButton>
        </div>
      </form>
    </div>
  );
}
