'use client';

import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';

import { Card, CardContent } from '@/components/ui/card';
import { AUTH_ROUTES } from '@/features/auth/constants';
import { AccountDetailsStep } from './steps/account-details-step';
import { OtpStep } from './steps/otp-step';
import { PaymentStep } from './steps/payment-step';
import { PlanSelectionStep } from './steps/plan-selection-step';
import { SubdomainStep } from './steps/subdomain-step';
import { SuccessStep } from './steps/success-step';
import { ProgressIndicator } from './progress-indicator';
import { OnboardingWizardProvider, useOnboardingWizard } from '../store/onboarding-wizard-context';
import type { WizardStep } from '../types';

const STEP_COPY: Record<WizardStep, { title: string; subtitle: string }> = {
  account: { title: 'Create your gym on FitCloud', subtitle: '14-day free trial · no credit card required' },
  otp: { title: 'Verify your email', subtitle: 'One quick check before we set up your plan' },
  plan: { title: 'Choose your plan', subtitle: 'Switch or upgrade anytime from your dashboard' },
  subdomain: { title: 'Pick your portal address', subtitle: 'This is where your team will sign in' },
  payment: { title: 'Payment', subtitle: 'Sandboxed — no real charge is ever made in this environment' },
  success: { title: "You're all set!", subtitle: '' },
};

function WizardBody() {
  const { state } = useOnboardingWizard();
  const copy = STEP_COPY[state.step];

  return (
    <div className="w-full space-y-6">
      <ProgressIndicator current={state.step} />

      <div className="space-y-1 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">{copy.title}</h1>
        {copy.subtitle ? <p className="text-sm text-muted-foreground">{copy.subtitle}</p> : null}
      </div>

      <Card>
        <CardContent className="p-6 sm:p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={state.step}
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
            >
              {state.step === 'account' ? <AccountDetailsStep /> : null}
              {state.step === 'otp' ? <OtpStep /> : null}
              {state.step === 'plan' ? <PlanSelectionStep /> : null}
              {state.step === 'subdomain' ? <SubdomainStep /> : null}
              {state.step === 'payment' ? <PaymentStep /> : null}
              {state.step === 'success' ? <SuccessStep /> : null}
            </motion.div>
          </AnimatePresence>
        </CardContent>
      </Card>

      {state.step === 'account' ? (
        <p className="text-center text-sm text-muted-foreground">
          Already using FitCloud?{' '}
          <Link href={AUTH_ROUTES.login} className="font-medium text-primary underline-offset-4 hover:underline">
            Sign in
          </Link>
        </p>
      ) : null}
    </div>
  );
}

/** Entry point for the multi-step onboarding wizard (Prompt 7) — replaces the single-step registration form. */
export function RegistrationWizard() {
  return (
    <OnboardingWizardProvider>
      <WizardBody />
    </OnboardingWizardProvider>
  );
}
