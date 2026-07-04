import { redirect } from 'next/navigation';

import { AUTH_ROUTES } from '@/features/auth/constants';

/** The portal root routes to login until the dashboard phase lands. */
export default function RootPage() {
  redirect(AUTH_ROUTES.login);
}
