'use client';

import * as React from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { unreadCountIncremented } from '@/features/notifications/store/notification-slice';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { connectPusher, disconnectPusher } from './pusher-client';
import { connectSocket, disconnectSocket } from './socket-client';

/**
 * Connects Socket.IO (and, if configured, Pusher) once the session is
 * established — part of the app-initialization sequence's last two steps
 * ("Connect Socket.IO" / "Connect Pusher") before the app is considered
 * fully booted. Reconnects automatically if the access token rotates
 * (silent refresh), since the server-side handshake re-verifies it.
 */
export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  const accessToken = useAppSelector((state) => state.auth.accessToken);
  const isAuthenticated = useAppSelector((state) => state.auth.user !== null);

  React.useEffect(() => {
    if (!isAuthenticated || !accessToken) return;

    const socket = connectSocket(accessToken);
    const pusher = connectPusher();

    const handleNewNotification = () => {
      dispatch(unreadCountIncremented());
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
    };
    socket.on('notification:new', handleNewNotification);

    const handleAttendanceEvent = () => {
      void queryClient.invalidateQueries({ queryKey: ['attendance'] });
    };
    socket.on('attendance:checkin', handleAttendanceEvent);
    socket.on('attendance:checkout', handleAttendanceEvent);

    return () => {
      socket.off('notification:new', handleNewNotification);
      socket.off('attendance:checkin', handleAttendanceEvent);
      socket.off('attendance:checkout', handleAttendanceEvent);
    };
    // Pusher is left connected across renders (see connectPusher's own
    // singleton); only Socket.IO's per-render listener is cleaned up here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, accessToken]);

  React.useEffect(() => {
    if (!isAuthenticated) {
      disconnectSocket();
      disconnectPusher();
    }
  }, [isAuthenticated]);

  return <>{children}</>;
}
