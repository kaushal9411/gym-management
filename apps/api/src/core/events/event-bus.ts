import { EventEmitter } from 'node:events';

import { logger } from '../logging/logger';

/**
 * Lightweight in-process domain event bus. Decouples AuthService from
 * "what happens after" (send welcome email, write an audit log) without
 * requiring the full transactional-outbox infrastructure described in
 * docs/architecture/ARCHITECTURE.md §1 — that lands with the platform
 * provisioning phase once multiple services need durable, cross-process
 * fan-out. Handlers here must be side-effect-only and must not throw.
 */
class DomainEventBus extends EventEmitter {
  emitEvent<T extends object>(eventName: string, payload: T): void {
    this.emit(eventName, payload);
  }

  onEvent<T extends object>(eventName: string, handler: (payload: T) => Promise<void> | void): void {
    this.on(eventName, (payload: T) => {
      Promise.resolve(handler(payload)).catch((error) => {
        logger.error('Domain event handler failed', { event: eventName, error: (error as Error).message });
      });
    });
  }
}

export const eventBus = new DomainEventBus();
eventBus.setMaxListeners(50);

export const AuthEvents = {
  UserRegistered: 'auth.user_registered',
  EmailVerified: 'auth.email_verified',
  LoginSucceeded: 'auth.login_succeeded',
  LoginFailed: 'auth.login_failed',
  PasswordChanged: 'auth.password_changed',
  PasswordResetRequested: 'auth.password_reset_requested',
  AccountLocked: 'auth.account_locked',
} as const;
