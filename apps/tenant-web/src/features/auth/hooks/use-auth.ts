'use client';

import { useMutation, useQuery } from '@tanstack/react-query';

import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { authService } from '../services/auth.service';
import {
  authFailed,
  authStarted,
  otpChallengeIssued,
  selectIsAuthenticated,
  sessionEstablished,
} from '../store/auth-slice';
import { AuthServiceError, type LoginPayload, type VerifyOtpPayload } from '../types';

/** Narrow unknown errors into the typed catalog for consistent UX mapping. */
export function toAuthError(error: unknown): AuthServiceError {
  if (error instanceof AuthServiceError) return error;
  return new AuthServiceError('UNKNOWN', 'Something went wrong. Please try again.');
}

export function useLogin() {
  const dispatch = useAppDispatch();
  return useMutation({
    mutationFn: (payload: LoginPayload) => authService.login(payload),
    onMutate: () => dispatch(authStarted()),
    onSuccess: (result) => {
      if (result.kind === 'success') {
        dispatch(sessionEstablished({ user: result.user, permissions: result.permissions, tokens: result.tokens }));
      } else {
        dispatch(otpChallengeIssued({ email: result.email, flow: result.flow }));
      }
    },
    onError: (error) => {
      const { code, message } = toAuthError(error);
      dispatch(authFailed({ code, message }));
    },
  });
}

export function useRegisterGym() {
  return useMutation({ mutationFn: authService.registerGym.bind(authService) });
}

export function useForgotPassword() {
  return useMutation({ mutationFn: authService.requestPasswordReset.bind(authService) });
}

export function useResetPassword() {
  return useMutation({ mutationFn: authService.resetPassword.bind(authService) });
}

export function useChangePassword() {
  return useMutation({ mutationFn: authService.changePassword.bind(authService) });
}

export function useVerifyEmail(token: string) {
  return useQuery({
    queryKey: ['auth', 'verify-email', token],
    queryFn: () => authService.verifyEmail(token),
    enabled: token.length > 0,
    retry: false,
    staleTime: Infinity,
  });
}

export function useResendVerification() {
  return useMutation({ mutationFn: authService.resendVerificationEmail.bind(authService) });
}

export function useVerifyOtp() {
  const dispatch = useAppDispatch();
  return useMutation({
    mutationFn: (payload: VerifyOtpPayload) => authService.verifyOtp(payload),
    onMutate: () => dispatch(authStarted()),
    onSuccess: (session) => dispatch(sessionEstablished(session)),
    onError: (error) => {
      const { code, message } = toAuthError(error);
      dispatch(authFailed({ code, message }));
    },
  });
}

export function useResendOtp() {
  return useMutation({ mutationFn: authService.resendOtp.bind(authService) });
}

export function useInvitation(token: string) {
  return useQuery({
    queryKey: ['auth', 'invitation', token],
    queryFn: () => authService.getInvitation(token),
    retry: false,
    staleTime: Infinity,
  });
}

export function useAcceptInvitation() {
  return useMutation({ mutationFn: authService.acceptInvitation.bind(authService) });
}

/**
 * Aggregate auth hook — the one most components should reach for. Combines
 * session state (Redux) with the login mutation so callers don't need to
 * wire both up themselves.
 */
export function useAuth() {
  const login = useLogin();
  const session = useAppSelector((state) => state.auth);
  const isAuthenticated = useAppSelector(selectIsAuthenticated);

  return {
    user: session.user,
    isAuthenticated,
    isBootstrapping: session.bootstrapping,
    status: session.status,
    error: session.error,
    login: login.mutate,
    loginAsync: login.mutateAsync,
    isLoggingIn: login.isPending,
  };
}
