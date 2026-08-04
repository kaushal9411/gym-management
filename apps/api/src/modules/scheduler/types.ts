import type { JobCategory, JobTriggerType } from '@prisma/client';

export type { JobTriggerType };

/** Passed to every job handler at execution time — the shared context the engine wraps each run with. */
export interface JobExecutionContext {
  trigger: JobTriggerType;
  triggeredBy?: string;
}

/** A handler returns a small JSON-serializable summary (persisted as `JobExecution.result`) or nothing. */
export type JobHandler = (ctx: JobExecutionContext) => Promise<Record<string, unknown> | void>;

export interface JobDefinition {
  name: string;
  category: JobCategory;
  description: string;
  /** Standard 5-field cron expression, interpreted in `timezone`. */
  cronPattern: string;
  timezone: string;
  priority: number;
  maxRetries: number;
  retryDelayMs: number;
  timeoutMs: number;
  handler: JobHandler;
}
