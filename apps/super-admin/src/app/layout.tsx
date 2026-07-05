import type { Metadata } from 'next';

import { AppProviders } from '@/providers/app-providers';

import './globals.css';

export const metadata: Metadata = {
  title: { default: 'FitCloud Admin', template: '%s · FitCloud Admin' },
  description: 'FitCloud Super Admin portal — internal use only.',
};

/**
 * Root layout for the Super Admin portal (`admin.fitcloud.com`) — no
 * per-tenant branding injection here (unlike tenant-web's RootLayout):
 * this app serves exactly one internal organization, not thousands of gyms.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
