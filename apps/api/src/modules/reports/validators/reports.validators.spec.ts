import { describe, expect, it } from 'vitest';

import {
  createScheduledReportSchema,
  exportQuerySchema,
  reportFiltersQuerySchema,
  reportTypeParamSchema,
  trendQuerySchema,
  updateScheduledReportSchema,
} from './reports.validators';

describe('reports validators', () => {
  describe('reportFiltersQuerySchema', () => {
    it('applies defaults for an empty query', () => {
      const result = reportFiltersQuerySchema.parse({});
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    it('rejects a limit above the max page size', () => {
      expect(reportFiltersQuerySchema.safeParse({ limit: 500 }).success).toBe(false);
    });

    it('rejects a non-uuid branchId', () => {
      expect(reportFiltersQuerySchema.safeParse({ branchId: 'not-a-uuid' }).success).toBe(false);
    });

    it('accepts a fully populated filter set', () => {
      const result = reportFiltersQuerySchema.safeParse({
        dateFrom: '2026-01-01',
        dateTo: '2026-01-31',
        branchId: '11111111-1111-1111-1111-111111111111',
        planId: '11111111-1111-1111-1111-111111111111',
        trainerId: '11111111-1111-1111-1111-111111111111',
        paymentStatus: 'SUCCESS',
        memberStatus: 'ACTIVE',
        page: 2,
        limit: 50,
      });
      expect(result.success).toBe(true);
    });
  });

  describe('trendQuerySchema', () => {
    it('accepts an empty query (all optional)', () => {
      expect(trendQuerySchema.safeParse({}).success).toBe(true);
    });
  });

  describe('exportQuerySchema', () => {
    it('rejects a missing format', () => {
      expect(exportQuerySchema.safeParse({}).success).toBe(false);
    });

    it('rejects an unknown format', () => {
      expect(exportQuerySchema.safeParse({ format: 'docx' }).success).toBe(false);
    });

    it('accepts every supported format', () => {
      for (const format of ['csv', 'xlsx', 'pdf']) {
        expect(exportQuerySchema.safeParse({ format }).success).toBe(true);
      }
    });
  });

  describe('reportTypeParamSchema', () => {
    it('rejects an unknown report type', () => {
      expect(reportTypeParamSchema.safeParse({ reportType: 'not-a-real-report' }).success).toBe(false);
    });

    it('accepts a known report type', () => {
      expect(reportTypeParamSchema.safeParse({ reportType: 'membership' }).success).toBe(true);
      expect(reportTypeParamSchema.safeParse({ reportType: 'analytics-branch-comparison' }).success).toBe(true);
    });
  });

  describe('createScheduledReportSchema', () => {
    const base = { name: 'Weekly revenue', reportType: 'revenue', frequency: 'WEEKLY', recipientEmails: ['owner@gym.com'] };

    it('accepts a minimal valid payload', () => {
      expect(createScheduledReportSchema.safeParse(base).success).toBe(true);
    });

    it('rejects an empty recipient list', () => {
      expect(createScheduledReportSchema.safeParse({ ...base, recipientEmails: [] }).success).toBe(false);
    });

    it('rejects an invalid email in the recipient list', () => {
      expect(createScheduledReportSchema.safeParse({ ...base, recipientEmails: ['not-an-email'] }).success).toBe(false);
    });

    it('rejects an unknown frequency', () => {
      expect(createScheduledReportSchema.safeParse({ ...base, frequency: 'HOURLY' }).success).toBe(false);
    });

    it('rejects an unknown reportType', () => {
      expect(createScheduledReportSchema.safeParse({ ...base, reportType: 'not-a-real-report' }).success).toBe(false);
    });
  });

  describe('updateScheduledReportSchema', () => {
    it('rejects an empty body (nothing to update)', () => {
      expect(updateScheduledReportSchema.safeParse({}).success).toBe(false);
    });

    it('allows explicit null to clear branchId', () => {
      expect(updateScheduledReportSchema.safeParse({ branchId: null }).success).toBe(true);
    });

    it('accepts a single-field partial update', () => {
      expect(updateScheduledReportSchema.safeParse({ isActive: false }).success).toBe(true);
    });
  });
});
