import Pusher from 'pusher-js';

let pusher: Pusher | null = null;

/**
 * Structural only — no `NEXT_PUBLIC_PUSHER_KEY`/`NEXT_PUBLIC_PUSHER_CLUSTER`
 * are configured in this environment (the backend's own PUSHER_* env vars
 * are empty too — see apps/api/.env). Mirrors the same honest-stub pattern
 * already used for the sandboxed payment gateways and the no-op CAPTCHA
 * verifier: the wiring is real and ready, it simply has nothing to connect
 * to yet. Intended eventual use per Prompt 10: system notifications,
 * announcements, and subscription alerts as an alternative delivery path
 * to the Socket.IO connection above.
 */
export function connectPusher(): Pusher | null {
  const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
  const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;
  if (!key || !cluster) return null;

  pusher ??= new Pusher(key, { cluster });
  return pusher;
}

export function disconnectPusher(): void {
  pusher?.disconnect();
  pusher = null;
}

export function getPusher(): Pusher | null {
  return pusher;
}
