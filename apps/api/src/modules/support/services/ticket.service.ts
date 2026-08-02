import { NotFoundError } from '../../../core/errors/app-error';
import { getTenantScopedClient, type TenantScopedPrisma } from '../../../infrastructure/database/tenant-scoped-client';
import { AuditLogRepository } from '../../authentication/repositories/audit-log.repository';
import { UserRepository as AuthUserRepository } from '../../authentication/repositories/user.repository';
import type { IamActor } from '../../authentication/utils/actor.util';
import { TicketRepository } from '../repositories/ticket.repository';
import type { CreateTicketInput, ListTicketsQuery } from '../validators/ticket.validators';

export class TicketService {
  private readonly db: TenantScopedPrisma;
  private readonly tickets: TicketRepository;
  private readonly auditLog: AuditLogRepository;
  private readonly authUsers: AuthUserRepository;

  constructor(private readonly tenantId: string) {
    this.db = getTenantScopedClient(tenantId);
    this.tickets = new TicketRepository(this.db);
    this.auditLog = new AuditLogRepository(this.db);
    this.authUsers = new AuthUserRepository(this.db);
  }

  async list(query: ListTicketsQuery) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const { total, items } = await this.tickets.list(this.tenantId, {
      status: query.status,
      skip: (page - 1) * limit,
      take: limit,
    });
    return { items, page, limit, total, totalPages: Math.ceil(total / limit) || 1 };
  }

  async getById(id: string) {
    const ticket = await this.tickets.findById(this.tenantId, id);
    if (!ticket) throw new NotFoundError('Support ticket not found.');
    return ticket;
  }

  async create(input: CreateTicketInput, actor: IamActor) {
    const actorUser = await this.authUsers.findById(this.tenantId, actor.userId);
    if (!actorUser) throw new NotFoundError('Actor user not found.');

    const ticket = await this.tickets.create({
      tenantId: this.tenantId,
      subject: input.subject,
      description: input.description,
      priority: input.priority,
      createdByEmail: actorUser.email,
      createdByName: actorUser.name,
    });

    await this.auditLog.record({
      tenantId: this.tenantId,
      actorUserId: actor.userId,
      actorRole: actor.role,
      action: 'support.ticket_created',
      entityType: 'SupportTicket',
      entityId: ticket.id,
    });

    return ticket;
  }
}
