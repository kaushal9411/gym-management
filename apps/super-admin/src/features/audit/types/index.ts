export interface AuditLogEntry {
  id: string;
  adminUserId: string | null;
  actorRole: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  createdAt: string;
  adminUser: { name: string; email: string } | null;
}

export interface PaginatedResult<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
