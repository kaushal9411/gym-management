import type { Logger } from 'winston';

import { createApp } from './app';
import { env } from './config/env';
import { container } from './core/container';
import { logger } from './core/logging/logger';
import { captureError, initSentry } from './core/observability/sentry';
import { disconnectRedis } from './infrastructure/cache/redis';
import { disconnectPrisma } from './infrastructure/database/prisma';
import { emailQueue } from './infrastructure/queue/email.queue';
import { startEmailWorker, stopEmailWorker } from './infrastructure/queue/email.worker';
import { initSocketServer } from './infrastructure/realtime/socket-server';
import { registerAuthEmailListeners } from './modules/authentication/events/auth-email.listeners';
import { registerInvitationEmailListeners } from './modules/invitations/events/invitation-email.listeners';
import { registerOnboardingEmailListeners } from './modules/onboarding/events/onboarding-email.listeners';
import { initScheduler, stopScheduler } from './modules/scheduler/services/scheduler-engine.service';
import { registerStaffEmailListeners } from './modules/staff/events/staff-email.listeners';
import { registerBillingEmailListeners } from './modules/subscription/events/billing-email.listeners';

initSentry();

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', { message: (reason as Error)?.message, stack: (reason as Error)?.stack });
  captureError(reason);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', { message: error.message, stack: error.stack });
  captureError(error);
  // The process is in an undefined state past this point (Node's own
  // guidance) — exit rather than keep serving requests on a corrupted heap;
  // the process manager (pm2/systemd/k8s) is responsible for restarting it.
  process.exit(1);
});

async function bootstrap(): Promise<void> {
  registerAuthEmailListeners();
  registerOnboardingEmailListeners();
  registerBillingEmailListeners();
  registerInvitationEmailListeners();
  registerStaffEmailListeners();
  startEmailWorker();
  await initScheduler();

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
      await stopScheduler();
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
