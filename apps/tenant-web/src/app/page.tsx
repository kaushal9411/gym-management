import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { AUTH_ROUTES } from '@/features/auth/constants';
import { HomePage } from '@/features/marketing/components/home-page';
import { resolveTenant } from '@/features/tenant/resolve';

export async function generateMetadata(): Promise<Metadata> {
  const tenant = await resolveTenant(null);
  const name = tenant.platformName;
  return {
    title: { absolute: `${name} | Gym management software` },
    description: `${name} runs your gym: members, attendance, classes, workouts, invoices and online payments, with apps for owners, trainers and members.`,
  };
}

/**
 * The root of the site.
 *
 * - On the bare domain (or plain localhost) this is the public home page, with Login and Register
 *   buttons. Nothing redirects by itself.
 * - On a gym's own address (goldgym.example.com) there is no marketing to show: members and staff
 *   land straight on that gym's login.
 */
export default async function RootPage() {
  const headerList = await headers();
  if (headerList.get('x-tenant-host')) redirect(AUTH_ROUTES.login);

  const tenant = await resolveTenant(null);
  return <HomePage name={tenant.platformName} />;
}
