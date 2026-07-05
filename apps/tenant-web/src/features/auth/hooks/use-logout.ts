'use client';

import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';

import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { authService } from '../services/auth.service';
import { signedOut } from '../store/auth-slice';
import { AUTH_ROUTES } from '../constants';

/** Logs out the current device only. */
export function useLogout() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const refreshToken = useAppSelector((state) => state.auth.refreshToken);

  const mutation = useMutation({
    mutationFn: () => authService.logoutCurrentDevice(refreshToken),
    onSettled: () => {
      // Always clear local session state, even if the network call failed —
      // the user asked to leave; don't strand them signed in on the client.
      dispatch(signedOut());
      router.push(AUTH_ROUTES.login);
    },
  });

  return { logout: mutation.mutate, isLoggingOut: mutation.isPending };
}

/** Revokes every session for this account, not just the current device. */
export function useLogoutAllDevices() {
  const dispatch = useAppDispatch();
  const router = useRouter();

  const mutation = useMutation({
    mutationFn: () => authService.logoutAllDevices(),
    onSettled: () => {
      dispatch(signedOut());
      router.push(AUTH_ROUTES.login);
    },
  });

  return { logoutAllDevices: mutation.mutate, isLoggingOut: mutation.isPending };
}
