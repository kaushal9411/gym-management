'use client';

import * as React from 'react';

import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { refreshMemberAccessToken } from '@/features/member-portal/services/member-refresh-coordinator';
import { memberBootstrapFinished, memberSignedOut } from '@/features/member-portal/store/member-auth-slice';

/** Mirrors `AuthProvider` (the staff plane's) — one silent refresh attempt on mount using the persisted `memberAuth` refresh token, then flips `bootstrapping` off so `<RequireMemberAuth>` can decide. */
export function MemberAuthProvider({ children }: { children: React.ReactNode }) {
  const dispatch = useAppDispatch();
  const refreshToken = useAppSelector((state) => state.memberAuth.refreshToken);
  const ranRef = React.useRef(false);

  React.useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    if (!refreshToken) {
      dispatch(memberBootstrapFinished());
      return;
    }

    refreshMemberAccessToken()
      .then((refreshed) => {
        if (!refreshed) dispatch(memberSignedOut());
      })
      .finally(() => dispatch(memberBootstrapFinished()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <>{children}</>;
}
