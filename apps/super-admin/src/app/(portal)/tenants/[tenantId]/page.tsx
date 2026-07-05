'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  toTenantError,
  useActivateTenant,
  useDeleteTenant,
  useImpersonateTenant,
  useReactivateTenant,
  useResetOwnerPassword,
  useSuspendTenant,
  useTenant,
  useTenantAuditLogs,
} from '@/features/tenants/hooks/use-tenants';

export default function TenantDetailPage() {
  const params = useParams<{ tenantId: string }>();
  const router = useRouter();
  const { data: tenant, isLoading } = useTenant(params.tenantId);
  const { data: auditLogs } = useTenantAuditLogs(params.tenantId);

  const activate = useActivateTenant();
  const suspend = useSuspendTenant();
  const reactivate = useReactivateTenant();
  const remove = useDeleteTenant();
  const resetPassword = useResetOwnerPassword();
  const impersonate = useImpersonateTenant();

  if (isLoading || !tenant) return <Skeleton className="h-96 rounded-xl" />;

  const subscription = tenant.subscriptions[0];

  const handleImpersonate = () => {
    impersonate.mutate(params.tenantId, {
      onSuccess: (result) => {
        toast.success('Impersonation session created — opening portal…');
        // Reuses tenant-web's onboarding-complete token-handoff bridge (see
        // apps/tenant-web's OnboardingHandoff component) — `rt` is a
        // deliberate non-functional placeholder, not a real refresh token:
        // this session has no backing refresh_tokens row, so once the
        // 10-minute access token this API call issued expires, any refresh
        // attempt fails closed (TOKEN_INVALID → session-expired) instead of
        // silently extending an impersonation session.
        const fragment = new URLSearchParams({ at: result.accessToken, rt: 'impersonation-not-renewable', exp: result.expiresAt }).toString();
        window.open(`${result.portalUrl}/onboarding-complete#${fragment}`, '_blank');
      },
      onError: (err) => toast.error(toTenantError(err).message),
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{tenant.name}</h1>
          <p className="text-muted-foreground">{tenant.slug}.fitcloud.com · {tenant.status}</p>
        </div>
        <Button variant="outline" onClick={() => router.push('/tenants')}>Back to tenants</Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => activate.mutate(params.tenantId)} disabled={activate.isPending}>Activate</Button>
        <Button size="sm" variant="outline" onClick={() => suspend.mutate(params.tenantId)} disabled={suspend.isPending}>Suspend</Button>
        <Button size="sm" variant="outline" onClick={() => reactivate.mutate(params.tenantId)} disabled={reactivate.isPending}>Reactivate</Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            resetPassword.mutate(params.tenantId, {
              onSuccess: (r) => toast.success(`Password reset email sent to ${r.email}`),
              onError: (err) => toast.error(toTenantError(err).message),
            })
          }
          disabled={resetPassword.isPending}
        >
          Reset owner password
        </Button>
        <Button size="sm" variant="outline" onClick={handleImpersonate} disabled={impersonate.isPending}>
          Impersonate (10 min)
        </Button>
        <Button
          size="sm"
          variant="destructive"
          onClick={() => {
            if (!window.confirm(`Delete ${tenant.name}? This is a soft delete.`)) return;
            remove.mutate(params.tenantId, { onSuccess: () => router.push('/tenants') });
          }}
          disabled={remove.isPending}
        >
          Delete
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Subscription</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            {subscription ? (
              <>
                <div className="flex justify-between"><span className="text-muted-foreground">Plan</span><span>{subscription.plan.name}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Status</span><span>{subscription.status}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Billing cycle</span><span>{subscription.billingCycle}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Period ends</span><span>{subscription.currentPeriodEnd ? new Date(subscription.currentPeriodEnd).toLocaleDateString() : '—'}</span></div>
              </>
            ) : (
              <p className="text-muted-foreground">No subscription found.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Usage</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            {tenant.usage.length === 0 ? (
              <p className="text-muted-foreground">No usage data.</p>
            ) : (
              tenant.usage.map((u) => (
                <div key={u.metric} className="flex justify-between">
                  <span className="text-muted-foreground capitalize">{u.metric.replace('_', ' ')}</span>
                  <span>{u.value}{tenant.limits ? ` / ${tenant.limits[`max${u.metric.charAt(0).toUpperCase()}${u.metric.slice(1)}`] ?? '—'}` : ''}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Users</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            {tenant.users.map((u) => (
              <div key={u.id} className="flex justify-between">
                <span>{u.name} <span className="text-xs text-muted-foreground">({u.email})</span></span>
                <span className="text-xs text-muted-foreground">{u.status}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Recent audit log</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            {!auditLogs || (auditLogs as unknown[]).length === 0 ? (
              <p className="text-muted-foreground">No audit entries yet.</p>
            ) : (
              (auditLogs as Array<{ id: string; action: string; createdAt: string }>).slice(0, 10).map((log) => (
                <div key={log.id} className="flex justify-between gap-2">
                  <span className="truncate">{log.action}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{new Date(log.createdAt).toLocaleString()}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
