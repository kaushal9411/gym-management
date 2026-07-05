'use client';

import * as React from 'react';

import { bootstrapFinished, signedOut } from '@/features/auth/store/auth-slice';
import { refreshAccessToken } from '@/features/auth/services/refresh-coordinator';
import { useAppDispatch, useAppSelector } from '@/store/hooks';

/**
 * Runs once per app load, after redux-persist has rehydrated the store
 * (PersistGate guarantees that ordering — see app-providers.tsx). If a
 * persisted refresh token exists, attempts one silent refresh to obtain a
 * fresh access token; either way, flips `bootstrapping` off so
 * `<RequireAuth>` guards can make their redirect decision.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const dispatch = useAppDispatch();
  const refreshToken = useAppSelector((state) => state.auth.refreshToken);
  const ranRef = React.useRef(false);

  React.useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    if (!refreshToken) {
      dispatch(bootstrapFinished());
      return;
    }

    refreshAccessToken()
      .then((refreshed) => {
        if (!refreshed) dispatch(signedOut());
      })
      .finally(() => dispatch(bootstrapFinished()));
    // Deliberately runs once on mount only — refreshToken is read from the
    // initial rehydrated state, not re-triggered on every token rotation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <>{children}</>;
}
