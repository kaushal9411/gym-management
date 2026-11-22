/**
 * Tiny window-event bridge between the axios client (non-React) and `<TenantFlagsRefresher>`:
 * the API answers 403 "This module is currently unavailable." for a gated module, which means
 * the tenant's feature flags changed since the page was loaded and need re-resolving.
 */
export const MODULE_UNAVAILABLE_EVENT = 'fitcloud:module-unavailable';
export const MODULE_UNAVAILABLE_MESSAGE = 'This module is currently unavailable.';

export function signalModuleUnavailable(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(MODULE_UNAVAILABLE_EVENT));
}
