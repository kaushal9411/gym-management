'use client';

import * as React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { Provider as ReduxProvider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { persistStore } from 'redux-persist';

import { Toaster } from '@/components/ui/sonner';
import { makeStore, registerActiveStore, type AppStore } from '@/store';
import { AuthProvider } from './auth-provider';

export function AppProviders({ children }: { children: React.ReactNode }) {
  const storeRef = React.useRef<AppStore | null>(null);
  if (!storeRef.current) {
    storeRef.current = makeStore();
    registerActiveStore(storeRef.current);
  }
  const persistorRef = React.useRef<ReturnType<typeof persistStore> | null>(null);
  persistorRef.current ??= persistStore(storeRef.current);

  const [queryClient] = React.useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false, staleTime: 30_000 }, mutations: { retry: false } } }),
  );

  return (
    <ReduxProvider store={storeRef.current}>
      <PersistGate loading={null} persistor={persistorRef.current}>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
            <AuthProvider>
              {children}
              <Toaster />
            </AuthProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </PersistGate>
    </ReduxProvider>
  );
}
