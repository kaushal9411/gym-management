'use client';

import * as React from 'react';
import { useTheme } from 'next-themes';

/**
 * The home page opens in the light theme for someone who has never picked one.
 * Anyone who has chosen a theme (here, on the login screen, or in the app) keeps their choice:
 * next-themes only writes its storage key once a theme has been set.
 */
export function HomeThemeDefault() {
  const { setTheme } = useTheme();
  React.useEffect(() => {
    try {
      if (window.localStorage.getItem('theme') === null) setTheme('light');
    } catch {
      // Storage blocked (private mode): fall back to the app's default, which follows the system.
    }
  }, [setTheme]);
  return null;
}
