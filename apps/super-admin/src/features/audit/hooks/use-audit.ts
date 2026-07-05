'use client';

import { useQuery } from '@tanstack/react-query';

import { adminAuditService } from '../services/audit.service';

export function useAuditLogs(params: { action?: string; page: number; limit: number }) {
  return useQuery({ queryKey: ['admin', 'audit-logs', params], queryFn: () => adminAuditService.list(params) });
}
