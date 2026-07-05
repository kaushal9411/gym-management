'use client';

import * as React from 'react';

import { WIZARD_STORAGE_KEY } from '../constants';
import type { BillingCycle, SubscriptionPlan, WizardState, WizardStep } from '../types';

const INITIAL_STATE: WizardState = {
  step: 'account',
  sessionId: null,
  maskedEmail: null,
  gymName: null,
  planSlug: null,
  billingCycle: null,
  selectedPlan: null,
  subdomain: null,
};

type Action =
  | { type: 'REGISTERED'; sessionId: string; maskedEmail: string; gymName: string }
  | { type: 'OTP_VERIFIED' }
  | { type: 'PLAN_SELECTED'; plan: SubscriptionPlan; billingCycle: BillingCycle }
  | { type: 'SUBDOMAIN_CHOSEN'; subdomain: string }
  | { type: 'PAYMENT_DONE' }
  | { type: 'GO_TO'; step: WizardStep }
  | { type: 'RESET' };

function reducer(state: WizardState, action: Action): WizardState {
  switch (action.type) {
    case 'REGISTERED':
      return {
        ...state,
        step: 'otp',
        sessionId: action.sessionId,
        maskedEmail: action.maskedEmail,
        gymName: action.gymName,
      };
    case 'OTP_VERIFIED':
      return { ...state, step: 'plan' };
    case 'PLAN_SELECTED':
      return {
        ...state,
        step: 'subdomain',
        planSlug: action.plan.slug,
        selectedPlan: action.plan,
        billingCycle: action.billingCycle,
      };
    case 'SUBDOMAIN_CHOSEN':
      return { ...state, step: 'payment', subdomain: action.subdomain };
    case 'PAYMENT_DONE':
      return { ...state, step: 'success' };
    case 'GO_TO':
      return { ...state, step: action.step };
    case 'RESET':
      return INITIAL_STATE;
    default:
      return state;
  }
}

interface WizardContextValue {
  state: WizardState;
  dispatch: React.Dispatch<Action>;
}

const WizardContext = React.createContext<WizardContextValue | null>(null);

function loadPersisted(): WizardState {
  if (typeof window === 'undefined') return INITIAL_STATE;
  try {
    const raw = window.sessionStorage.getItem(WIZARD_STORAGE_KEY);
    if (!raw) return INITIAL_STATE;
    return { ...INITIAL_STATE, ...(JSON.parse(raw) as Partial<WizardState>) };
  } catch {
    return INITIAL_STATE;
  }
}

/**
 * Local (non-Redux) wizard state, scoped to the registration flow only.
 * Persisted to sessionStorage — not localStorage/redux-persist — since this
 * is throwaway multi-step progress, not an authenticated session; it should
 * not survive across browser restarts or leak into the global auth store.
 * The Redis-backed session on the backend remains the actual source of
 * truth for wizard data (see onboarding-session.service.ts); this only
 * remembers which step to resume on a refresh.
 */
export function OnboardingWizardProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = React.useReducer(reducer, INITIAL_STATE, loadPersisted);

  React.useEffect(() => {
    try {
      window.sessionStorage.setItem(WIZARD_STORAGE_KEY, JSON.stringify(state));
    } catch {
      // sessionStorage unavailable (private mode, quota) — wizard still works, just won't survive a refresh.
    }
  }, [state]);

  const value = React.useMemo(() => ({ state, dispatch }), [state]);

  return <WizardContext.Provider value={value}>{children}</WizardContext.Provider>;
}

export function useOnboardingWizard(): WizardContextValue {
  const ctx = React.useContext(WizardContext);
  if (!ctx) throw new Error('useOnboardingWizard must be used within <OnboardingWizardProvider>');
  return ctx;
}
