'use client';

import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';

import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { adminAuthService } from '../services/auth.service';
import { signedOut } from '../store/auth-slice';

export function useLogout() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const refreshToken = useAppSelector((state) => state.auth.refreshToken);

  const mutation = useMutation({
    mutationFn: () => adminAuthService.logout(refreshToken),
    onSettled: () => {
      dispatch(signedOut());
      router.push('/login');
    },
  });

  return { logout: mutation.mutate, isLoggingOut: mutation.isPending };
}
