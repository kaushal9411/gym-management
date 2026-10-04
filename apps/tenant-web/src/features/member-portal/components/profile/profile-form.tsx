'use client';

import * as React from 'react';
import { AlertCircle, Dumbbell, HeartPulse, Home, Mail, UserRound } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { LoadingButton } from '@/components/ui/loading-button';
import { PasswordInput } from '@/features/auth/components/password-input';
import { BLOOD_GROUP_LABELS } from '@/features/members/components/member-health-screening-fields';
import { BODY_TYPE_LABELS, FOOD_PREFERENCE_LABELS, GOAL_LABELS, MARITAL_STATUS_LABELS } from '@/features/members/components/member-extended-info-fields';
import { useMotionSafe } from '@/features/reports/lib/motion';
import { useUpdateMemberProfile } from '../../hooks/use-member-portal';
import { ProfileRequestError, type MemberSelfProfile } from '../../services/member-profile.service';
import { SectionCard } from '../kit';
import { ChipSelect, Field, FieldInput } from './fields';
import { buildPatch, changedKeys, emailChanged, toFormState, validate, type FormErrors, type FormKey, type FormState } from './profile-form-lib';

const GENDERS: Array<[string, string]> = [['MALE', 'Male'], ['FEMALE', 'Female'], ['OTHER', 'Other'], ['PREFER_NOT_TO_SAY', 'Prefer not to say']];
const opts = (m: Record<string, string>): Array<[string, string]> => Object.entries(m);
const today = () => new Date().toISOString().slice(0, 10);

