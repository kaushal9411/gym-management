import { z } from 'zod';

/** One Web Vitals metric per Next.js `useReportWebVitals` callback invocation — see `next/web-vitals`'s `Metric` type. */
export const reportWebVitalSchema = z.object({
  app: z.enum(['tenant-web', 'super-admin']),
  name: z.enum(['CLS', 'FCP', 'FID', 'INP', 'LCP', 'TTFB']),
  id: z.string().min(1).max(100),
  value: z.number().finite(),
  rating: z.enum(['good', 'needs-improvement', 'poor']).optional(),
  navigationType: z.string().max(50).optional(),
  path: z.string().max(500),
});

export type ReportWebVitalInput = z.infer<typeof reportWebVitalSchema>;
