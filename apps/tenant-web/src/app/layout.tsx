import type { Metadata } from 'next';
import { headers } from 'next/headers';

import { AppProviders } from '@/providers/app-providers';
import { resolveTenant } from '@/features/tenant/resolve';

import './globals.css';

export async function generateMetadata(): Promise<Metadata> {
  const headerList = await headers();
  const tenant = resolveTenant(headerList.get('x-tenant-slug'));
  return {
    title: {
      default: tenant.id === 'platform' ? 'FitCloud' : `${tenant.name} · FitCloud`,
      template: `%s · ${tenant.name}`,
    },
    description: `${tenant.name} member and staff portal, powered by FitCloud.`,
  };
}

/**
 * Root layout — resolves the tenant ONCE per request from the middleware
 * header and injects branding as CSS variables on <body>, so the correct
 * brand color paints on first byte (no flash, no client fetch).
 */
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const headerList = await headers();
  const tenant = resolveTenant(headerList.get('x-tenant-slug'));

  return (
    <html lang="en" suppressHydrationWarning>
      <body
        style={
          {
            '--primary': tenant.branding.primaryColor,
            '--primary-foreground': tenant.branding.primaryForeground,
            '--ring': tenant.branding.primaryColor,
          } as React.CSSProperties
        }
      >
        <AppProviders tenant={tenant}>{children}</AppProviders>
      </body>
    </html>
  );
}
