'use client';

import * as React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { Provider as ReduxProvider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { persistStore } from 'redux-persist';

import { SessionExpiryModal } from '@/components/session-expiry-modal';
import { Toaster } from '@/components/ui/sonner';
import { TopProgressBar } from '@/components/top-progress-bar';
import { RealtimeProvider } from '@/features/realtime/realtime-provider';
import { TenantProvider } from '@/features/tenant/tenant-provider';
import { TenantStoreSync } from '@/features/tenant/store/tenant-store-sync';
import type { Tenant } from '@/features/tenant/types';
import { ThemeStoreSync } from '@/features/theme/store/theme-store-sync';
import { makeStore, registerActiveStore, type AppStore } from '@/store';
import { AuthProvider } from './auth-provider';

/**
 * Client provider stack: Redux (+ persisted auth session) → TanStack Query
 * (server state) → next-themes → tenant context → auth bootstrap → app
 * chrome (progress bar, session-expiry popup, toasts).
 */
export function AppProviders({ tenant, children }: { tenant: Tenant; children: React.ReactNode }) {
  const storeRef = React.useRef<AppStore | null>(null);
  if (!storeRef.current) {
    storeRef.current = makeStore();
    registerActiveStore(storeRef.current);
  }
  const persistorRef = React.useRef<ReturnType<typeof persistStore> | null>(null);
  persistorRef.current ??= persistStore(storeRef.current);

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
      <PersistGate loading={null} persistor={persistorRef.current}>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
            <ThemeStoreSync />
            <TenantProvider tenant={tenant}>
              <TenantStoreSync tenant={tenant} />
              <AuthProvider>
                <RealtimeProvider>
                  <TopProgressBar />
                  {children}
                  <SessionExpiryModal />
                  <Toaster />
                </RealtimeProvider>
              </AuthProvider>
            </TenantProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </PersistGate>
    </ReduxProvider>
  );
}
