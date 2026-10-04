import type { Metadata } from 'next';
import { IBM_Plex_Mono, IBM_Plex_Sans } from 'next/font/google';

import { WebVitalsReporter } from '@/components/web-vitals-reporter';
import { AppProviders } from '@/providers/app-providers';

import './globals.css';

/** Self-hosted by next/font (CSP `font-src 'self'` safe). */
const plexSans = IBM_Plex_Sans({ subsets: ['latin'], weight: ['400', '500', '600', '700'], display: 'swap', variable: '--font-plex-sans', fallback: ['system-ui', 'Segoe UI', 'Arial', 'sans-serif'] });
const plexMono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500'], display: 'swap', variable: '--font-plex-mono', fallback: ['ui-monospace', 'Menlo', 'Consolas', 'monospace'] });

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
    <html lang="en" suppressHydrationWarning className={`${plexSans.variable} ${plexMono.variable}`}>
      <body suppressHydrationWarning>
        <WebVitalsReporter />
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
