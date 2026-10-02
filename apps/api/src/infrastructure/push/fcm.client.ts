import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getMessaging, type Messaging, type MulticastMessage } from 'firebase-admin/messaging';

import { env } from '../../config/env';
import { logger } from '../../core/logging/logger';

export interface PushSendResult {
  /** Tokens that failed with a permanent "no longer registered" error — caller should delete these rows. */
  deadTokens: string[];
}

/**
 * Firebase Cloud Messaging sender — the mobile-push counterpart to
 * `infrastructure/mail`'s email transport. Distinct from (and unrelated to)
 * `infrastructure/push/pusher.client.ts`, a genuinely different, currently
 * unused Pusher Channels (websocket) stub — that's a different mechanism
 * (browser pub/sub) from native FCM push to a specific device token, left
 * untouched. Silently no-ops if `FIREBASE_SERVICE_ACCOUNT_JSON_BASE64` isn't
 * configured, same "never required to boot" pattern as every other optional
 * integration in this codebase.
 */
class FcmClient {
  private messaging: Messaging | null = null;

  constructor() {
    const serviceAccount = env.firebase.serviceAccountJson;
    if (!serviceAccount) return;

    try {
      const app: App = getApps()[0] ?? initializeApp({ credential: cert(serviceAccount as never) });
      this.messaging = getMessaging(app);
    } catch (err) {
      logger.error('Failed to initialize Firebase Admin SDK — push notifications will no-op', { err });
    }
  }

  get isConfigured(): boolean {
    return this.messaging !== null;
  }

  /**
   * Sends one notification to up to 500 tokens (FCM's own multicast cap —
   * callers batch beyond that, none of this codebase's fan-outs get close).
   * Returns the subset of tokens that are permanently dead
   * (unregistered/invalid) so the caller can prune them; any other
   * per-token failure (rate limit, transient) is logged and left alone —
   * on the next real event we'll just retry with the same token.
   */
  async sendToTokens(tokens: string[], payload: { title: string; body: string; data?: Record<string, string> }): Promise<PushSendResult> {
    if (!this.messaging || tokens.length === 0) return { deadTokens: [] };

    // Data-only, deliberately — no `notification` block. This app is
    // Android-only; with a `notification` block present, Android auto-
    // displays a tray entry only while backgrounded and shows nothing at
    // all while foreground, so a push was invisible whenever the app was
    // actually open (confirmed live: the native receiver fired every time,
    // nothing ever appeared). Sending data-only means the app's own
    // `PushNotificationService#showPushNotification` (`flutter_local_
    // notifications`, real channel, real sound) is the ONE path that ever
    // constructs a notification — foreground and background look
    // identical, and there's no risk of a double notification from Android
    // auto-displaying its own on top of ours.
    const message: MulticastMessage = {
      tokens,
      data: { title: payload.title, body: payload.body, ...payload.data },
      android: { priority: 'high' },
    };

    const response = await this.messaging.sendEachForMulticast(message);
    const deadTokens: string[] = [];
    response.responses.forEach((res, i) => {
      if (res.success) return;
      const code = res.error?.code;
      if (code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token') {
        deadTokens.push(tokens[i]!);
      } else {
        logger.warn('FCM send failed for a token (non-fatal, not pruned)', { code, message: res.error?.message });
      }
    });
    return { deadTokens };
  }
}

export const fcmClient = new FcmClient();
