'use client';

import * as React from 'react';

import { useAppSelector } from '@/store/hooks';
import { selectIsAuthenticated } from '../store/auth-slice';
import { useLogout } from './use-logout';

const IDLE_TIMEOUT_MS = 30 * 60_000; // 30 minutes of no interaction → auto-logout
const IDLE_WARNING_MS = 60_000; // show the "still there?" popup 60s before that
const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'touchstart', 'scroll'] as const;

/**
 * Idle-timeout + session-expiry tracking. Only runs its listeners while a
 * session actually exists — logged-out visitors on public pages pay
 * nothing for this.
 */
export function useSession() {
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const accessTokenExpiresAt = useAppSelector((state) => state.auth.accessTokenExpiresAt);
  const { logout } = useLogout();

  const [showIdleWarning, setShowIdleWarning] = React.useState(false);
  const lastActivityRef = React.useRef(Date.now());
  const warningTimerRef = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const logoutTimerRef = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const clearTimers = React.useCallback(() => {
    clearTimeout(warningTimerRef.current);
    clearTimeout(logoutTimerRef.current);
  }, []);

  const scheduleTimers = React.useCallback(() => {
    clearTimers();
    warningTimerRef.current = setTimeout(() => setShowIdleWarning(true), IDLE_TIMEOUT_MS - IDLE_WARNING_MS);
    logoutTimerRef.current = setTimeout(() => logout(), IDLE_TIMEOUT_MS);
  }, [clearTimers, logout]);

  /** Resets the idle clock — called by activity events and the "stay signed in" button. */
  const extendSession = React.useCallback(() => {
    lastActivityRef.current = Date.now();
    setShowIdleWarning(false);
    scheduleTimers();
  }, [scheduleTimers]);

  React.useEffect(() => {
    if (!isAuthenticated) {
      clearTimers();
      return;
    }

    scheduleTimers();
    const handleActivity = () => extendSession();
    ACTIVITY_EVENTS.forEach((event) => window.addEventListener(event, handleActivity, { passive: true }));

    return () => {
      clearTimers();
      ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, handleActivity));
    };
  }, [isAuthenticated, scheduleTimers, clearTimers, extendSession]);

  const accessTokenExpiresInMs = accessTokenExpiresAt
    ? new Date(accessTokenExpiresAt).getTime() - Date.now()
    : null;

  return { showIdleWarning, extendSession, accessTokenExpiresInMs };
}
