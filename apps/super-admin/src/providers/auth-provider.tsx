'use client';

import * as React from 'react';

import { bootstrapFinished, signedOut } from '@/features/auth/store/auth-slice';
import { refreshAdminAccessToken } from '@/features/auth/services/refresh-coordinator';
import { useAppDispatch, useAppSelector } from '@/store/hooks';

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

    refreshAdminAccessToken()
      .then((refreshed) => {
        if (!refreshed) dispatch(signedOut());
      })
      .finally(() => dispatch(bootstrapFinished()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <>{children}</>;
}
