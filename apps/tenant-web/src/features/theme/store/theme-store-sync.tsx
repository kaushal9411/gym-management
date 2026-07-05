'use client';

import * as React from 'react';
import { useTheme } from 'next-themes';

import { useAppDispatch } from '@/store/hooks';
import { themePreferenceSynced, type ThemePreference } from './theme-slice';

/** Mirrors next-themes' current preference into Redux for non-component consumers. */
export function ThemeStoreSync() {
  const dispatch = useAppDispatch();
  const { theme } = useTheme();

  React.useEffect(() => {
    dispatch(themePreferenceSynced((theme as ThemePreference | undefined) ?? 'system'));
  }, [dispatch, theme]);

  return null;
}
