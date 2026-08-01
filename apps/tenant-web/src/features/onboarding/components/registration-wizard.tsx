'use client';

import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';

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
      <style>{`
        /* Re-scopes every shared component's theme tokens (Input/Label/Card/
           Checkbox/Alert/etc. all read these) to fixed dark-neon values —
           this one block is what makes every step's fields render correctly
           dark without touching each step file's markup. Kept local to this
           wrapper, not global, so no other page is affected. */
        .onboarding-dark-scope {
          /* Belt-and-suspenders: Input/select/textarea never set an explicit
             text color, they just inherit — and they inherit from <body>'s
             REAL (unscoped) theme, not this override, since nothing between
             body and them re-reads var(--foreground). Set color directly so
             every form control is legible regardless of the site's actual
             light/dark theme. */
          color: #ffffff;
          --background: #0d0d12;
          --foreground: #ffffff;
          --card: rgba(255,255,255,0.04);
          --card-foreground: #ffffff;
          --popover: #18181f;
          --popover-foreground: #ffffff;
          --muted: rgba(255,255,255,0.06);
          --muted-foreground: rgba(255,255,255,0.5);
          --accent: rgba(255,255,255,0.08);
          --accent-foreground: #ffffff;
          --secondary: rgba(255,255,255,0.08);
          --secondary-foreground: #ffffff;
          --border: rgba(255,255,255,0.12);
          --input: rgba(255,255,255,0.12);
          --ring: #ff8a3d;
          --destructive: oklch(0.65 0.22 27.3);
          --destructive-foreground: oklch(0.985 0 0);
          --success: oklch(0.66 0.15 150);
          --success-foreground: oklch(0.14 0.03 150);
          --warning: oklch(0.78 0.14 75);
          --warning-foreground: oklch(0.2 0.05 75);
        }
        .onboarding-glass-card { background: linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.03) 100%); }
        .onboarding-gradient-bar { background-image: linear-gradient(90deg, #ff8a3d 0%, #ff5a1f 45%, #22d3ee 100%); }
        .onboarding-cta {
          background-image: linear-gradient(135deg, #ff8a3d 0%, #ff5a1f 45%, #e0271b 100%);
          border: 0;
          color: #fff;
          box-shadow: 0 8px 24px -6px rgba(255, 90, 31, 0.55);
          transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s ease-out;
        }
        .onboarding-cta:hover { transform: translateY(-2px); box-shadow: 0 16px 36px -8px rgba(255, 90, 31, 0.7); }
        .onboarding-cta:active { transform: translateY(0) scale(0.98); }
      `}</style>

      <ProgressIndicator current={state.step} />

      <div className="space-y-1 text-center">
        <h1 className="text-2xl font-bold tracking-tight text-white">{copy.title}</h1>
        {copy.subtitle ? <p className="text-sm text-white/50">{copy.subtitle}</p> : null}
      </div>

      <div className="onboarding-dark-scope">
        {state.step === 'success' ? (
          // The success step renders its own card-shaped states (loading
          // checklist / StatusScreen) — an outer Card here would double up
          // as a nested card-in-card frame, so it renders unwrapped.
          <AnimatePresence mode="wait">
            <motion.div
              key={state.step}
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
            >
              <SuccessStep />
            </motion.div>
          </AnimatePresence>
        ) : (
          <div className="onboarding-glass-card overflow-hidden rounded-4xl border border-white/10 shadow-[0_0_60px_-15px_rgba(255,90,31,0.25),0_0_80px_-20px_rgba(34,211,238,0.15)] backdrop-blur-2xl">
            <div className="onboarding-gradient-bar h-1.5 w-full" aria-hidden />
            <div className="p-6 sm:p-8">
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
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        )}
      </div>

      {state.step === 'account' ? (
        <p className="text-center text-sm text-white/40">
          Already using FitCloud?{' '}
          <Link href={AUTH_ROUTES.login} className="font-medium text-cyan-300 underline-offset-4 hover:underline">
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
