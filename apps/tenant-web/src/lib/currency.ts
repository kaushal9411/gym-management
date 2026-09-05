'use client';

import { useBusinessSettings } from '@/features/gym-settings/hooks/use-gym-settings';

/**
 * The gym's own configured currency symbol (Settings → Regional & Display →
 * `BusinessSettings.currencySymbol`) — NOT the platform's own SaaS-billing
 * currency (see `features/billing/`, a separate concern). Defaults to ₹
 * while the settings query is still loading, same convention the backend's
 * invoice renderers already use (see BACKEND-GUIDE.md's currency-symbol fix).
 */
export function useCurrencySymbol(): string {
  const { data } = useBusinessSettings();
  return data?.currencySymbol ?? '₹';
}
