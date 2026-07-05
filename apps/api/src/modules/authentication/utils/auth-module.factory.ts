import { getTenantScopedClient } from '../../../infrastructure/database/tenant-scoped-client';
import { mailer } from '../../../infrastructure/mail/mailer';
import { AuditLogRepository } from '../repositories/audit-log.repository';
import { LoginHistoryRepository } from '../repositories/login-history.repository';
import { RoleRepository } from '../repositories/role.repository';
import { SessionRepository } from '../repositories/session.repository';
import { UserRepository } from '../repositories/user.repository';
import { VerificationRepository } from '../repositories/verification.repository';
import { AuthService } from '../services/auth.service';

/**
 * Builds one tenant-bound instance of the authentication module's
 * repositories + service. Called once per request (after the tenant is
 * resolved) rather than registered as global singletons, because every
 * repository is constructed with a Prisma client already scoped — via
 * `SET LOCAL app.tenant_id` + RLS — to that ONE tenant (see
 * infrastructure/database/tenant-scoped-client.ts). This is what makes it
 * structurally impossible for a request to read another tenant's rows.
 */
export function buildAuthModule(tenantId: string): AuthService {
  const db = getTenantScopedClient(tenantId);

  return new AuthService({
    tenantId,
    userRepository: new UserRepository(db),
    roleRepository: new RoleRepository(db),
    sessionRepository: new SessionRepository(db),
    verificationRepository: new VerificationRepository(db),
    loginHistoryRepository: new LoginHistoryRepository(db),
    auditLogRepository: new AuditLogRepository(db),
    sendEmail: (to, subject, html) => mailer.send({ to, subject, html }),
  });
}
