import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestContext {
  requestId: string;
  tenantId?: string;
  tenantSlug?: string;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
}

const storage = new AsyncLocalStorage<RequestContext>();

export function runWithRequestContext<T>(context: RequestContext, fn: () => T): T {
  return storage.run(context, fn);
}

export function getRequestContext(): RequestContext | undefined {
  return storage.getStore();
}

/** Mutates the active context in place (e.g. once tenant/user are resolved mid-pipeline). */
export function updateRequestContext(patch: Partial<RequestContext>): void {
  const current = storage.getStore();
  if (current) Object.assign(current, patch);
}
