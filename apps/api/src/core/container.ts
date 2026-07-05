import { asValue, createContainer, InjectionMode } from 'awilix';

import { redis, cache } from '../infrastructure/cache/redis';
import { mailer } from '../infrastructure/mail/mailer';
import { tenantService } from '../modules/tenants/service/tenant.service';

import { eventBus } from './events/event-bus';
import { logger } from './logging/logger';
import { jwtService } from './security/jwt.service';
import { passwordService } from './security/password.service';


/**
 * Composition root for the module's stateless, tenant-agnostic singletons
 * (constructor-injected everywhere they're consumed — see e.g.
 * password.service.ts's callers). Per-request, tenant-scoped repositories
 * and services are deliberately NOT registered here: they're built fresh
 * per request by authentication/utils/auth-module.factory.ts because each
 * one is bound to a Prisma client scoped to that request's tenant (see
 * infrastructure/database/tenant-scoped-client.ts) — an awilix singleton
 * would be wrong for anything tenant-bound. This container documents and
 * centralizes the other half: things that are correctly process-wide.
 */
export const container = createContainer({ injectionMode: InjectionMode.PROXY });

container.register({
  logger: asValue(logger),
  eventBus: asValue(eventBus),
  jwtService: asValue(jwtService),
  passwordService: asValue(passwordService),
  mailer: asValue(mailer),
  redis: asValue(redis),
  cache: asValue(cache),
  tenantService: asValue(tenantService),
});

export type AppContainer = typeof container;
