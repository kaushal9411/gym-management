'use client';

import { useMutation } from '@tanstack/react-query';

import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { adminAuthService } from '../services/auth.service';
import { authFailed, authStarted, sessionEstablished, selectIsAuthenticated } from '../store/auth-slice';
import { AdminServiceError, type LoginPayload } from '../types';

export function toAdminError(error: unknown): AdminServiceError {
  if (error instanceof AdminServiceError) return error;
  return new AdminServiceError('UNKNOWN', 'Something went wrong. Please try again.');
}

export function useLogin() {
  const dispatch = useAppDispatch();
  return useMutation({
    mutationFn: (payload: LoginPayload) => adminAuthService.login(payload),
    onMutate: () => dispatch(authStarted()),
    onSuccess: (session) => dispatch(sessionEstablished(session)),
    onError: (error) => {
      const { code, message } = toAdminError(error);
      dispatch(authFailed({ code, message }));
    },
  });
}

export function useAuth() {
  const login = useLogin();
  const session = useAppSelector((state) => state.auth);
  const isAuthenticated = useAppSelector(selectIsAuthenticated);

  return {
    admin: session.admin,
    isAuthenticated,
    isBootstrapping: session.bootstrapping,
    status: session.status,
    error: session.error,
    login: login.mutate,
    loginAsync: login.mutateAsync,
    isLoggingIn: login.isPending,
  };
}

/** Coarse permission check — use in guards/components to hide actions the current admin can't perform. */
export function useHasPermission(permissionKey: string): boolean {
  const permissions = useAppSelector((state) => state.auth.admin?.permissions ?? []);
  return permissions.includes(permissionKey);
}