/** Self-service edit form. Draft overlays the query data (no seeding effect); only changed keys are PATCHed. */
export function ProfileForm({ profile, footer }: { profile: MemberSelfProfile; footer?: React.ReactNode }) {
  const update = useUpdateMemberProfile();
  const m = useMotionSafe();
  const base = React.useMemo(() => toFormState(profile), [profile]);
  const [draft, setDraft] = React.useState<Partial<FormState>>({});
  const [password, setPassword] = React.useState('');
  const [errors, setErrors] = React.useState<FormErrors>({});
  const [banner, setBanner] = React.useState<string | null>(null);

  const values: FormState = { ...base, ...draft };
  const keys = changedKeys(base, draft);
  const dirty = keys.length > 0;
  const needsPassword = emailChanged(base, values);
  const saving = update.isPending;

  React.useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);

  const set = (k: FormKey, v: string) => {
    setDraft((d) => ({ ...d, [k]: v }));
    setErrors((e) => (e[k] ? { ...e, [k]: undefined } : e));
    setBanner(null);
  };
  const reset = () => {
    setDraft({});
    setPassword('');
    setErrors({});
    setBanner(null);
  };

  const submit = (ev?: React.FormEvent) => {
    ev?.preventDefault();
    if (!dirty || saving) return;
    const errs = validate(keys, values);
    if (needsPassword && !password) errs.currentPassword = 'Enter your current password to change your email';
    setErrors(errs);
    if (Object.keys(errs).length) {
      setBanner('Please fix the highlighted fields.');
      scrollToError();
      return;
    }
    const patch = buildPatch(keys, values);
    if (needsPassword) patch.currentPassword = password;
    setBanner(null);
    update.mutate(patch, {
      onSuccess: () => {
        reset();
        toast.success('Profile updated');
      },
      onError: (err) => {
        if (!(err instanceof ProfileRequestError)) return setBanner('Something went wrong. Please try again.');
        const fe: FormErrors = {};
        for (const [f, msg] of Object.entries(err.fieldErrors)) fe[f as FormKey] = msg;
        setErrors(fe);
        setBanner(Object.keys(fe).length ? 'Please fix the highlighted fields.' : err.message);
        scrollToError();
      },
    });
  };

  const f = (k: FormKey, label: string, extra: React.ComponentProps<typeof FieldInput> = {}, hint?: React.ReactNode, className?: string) => (
    <Field id={`pf-${k}`} label={label} error={errors[k]} hint={hint} className={className}>
      <FieldInput id={`pf-${k}`} name={k} value={values[k]} invalid={!!errors[k]} disabled={saving} onChange={(e) => set(k, e.target.value)} {...extra} />
    </Field>
  );
  const formRef = React.useRef<HTMLFormElement>(null);
  const scrollToError = () => requestAnimationFrame(() => requestAnimationFrame(() => (formRef.current?.querySelector('p[id$="-error"]') ?? formRef.current?.querySelector('[role="alert"]'))?.scrollIntoView({ block: 'center', behavior: 'smooth' })));
  const grid = 'grid gap-4 sm:grid-cols-2';

  return (
    <form ref={formRef} onSubmit={submit} noValidate className="space-y-4 md:space-y-5">
      {banner ? (
        <p role="alert" className="flex items-start gap-2 rounded-xl bg-destructive/10 px-3.5 py-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" /> {banner}
        </p>
      ) : null}

      <div className="grid items-start gap-4 md:gap-5 lg:grid-cols-2">
        <SectionCard title="Personal" subtitle="Who you are" icon={UserRound} tone="primary">
          <div className="space-y-4">
            <div className={grid}>
              {f('firstName', 'First name', { autoComplete: 'given-name', required: true })}
              {f('lastName', 'Last name', { autoComplete: 'family-name', required: true })}
              {f('dateOfBirth', 'Date of birth', { type: 'date', max: today(), autoComplete: 'bday' })}
              {f('anniversary', 'Anniversary', { type: 'date' })}
            </div>
            <ChipSelect label="Gender" value={values.gender} options={GENDERS} onChange={(v) => set('gender', v)} disabled={saving} error={errors.gender} />
            <ChipSelect label="Marital status" value={values.maritalStatus} options={opts(MARITAL_STATUS_LABELS)} onChange={(v) => set('maritalStatus', v)} disabled={saving} error={errors.maritalStatus} />
          </div>
        </SectionCard>

        <SectionCard title="Contact" subtitle="How your gym reaches you" icon={Mail} tone="info">
          <div className="space-y-4">
            {f('phone', 'Phone', { type: 'tel', inputMode: 'tel', autoComplete: 'tel', placeholder: '+91 98765 43210' })}
            {f('email', 'Email', { type: 'email', inputMode: 'email', autoComplete: 'email' }, 'Changing your email asks for your current password.')}
            <AnimatePresence initial={false}>
              {needsPassword ? (
                <motion.div key="pw" initial={m.reduce ? false : { opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={m.reduce ? { opacity: 0 } : { opacity: 0, height: 0 }} className="overflow-hidden">
                  <Field id="pf-currentPassword" label="Current password" error={errors.currentPassword} hint="Required to confirm the email change.">
                    <PasswordInput id="pf-currentPassword" autoComplete="current-password" value={password} invalid={!!errors.currentPassword} disabled={saving} onChange={(e) => { setPassword(e.target.value); setErrors((x) => ({ ...x, currentPassword: undefined })); }} />
                  </Field>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        </SectionCard>

        <SectionCard title="Address" subtitle="Where you live" icon={Home} tone="success">
          <div className={grid}>
            {f('addressLine', 'Address', { autoComplete: 'street-address' }, undefined, 'sm:col-span-2')}
            {f('city', 'City', { autoComplete: 'address-level2' })}
            {f('state', 'State', { autoComplete: 'address-level1' })}
            {f('country', 'Country', { autoComplete: 'country-name' })}
            {f('postalCode', 'Postal code', { autoComplete: 'postal-code', inputMode: 'numeric' })}
          </div>
        </SectionCard>

        <SectionCard title="Emergency contact" subtitle="Who we call if needed" icon={HeartPulse} tone="danger">
          <div className={grid}>
            {f('emergencyContactName', 'Name', {}, undefined, 'sm:col-span-2')}
            {f('emergencyContactPhone', 'Phone', { type: 'tel', inputMode: 'tel' })}
            {f('emergencyContactRelation', 'Relation', { placeholder: 'e.g. Spouse' })}
          </div>
        </SectionCard>

        <SectionCard title="Fitness profile" subtitle="Helps your trainer plan for you" icon={Dumbbell} tone="orange" className="lg:col-span-2">
          <div className="space-y-4">
            <ChipSelect label="Goal" value={values.goal} options={opts(GOAL_LABELS)} onChange={(v) => set('goal', v)} disabled={saving} error={errors.goal} />
            <div className="grid gap-4 lg:grid-cols-2">
              <ChipSelect label="Body type" value={values.bodyType} options={opts(BODY_TYPE_LABELS)} onChange={(v) => set('bodyType', v)} disabled={saving} error={errors.bodyType} />
              <ChipSelect label="Food preference" value={values.foodPreference} options={opts(FOOD_PREFERENCE_LABELS)} onChange={(v) => set('foodPreference', v)} disabled={saving} error={errors.foodPreference} />
            </div>
            <ChipSelect label="Blood group" value={values.bloodGroup} options={opts(BLOOD_GROUP_LABELS)} onChange={(v) => set('bloodGroup', v)} disabled={saving} error={errors.bloodGroup} />
            <div className="grid gap-4 sm:grid-cols-3">
              {f('height', 'Height (cm)', { type: 'number', inputMode: 'decimal', min: 50, max: 300, step: 'any' })}
              {f('weight', 'Weight (kg)', { type: 'number', inputMode: 'decimal', min: 10, max: 500, step: 'any' })}
              {f('occupation', 'Occupation')}
            </div>
            <Field id="pf-fitnessGoals" label="Fitness goals in your words" error={errors.fitnessGoals} hint={`${values.fitnessGoals.length}/1000`}>
              <textarea
                id="pf-fitnessGoals"
                rows={3}
                value={values.fitnessGoals}
                disabled={saving}
                onChange={(e) => set('fitnessGoals', e.target.value)}
                aria-invalid={!!errors.fitnessGoals || undefined}
                className="w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-base shadow-xs focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-50 md:text-sm"
              />
            </Field>
          </div>
        </SectionCard>

        {footer}
      </div>

      <div aria-hidden className={dirty ? 'h-20' : 'h-0'} />
      <AnimatePresence>
        {dirty ? (
          <motion.div
            initial={m.reduce ? false : { opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={m.reduce ? { opacity: 0 } : { opacity: 0, y: 24 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-x-3 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-30 mx-auto flex max-w-3xl items-center gap-3 rounded-2xl border bg-card/95 p-2.5 pl-4 shadow-xl backdrop-blur-md md:bottom-4 md:left-[calc(50%+7rem)] md:right-auto md:w-[min(44rem,calc(100vw-20rem))] md:-translate-x-1/2"
            style={{ borderColor: 'color-mix(in oklch, var(--warning) 55%, transparent)' }}
            role="region"
            aria-label="Unsaved changes"
          >
            <p className="min-w-0 flex-1 truncate text-sm font-semibold">
              {keys.length} unsaved {keys.length === 1 ? 'change' : 'changes'}
            </p>
            <Button type="button" variant="ghost" className="h-11 px-4" disabled={saving} onClick={reset}>
              Discard
            </Button>
            <LoadingButton type="submit" className="h-11 px-5" loading={saving} loadingText="Saving…">
              Save
            </LoadingButton>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </form>
  );
}
