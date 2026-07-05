'use client';

import * as React from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';

import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { FormAlert } from '@/features/auth/components/form-alert';
import { LoadingButton } from '@/features/auth/components/loading-button';
import { PasswordInput } from '@/features/auth/components/password-input';
import { PasswordStrengthMeter } from '@/features/auth/components/password-strength-meter';
import { toOnboardingError, useRegisterOnboarding } from '../../hooks/use-onboarding';
import { accountDetailsSchema, type AccountDetailsFormValues } from '../../schemas';
import { useOnboardingWizard } from '../../store/onboarding-wizard-context';

const COUNTRIES = [
  'India', 'United States', 'United Kingdom', 'Canada', 'Australia', 'United Arab Emirates',
  'Singapore', 'Germany', 'France', 'South Africa', 'New Zealand', 'Ireland',
] as const;

const CURRENCIES = ['INR', 'USD', 'GBP', 'CAD', 'AUD', 'AED', 'SGD', 'EUR', 'NZD'] as const;

const COMMON_TIMEZONES = [
  'Asia/Kolkata', 'Asia/Dubai', 'Asia/Singapore', 'Europe/London', 'Europe/Berlin', 'Europe/Paris',
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'America/Toronto',
  'Australia/Sydney', 'Pacific/Auckland', 'Africa/Johannesburg',
] as const;

const selectClassName = cn(
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors duration-200',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-ring',
  'disabled:cursor-not-allowed disabled:opacity-50',
);

function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';
  } catch {
    return 'Asia/Kolkata';
  }
}

