'use client';

import { HeartPulse, Info, Megaphone, X } from 'lucide-react';

import { Label } from '@/components/ui/label';
import { MemberCheckinSearch } from '@/features/attendance/components/member-checkin-search';
import { PanelCard } from '../detail/detail-ui';
import { AWARENESS_SOURCE_LABELS, BLOOD_GROUP_LABELS, HEALTH_QUESTIONS, type MemberHealthFormState } from '../member-health-screening-fields';
import { ChipSelect, Notice, YesNoToggle } from './wizard-ui';
import type { AwarenessSource, BloodGroup } from '../../types';

interface StepHealthScreeningProps {
  value: MemberHealthFormState;
  onChange: (value: MemberHealthFormState) => void;
  disabled?: boolean;
}

const entries = <T extends string>(map: Record<T, string>) => (Object.keys(map) as T[]).map((k) => [k, map[k]] as const);

export function StepHealthScreening({ value, onChange, disabled }: StepHealthScreeningProps) {
  const set = <K extends keyof MemberHealthFormState>(key: K, next: MemberHealthFormState[K]) => onChange({ ...value, [key]: next });

  return (
    <div className="space-y-5">
      <Notice tone="aqua">
        <Info className="mt-0.5 size-4 shrink-0" style={{ color: 'var(--chart-3)' }} aria-hidden />
        <p>
          <b>Used only to plan safe training.</b> Answers stay with your gym staff and are never used for advertising.
        </p>
      </Notice>

      <PanelCard icon={HeartPulse} accent="destructive" title="Health background screening" delay={0}>
        <div className="space-y-2.5">
          {HEALTH_QUESTIONS.map((q) => {
            const yes = Boolean(value[q.key as keyof MemberHealthFormState]);
            return (
              <div
                key={q.key}
                className="flex flex-col gap-3 rounded-2xl border p-3.5 transition-colors sm:flex-row sm:items-center sm:gap-4"
                style={yes ? { backgroundColor: 'color-mix(in oklch, var(--destructive) 8%, transparent)', borderColor: 'color-mix(in oklch, var(--destructive) 40%, transparent)' } : undefined}
              >
                <p className="flex-1 text-[13.5px]">{q.label}</p>
                <YesNoToggle label={q.label} value={yes} disabled={disabled} onChange={(v) => onChange({ ...value, [q.key]: v })} />
              </div>
            );
          })}
        </div>
        <div className="space-y-2">
          <Label htmlFor="healthScreeningOtherDetails">Other details</Label>
          <textarea
            id="healthScreeningOtherDetails"
            placeholder="Anything else the trainer should know"
            className="flex min-h-24 w-full rounded-xl border border-input bg-background px-3.5 py-2 text-sm shadow-xs transition-all duration-150 focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50"
            value={value.healthScreeningOtherDetails}
            disabled={disabled}
            onChange={(e) => set('healthScreeningOtherDetails', e.target.value)}
          />
        </div>
      </PanelCard>

      <PanelCard icon={Megaphone} accent="warning" title="A few more things" delay={0.08}>
        <div className="space-y-2">
          <p className="text-[13px] font-semibold">How did you get to know about the gym?</p>
          <ChipSelect<AwarenessSource> label="How did you get to know about the gym" value={value.awarenessSource} options={entries(AWARENESS_SOURCE_LABELS)} onChange={(v) => set('awarenessSource', v)} accent="warning" disabled={disabled} />
        </div>
        <div className="space-y-2">
          <p className="text-[13px] font-semibold">Blood group</p>
          <ChipSelect<BloodGroup> label="Blood group" value={value.bloodGroup} options={entries(BLOOD_GROUP_LABELS)} onChange={(v) => set('bloodGroup', v)} accent="destructive" disabled={disabled} />
        </div>
        <div className="space-y-2">
          <Label>Reference (referred by an existing member)</Label>
          {value.referredByMemberId ? (
            <div className="flex h-10 items-center justify-between rounded-xl border border-input bg-muted/40 px-3.5 text-sm">
              <span className="font-semibold">{value.referredByMemberLabel}</span>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onChange({ ...value, referredByMemberId: '', referredByMemberLabel: '' })}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Remove referral"
              >
                <X className="size-4" />
              </button>
            </div>
          ) : (
            <MemberCheckinSearch
              placeholder="Search a member who referred this person…"
              onSelect={(member) => onChange({ ...value, referredByMemberId: member.id, referredByMemberLabel: `${member.name} (${member.memberId})` })}
            />
          )}
        </div>
      </PanelCard>
    </div>
  );
}
