import type { Logger } from 'winston';

import { createApp } from './app';
import { env } from './config/env';
import { container } from './core/container';
import { logger } from './core/logging/logger';
import { disconnectRedis } from './infrastructure/cache/redis';
import { disconnectPrisma } from './infrastructure/database/prisma';
import { emailQueue } from './infrastructure/queue/email.queue';
import { startEmailWorker, stopEmailWorker } from './infrastructure/queue/email.worker';
import { initSocketServer } from './infrastructure/realtime/socket-server';
import { registerAuthEmailListeners } from './modules/authentication/events/auth-email.listeners';
import { registerOnboardingEmailListeners } from './modules/onboarding/events/onboarding-email.listeners';
import { registerBillingEmailListeners } from './modules/subscription/events/billing-email.listeners';
import {
  startSubscriptionBillingJobs,
  stopSubscriptionBillingJobs,
} from './modules/subscription/jobs/subscription-billing.jobs';

async function bootstrap(): Promise<void> {
  registerAuthEmailListeners();
  registerOnboardingEmailListeners();
  registerBillingEmailListeners();
  startEmailWorker();
  await startSubscriptionBillingJobs();

  const app = createApp();
  // Resolved through the DI container to prove it's wired, not just declared.
  const bootLogger = container.resolve<Logger>('logger');
  const server = app.listen(env.port, () => {
    bootLogger.info(`@gym-saas/api listening on :${env.port}`, {
      env: env.nodeEnv,
      docs: `http://localhost:${env.port}/api/docs`,
    });
  });
  initSocketServer(server);

  const shutdown = async (signal: string): Promise<void> => {
    logger.info(`${signal} received — shutting down gracefully`);
    server.close(async () => {
      await stopEmailWorker();
      await stopSubscriptionBillingJobs();
      await emailQueue.close();
      await disconnectPrisma();
      await disconnectRedis();
      logger.info('Shutdown complete');
      process.exit(0);
    });

    // Force-exit if graceful shutdown hangs.
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

bootstrap().catch((error) => {
  logger.error('Fatal error during bootstrap', { error: (error as Error).message, stack: (error as Error).stack });
  process.exit(1);
});
