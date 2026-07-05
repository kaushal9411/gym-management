import PusherServer from 'pusher';

import { env } from '../../config/env';
import { logger } from '../../core/logging/logger';

/**
 * "Notification ready" per the platform tech stack — a working adapter
 * that the (future) notifications module will call. No auth-module event
 * currently triggers a push; this just proves the wiring so that module
 * doesn't start from zero. Silently no-ops if Pusher credentials aren't
 * configured (fine for local dev / this phase).
 */
class PusherClient {
  private client: PusherServer | null = null;

  constructor() {
    if (env.pusher.isConfigured) {
      this.client = new PusherServer({
        appId: env.pusher.appId!,
        key: env.pusher.key!,
        secret: env.pusher.secret!,
        cluster: env.pusher.cluster!,
        useTLS: true,
      });
    }
  }

  async trigger(channel: string, event: string, payload: Record<string, unknown>): Promise<void> {
    if (!this.client) {
      logger.debug('Pusher not configured — skipping trigger', { channel, event });
      return;
    }
    await this.client.trigger(channel, event, payload);
  }
}

export const pusherClient = new PusherClient();
