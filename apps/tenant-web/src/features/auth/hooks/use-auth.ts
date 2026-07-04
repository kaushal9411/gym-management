'use client';

import { useMutation, useQuery } from '@tanstack/react-query';

import { useAppDispatch } from '@/store/hooks';
import { authService } from '../services/auth.service';
import {
  authFailed,
  authStarted,
  authSucceeded,
  otpChallengeIssued,
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
        dispatch(authSucceeded(result.user));
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
    onSuccess: ({ user }) => dispatch(authSucceeded(user)),
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
