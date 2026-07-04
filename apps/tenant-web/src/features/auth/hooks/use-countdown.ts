'use client';

import * as React from 'react';

/**
 * Countdown timer for OTP resend cooldowns. Restartable; ticks once per
 * second; cleans up on unmount.
 */
export function useCountdown(initialSeconds: number) {
  const [secondsLeft, setSecondsLeft] = React.useState(initialSeconds);

  React.useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setInterval(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearInterval(timer);
  }, [secondsLeft > 0]); // eslint-disable-line react-hooks/exhaustive-deps -- restart only on active-edge

  const restart = React.useCallback((seconds?: number) => {
    setSecondsLeft(seconds ?? initialSeconds);
  }, [initialSeconds]);

  return {
    secondsLeft,
    isRunning: secondsLeft > 0,
    restart,
    /** mm:ss for display. */
    formatted: `${String(Math.floor(secondsLeft / 60)).padStart(2, '0')}:${String(secondsLeft % 60).padStart(2, '0')}`,
  };
}
