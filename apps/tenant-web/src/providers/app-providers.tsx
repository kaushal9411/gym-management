'use client';

import * as React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { Provider as ReduxProvider } from 'react-redux';

import { Toaster } from '@/components/ui/sonner';
import { TenantProvider } from '@/features/tenant/tenant-provider';
import type { Tenant } from '@/features/tenant/types';
import { makeStore, type AppStore } from '@/store';

/**
 * Client provider stack: Redux (UI state) → TanStack Query (server state)
 * → next-themes (light/dark/system) → tenant context → toast host.
 */
export function AppProviders({ tenant, children }: { tenant: Tenant; children: React.ReactNode }) {
  const storeRef = React.useRef<AppStore | null>(null);
  storeRef.current ??= makeStore();

  const [queryClient] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
            refetchOnWindowFocus: false,
            staleTime: 30_000,
          },
          mutations: {
            retry: false,
          },
        },
      }),
  );

  return (
    <ReduxProvider store={storeRef.current}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <TenantProvider tenant={tenant}>
            {children}
            <Toaster />
          </TenantProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ReduxProvider>
  );
}
