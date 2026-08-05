import { useMutation } from '@tanstack/react-query';

import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { memberAuthService } from '../services/member-auth.service';
import { memberAuthFailed, memberAuthStarted, memberSessionEstablished, memberSignedOut, selectIsMemberAuthenticated } from '../store/member-auth-slice';
import type { MemberAuthServiceError } from '../types';

export function useMemberAuth() {
  return {
    isAuthenticated: useAppSelector(selectIsMemberAuthenticated),
    isBootstrapping: useAppSelector((state) => state.memberAuth.bootstrapping),
    member: useAppSelector((state) => state.memberAuth.member),
  };
}

export function useMemberLogin() {
  const dispatch = useAppDispatch();
  return useMutation({
    mutationFn: async ({ memberId, password }: { memberId: string; password: string }) => {
      dispatch(memberAuthStarted());
      return memberAuthService.login(memberId, password);
    },
    onSuccess: ({ member, tokens }) => {
      dispatch(memberSessionEstablished({ member, tokens }));
    },
    onError: (error: MemberAuthServiceError) => {
      dispatch(memberAuthFailed({ code: error.code, message: error.message }));
    },
  });
}

export function useMemberLogout() {
  const dispatch = useAppDispatch();
  const refreshToken = useAppSelector((state) => state.memberAuth.refreshToken);
  return useMutation({
    mutationFn: async () => {
      if (refreshToken) await memberAuthService.logout(refreshToken);
    },
    onSettled: () => dispatch(memberSignedOut()),
  });
}