/** Step 1 — gym + owner details, credentials, and legal acknowledgements. */
export function AccountDetailsStep() {
  const { dispatch } = useOnboardingWizard();
  const registerOnboarding = useRegisterOnboarding();
  const [serverError, setServerError] = React.useState<string | null>(null);

  const form = useForm<AccountDetailsFormValues>({
    resolver: zodResolver(accountDetailsSchema),
    defaultValues: {
      gymName: '',
      legalName: '',
      ownerFirstName: '',
      ownerLastName: '',
      email: '',
      mobile: '',
      country: 'India',
      state: '',
      city: '',
      timezone: detectTimezone(),
      currency: 'INR',
      gstNumber: '',
      businessRegistrationNumber: '',
      password: '',
      confirmPassword: '',
      acceptTerms: false,
      acceptPrivacyPolicy: false,
    },
  });

  const passwordValue = form.watch('password');
  const fieldError = (name: keyof AccountDetailsFormValues) => form.formState.errors[name]?.message as string | undefined;
  const isSubmitting = registerOnboarding.isPending;

  const onSubmit = form.handleSubmit((values) => {
    setServerError(null);
    registerOnboarding.mutate(
      {
        ...values,
        legalName: values.legalName || undefined,
        gstNumber: values.gstNumber || undefined,
        businessRegistrationNumber: values.businessRegistrationNumber || undefined,
        // Backend's NoopCaptchaVerifier only requires a non-empty token — no
        // real CAPTCHA widget is wired up yet (see captcha.service.ts).
        captchaToken: `noop-${Date.now()}`,
      },
      {
        onSuccess: ({ sessionId, maskedEmail }) => {
          toast.success('Check your inbox for a verification code');
          dispatch({ type: 'REGISTERED', sessionId, maskedEmail, gymName: values.gymName });
        },
        onError: (error) => {
          const onboardingError = toOnboardingError(error);
          if (onboardingError.code === 'CONFLICT') {
            setServerError(onboardingError.message);
            return;
          }
          setServerError(onboardingError.message);
        },
      },
    );
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <FormAlert variant="error" message={serverError} />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="gymName">Gym name</Label>
          <Input id="gymName" placeholder="Gold's Gym" invalid={!!fieldError('gymName')} disabled={isSubmitting} {...form.register('gymName')} />
          {fieldError('gymName') ? <p role="alert" className="text-xs text-destructive">{fieldError('gymName')}</p> : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="legalName">Legal / registered name (optional)</Label>
          <Input id="legalName" placeholder="Gold's Fitness Pvt. Ltd." disabled={isSubmitting} {...form.register('legalName')} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="ownerFirstName">Your first name</Label>
          <Input id="ownerFirstName" autoComplete="given-name" invalid={!!fieldError('ownerFirstName')} disabled={isSubmitting} {...form.register('ownerFirstName')} />
          {fieldError('ownerFirstName') ? <p role="alert" className="text-xs text-destructive">{fieldError('ownerFirstName')}</p> : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="ownerLastName">Your last name</Label>
          <Input id="ownerLastName" autoComplete="family-name" invalid={!!fieldError('ownerLastName')} disabled={isSubmitting} {...form.register('ownerLastName')} />
          {fieldError('ownerLastName') ? <p role="alert" className="text-xs text-destructive">{fieldError('ownerLastName')}</p> : null}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="email">Work email</Label>
          <Input id="email" type="email" autoComplete="email" placeholder="owner@goldgym.com" invalid={!!fieldError('email')} disabled={isSubmitting} {...form.register('email')} />
          {fieldError('email') ? <p role="alert" className="text-xs text-destructive">{fieldError('email')}</p> : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="mobile">Mobile number</Label>
          <Input id="mobile" type="tel" autoComplete="tel" placeholder="+91 98765 43210" invalid={!!fieldError('mobile')} disabled={isSubmitting} {...form.register('mobile')} />
          {fieldError('mobile') ? <p role="alert" className="text-xs text-destructive">{fieldError('mobile')}</p> : null}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="country">Country</Label>
        <select id="country" className={selectClassName} disabled={isSubmitting} {...form.register('country')}>
          {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="state">State / region</Label>
          <Input id="state" invalid={!!fieldError('state')} disabled={isSubmitting} {...form.register('state')} />
          {fieldError('state') ? <p role="alert" className="text-xs text-destructive">{fieldError('state')}</p> : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="city">City</Label>
          <Input id="city" invalid={!!fieldError('city')} disabled={isSubmitting} {...form.register('city')} />
          {fieldError('city') ? <p role="alert" className="text-xs text-destructive">{fieldError('city')}</p> : null}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="timezone">Timezone</Label>
          <select id="timezone" className={selectClassName} disabled={isSubmitting} {...form.register('timezone')}>
            {COMMON_TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="currency">Billing currency</Label>
          <select id="currency" className={selectClassName} disabled={isSubmitting} {...form.register('currency')}>
            {CURRENCIES.map((cur) => <option key={cur} value={cur}>{cur}</option>)}
          </select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="numberOfBranches">Number of branches (optional)</Label>
          <Input id="numberOfBranches" type="number" min={1} disabled={isSubmitting} {...form.register('numberOfBranches')} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="expectedMembers">Expected members (optional)</Label>
          <Input id="expectedMembers" type="number" min={1} disabled={isSubmitting} {...form.register('expectedMembers')} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="gstNumber">GST / tax number (optional)</Label>
          <Input id="gstNumber" disabled={isSubmitting} {...form.register('gstNumber')} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="businessRegistrationNumber">Business registration number (optional)</Label>
          <Input id="businessRegistrationNumber" disabled={isSubmitting} {...form.register('businessRegistrationNumber')} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <PasswordInput id="password" autoComplete="new-password" invalid={!!fieldError('password')} disabled={isSubmitting} {...form.register('password')} />
        <PasswordStrengthMeter password={passwordValue} />
        {fieldError('password') ? <p role="alert" className="text-xs text-destructive">{fieldError('password')}</p> : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Confirm password</Label>
        <PasswordInput id="confirmPassword" autoComplete="new-password" invalid={!!fieldError('confirmPassword')} disabled={isSubmitting} {...form.register('confirmPassword')} />
        {fieldError('confirmPassword') ? <p role="alert" className="text-xs text-destructive">{fieldError('confirmPassword')}</p> : null}
      </div>

      <Controller
        control={form.control}
        name="acceptTerms"
        render={({ field }) => (
          <div className="space-y-1">
            <div className="flex items-start gap-2">
              <Checkbox id="acceptTerms" checked={field.value} onCheckedChange={(checked) => field.onChange(checked === true)} disabled={isSubmitting} className="mt-0.5" />
              <Label htmlFor="acceptTerms" className="cursor-pointer font-normal leading-snug text-muted-foreground">
                I agree to the Terms of Service
              </Label>
            </div>
            {fieldError('acceptTerms') ? <p role="alert" className="text-xs text-destructive">{fieldError('acceptTerms')}</p> : null}
          </div>
        )}
      />

      <Controller
        control={form.control}
        name="acceptPrivacyPolicy"
        render={({ field }) => (
          <div className="space-y-1">
            <div className="flex items-start gap-2">
              <Checkbox id="acceptPrivacyPolicy" checked={field.value} onCheckedChange={(checked) => field.onChange(checked === true)} disabled={isSubmitting} className="mt-0.5" />
              <Label htmlFor="acceptPrivacyPolicy" className="cursor-pointer font-normal leading-snug text-muted-foreground">
                I agree to the Privacy Policy
              </Label>
            </div>
            {fieldError('acceptPrivacyPolicy') ? <p role="alert" className="text-xs text-destructive">{fieldError('acceptPrivacyPolicy')}</p> : null}
          </div>
        )}
      />

      <LoadingButton type="submit" className="w-full" loading={isSubmitting} loadingText="Creating your account…">
        Continue
      </LoadingButton>
    </form>
  );
}
