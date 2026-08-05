/** Route table for the member self-service portal — all under `/portal/*`, a plain path prefix (tenant resolution is host-only, path-agnostic — no middleware changes needed for this to work). `login` deliberately points at the shared `/login` page (which auto-detects staff email vs. Member ID) — there is no separate `/portal/login` page anymore. */
export const MEMBER_PORTAL_ROUTES = {
  login: '/login',
  activate: (token: string) => `/portal/activate/${token}`,
  forgotPassword: '/portal/forgot-password',
  resetPassword: '/portal/reset-password',
  dashboard: '/portal/dashboard',
  attendance: '/portal/attendance',
  workout: '/portal/workout',
  diet: '/portal/diet',
  invoices: '/portal/invoices',
  classes: '/portal/classes',
} as const;
