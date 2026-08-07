'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Building2, Copy, Globe, Mail, MapPin, Phone } from 'lucide-react';
import { toast } from 'sonner';

import { DataTable, type DataTableColumn } from '@/components/data-table';
import { notifyProgrammaticNavigation } from '@/components/navigation-progress-provider';
import { Pagination } from '@/components/pagination';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { StatisticCard } from '@/components/ui/statistic-card';
import { useHasPermission } from '@/features/auth/hooks/use-auth';
import { toBillingError, useCreatePaymentLink, useDownloadInvoicePdf, useEmailInvoice, useResendNotification, useVerifyPaymentStatus } from '@/features/billing/hooks/use-billing';
import type { InvoiceListItem, PaymentListItem } from '@/features/payments/types';
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
  useTenantInvoices,
  useTenantPayments,
} from '@/features/tenants/hooks/use-tenants';
import type { TenantDetail } from '@/features/tenants/types';

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'destructive' | 'outline'> = {
  SUCCEEDED: 'success',
  PAID: 'success',
  ACTIVE: 'success',
  PENDING: 'warning',
  OPEN: 'warning',
  TRIALING: 'warning',
  PAST_DUE: 'warning',
  GRACE: 'warning',
  FAILED: 'destructive',
  SUSPENDED: 'destructive',
  CANCELED: 'outline',
  CANCELLED: 'outline',
  EXPIRED: 'outline',
  VOID: 'outline',
};

function StatusBadge({ status }: { status: string }) {
  return <Badge variant={STATUS_VARIANT[status] ?? 'secondary'}>{status.replace('_', ' ')}</Badge>;
}

function formatMoney(amount: string, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(Number(amount));
  } catch {
    return `${currency} ${amount}`;
  }
}

const USAGE_LABELS: Record<string, string> = {
  branches: 'Branches',
  managers: 'Managers',
  trainers: 'Trainers',
  receptionists: 'Receptionists',
  staff: 'Staff',
  members: 'Members',
  storage_mb: 'Storage (MB)',
};

/** `TenantUsage.metric` (snake_case) -> the matching `TenantLimit` field (camelCase). */
const USAGE_LIMIT_KEY: Record<string, string> = {
  branches: 'maxBranches',
  managers: 'maxManagers',
  trainers: 'maxTrainers',
  receptionists: 'maxReceptionists',
  staff: 'maxStaff',
  members: 'maxMembers',
  storage_mb: 'maxStorageMb',
};

function usageLimitFor(metric: string, limits: Record<string, number> | null): number | null {
  if (!limits) return null;
  const key = USAGE_LIMIT_KEY[metric];
  return key ? (limits[key] ?? null) : null;
}

function GymProfileCard({ tenant }: { tenant: TenantDetail }) {
  const profile = tenant.profile;
  const addressParts = profile ? [profile.addressLine, profile.city, profile.state, profile.country, profile.postalCode].filter(Boolean) : [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><Building2 className="size-4" /> Gym profile</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2.5 text-sm">
        {!profile || (!profile.legalBusinessName && !profile.email && addressParts.length === 0) ? (
          <p className="text-muted-foreground">No gym profile filled in yet — the tenant hasn&apos;t completed Gym Settings → Profile.</p>
        ) : (
          <>
            {profile.legalBusinessName ? <p className="text-base font-medium">{profile.legalBusinessName}</p> : null}
            {profile.businessType ? <p className="text-xs text-muted-foreground">{profile.businessType}</p> : null}
            {profile.description ? <p className="text-muted-foreground">{profile.description}</p> : null}

            <div className="space-y-1.5 pt-1">
              {profile.email ? (
                <p className="flex items-center gap-2"><Mail className="size-3.5 shrink-0 text-muted-foreground" /> {profile.email}</p>
              ) : null}
              {profile.phone ? (
                <p className="flex items-center gap-2"><Phone className="size-3.5 shrink-0 text-muted-foreground" /> {profile.phone}{profile.alternatePhone ? ` / ${profile.alternatePhone}` : ''}</p>
              ) : null}
              {profile.website ? (
                <p className="flex items-center gap-2"><Globe className="size-3.5 shrink-0 text-muted-foreground" /> {profile.website}</p>
              ) : null}
              {addressParts.length > 0 ? (
                <p className="flex items-start gap-2"><MapPin className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" /> {addressParts.join(', ')}</p>
              ) : null}
            </div>

            {profile.registrationNumber || profile.gstVatNumber ? (
              <div className="flex flex-wrap gap-x-4 gap-y-1 border-t pt-2 text-xs text-muted-foreground">
                {profile.registrationNumber ? <span>Reg. no: {profile.registrationNumber}</span> : null}
                {profile.gstVatNumber ? <span>GST/VAT: {profile.gstVatNumber}</span> : null}
              </div>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function TenantDetailPage() {
  const params = useParams<{ tenantId: string }>();
  const router = useRouter();
  const canManageBilling = useHasPermission('payments:manage');

  const { data: tenant, isLoading } = useTenant(params.tenantId);
  const { data: auditLogs } = useTenantAuditLogs(params.tenantId);

  const [paymentsPage, setPaymentsPage] = React.useState(1);
  const [invoicesPage, setInvoicesPage] = React.useState(1);
  const payments = useTenantPayments(params.tenantId, { page: paymentsPage, limit: 10 });
  const invoices = useTenantInvoices(params.tenantId, { page: invoicesPage, limit: 10 });

  const activate = useActivateTenant();
  const suspend = useSuspendTenant();
  const reactivate = useReactivateTenant();
  const remove = useDeleteTenant();
  const resetPassword = useResetOwnerPassword();
  const impersonate = useImpersonateTenant();

  const createLink = useCreatePaymentLink(params.tenantId);
  const verifyStatus = useVerifyPaymentStatus(params.tenantId);
  const resendNotify = useResendNotification(params.tenantId);
  const emailInvoiceMutation = useEmailInvoice(params.tenantId);
  const downloadPdf = useDownloadInvoicePdf(params.tenantId);

  const [linkResult, setLinkResult] = React.useState<{ paymentId: string; shortUrl: string; status: string } | null>(null);

  if (isLoading || !tenant) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 rounded-xl" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  const subscription = tenant.subscriptions[0];
  const openInvoice = invoices.data?.items.find((i) => i.status === 'OPEN');
  const usageChartData = tenant.usage.map((u) => {
    const limit = usageLimitFor(u.metric, tenant.limits);
    return { name: USAGE_LABELS[u.metric] ?? u.metric, used: u.value, limit: limit ?? undefined };
  });

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

  const handleSendLink = () => {
    createLink.mutate(openInvoice?.id, {
      onSuccess: (result) => {
        setLinkResult({ paymentId: result.paymentId, shortUrl: result.shortUrl, status: result.status });
        toast.success('Payment link created.');
      },
      onError: (err) => toast.error(toBillingError(err).message),
    });
  };

  const handleCheckStatus = () => {
    if (!linkResult) return;
    verifyStatus.mutate(linkResult.paymentId, {
      onSuccess: (result) => {
        setLinkResult((prev) => (prev ? { ...prev, status: result.status } : prev));
        if (result.status === 'SUCCEEDED') toast.success('Payment confirmed — subscription reactivated.');
        if (result.status === 'FAILED') toast.error('Payment link expired or was cancelled.');
      },
      onError: (err) => toast.error(toBillingError(err).message),
    });
  };

  const handleResend = () => {
    if (!linkResult) return;
    resendNotify.mutate(
      { paymentId: linkResult.paymentId, medium: 'email' },
      {
        onSuccess: () => toast.success('Notification resent.'),
        onError: (err) => toast.error(toBillingError(err).message),
      },
    );
  };

  const handleCopy = () => {
    if (!linkResult) return;
    void navigator.clipboard.writeText(linkResult.shortUrl);
    toast.success('Copied to clipboard.');
  };

  const handleEmailInvoice = (invoiceId: string) => {
    emailInvoiceMutation.mutate(
      { invoiceId },
      {
        onSuccess: () => toast.success('Invoice emailed.'),
        onError: (err) => toast.error(toBillingError(err).message),
      },
    );
  };

  const handleDownloadPdf = (invoiceId: string, invoiceNumber: string) => {
    downloadPdf.mutate({ invoiceId, invoiceNumber }, { onError: (err) => toast.error(toBillingError(err).message) });
  };

  const paymentColumns: DataTableColumn<PaymentListItem>[] = [
    { key: 'provider', header: 'Gateway', render: (p) => <span className="capitalize">{p.provider.toLowerCase()}</span> },
    { key: 'amount', header: 'Amount', render: (p) => formatMoney(p.amount, p.currency) },
    { key: 'status', header: 'Status', render: (p) => <StatusBadge status={p.status} /> },
    { key: 'reference', header: 'Reference', render: (p) => p.gatewayReference ?? p.failureReason ?? '—' },
    { key: 'createdAt', header: 'Date', render: (p) => new Date(p.createdAt).toLocaleString() },
  ];

  const invoiceColumns: DataTableColumn<InvoiceListItem>[] = [
    { key: 'invoiceNumber', header: 'Invoice #', render: (i) => <span className="font-mono">{i.invoiceNumber}</span> },
    { key: 'total', header: 'Total', render: (i) => formatMoney(i.total, i.currency) },
    { key: 'status', header: 'Status', render: (i) => <StatusBadge status={i.status} /> },
    { key: 'createdAt', header: 'Date', render: (i) => new Date(i.createdAt).toLocaleString() },
    {
      key: 'actions',
      header: '',
      render: (i) => (
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => handleDownloadPdf(i.id, i.invoiceNumber)} disabled={downloadPdf.isPending}>
            PDF
          </Button>
          {canManageBilling ? (
            <Button size="sm" variant="outline" onClick={() => handleEmailInvoice(i.id)} disabled={emailInvoiceMutation.isPending}>
              Email
            </Button>
          ) : null}
        </div>
      ),
    },
  ];

  const branchColumns: DataTableColumn<TenantDetail['branches'][number]>[] = [
    {
      key: 'name',
      header: 'Branch',
      render: (b) => (
        <span>
          <span className="block font-medium">{b.name}</span>
          <span className="block text-xs text-muted-foreground">{b.branchCode}</span>
        </span>
      ),
    },
    { key: 'location', header: 'Location', render: (b) => [b.city, b.state, b.country].filter(Boolean).join(', ') || '—' },
    { key: 'contact', header: 'Contact', render: (b) => b.phone ?? b.email ?? '—' },
    { key: 'capacity', header: 'Capacity', render: (b) => b.capacity ?? '—' },
    {
      key: 'status',
      header: 'Status',
      render: (b) => (
        <div className="flex gap-1.5">
          {b.isDefault ? <Badge variant="secondary">Default</Badge> : null}
          <Badge variant={b.isActive ? 'success' : 'outline'}>{b.isActive ? 'Active' : 'Inactive'}</Badge>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          {tenant.branding?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- tenant-supplied data-URL/remote logo, not a static asset
            <img src={tenant.branding.logoUrl} alt="" className="size-11 rounded-xl border object-cover" />
          ) : (
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/10">
              <Building2 className="size-5" aria-hidden />
            </div>
          )}
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{tenant.name}</h1>
            <div className="flex items-center gap-2 text-muted-foreground">
              {tenant.slug}.fitcloud.com <StatusBadge status={tenant.status} />
            </div>
          </div>
        </div>
        <Button variant="outline" onClick={() => { notifyProgrammaticNavigation('/tenants'); router.push('/tenants'); }}>Back to tenants</Button>
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
            remove.mutate(params.tenantId, { onSuccess: () => { notifyProgrammaticNavigation('/tenants'); router.push('/tenants'); } });
          }}
          disabled={remove.isPending}
        >
          Delete
        </Button>
      </div>

      {tenant.usage.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {tenant.usage.map((u) => {
            const limit = usageLimitFor(u.metric, tenant.limits);
            return (
              <StatisticCard
                key={u.metric}
                label={USAGE_LABELS[u.metric] ?? u.metric}
                value={limit != null ? `${u.value} / ${limit}` : u.value}
                tone={limit != null && u.value >= limit ? 'destructive' : 'primary'}
              />
            );
          })}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <GymProfileCard tenant={tenant} />

        <Card>
          <CardHeader><CardTitle className="text-base">Subscription &amp; billing</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            {subscription ? (
              <>
                <div className="flex justify-between"><span className="text-muted-foreground">Plan</span><span>{subscription.plan.name}</span></div>
                <div className="flex justify-between items-center"><span className="text-muted-foreground">Status</span><StatusBadge status={subscription.status} /></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Billing cycle</span><span>{subscription.billingCycle}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Period ends</span><span>{subscription.currentPeriodEnd ? new Date(subscription.currentPeriodEnd).toLocaleDateString() : '—'}</span></div>
                {subscription.status === 'TRIALING' && subscription.trialEndsAt ? (
                  <div className="flex justify-between"><span className="text-muted-foreground">Trial ends</span><span>{new Date(subscription.trialEndsAt).toLocaleDateString()}</span></div>
                ) : null}
                {subscription.cancelAtPeriodEnd ? (
                  <div className="flex justify-between"><span className="text-muted-foreground">Cancels at period end</span><span>Yes</span></div>
                ) : null}
                {subscription.gatewayProvider ? (
                  <div className="flex justify-between"><span className="text-muted-foreground">Gateway</span><span className="capitalize">{subscription.gatewayProvider.toLowerCase()}</span></div>
                ) : null}
                {subscription.coupon ? (
                  <div className="flex justify-between"><span className="text-muted-foreground">Coupon</span><span className="font-mono">{subscription.coupon.code}</span></div>
                ) : null}
                {subscription.graceEndsAt ? (
                  <div className="flex justify-between"><span className="text-muted-foreground">Grace ends</span><span>{new Date(subscription.graceEndsAt).toLocaleDateString()}</span></div>
                ) : null}
                {subscription.suspendedAt ? (
                  <div className="flex justify-between"><span className="text-muted-foreground">Suspended</span><span>{new Date(subscription.suspendedAt).toLocaleDateString()}</span></div>
                ) : null}
                {subscription.cancelledAt ? (
                  <>
                    <div className="flex justify-between"><span className="text-muted-foreground">Cancelled</span><span>{new Date(subscription.cancelledAt).toLocaleDateString()}</span></div>
                    {subscription.cancelReason ? (
                      <div className="flex justify-between"><span className="text-muted-foreground">Reason</span><span>{subscription.cancelReason}</span></div>
                    ) : null}
                  </>
                ) : null}
              </>
            ) : (
              <p className="text-muted-foreground">No subscription found.</p>
            )}

            {subscription && canManageBilling ? (
              <div className="mt-4 space-y-2 border-t pt-4">
                {openInvoice ? (
                  <>
                    <div className="flex justify-between font-medium"><span>Outstanding</span><span>{formatMoney(openInvoice.total, openInvoice.currency)}</span></div>
                    <p className="text-xs text-muted-foreground">Invoice {openInvoice.invoiceNumber}</p>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">No outstanding invoice on file — sending a link generates one automatically for the current plan.</p>
                )}
                {linkResult ? (
                  <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
                    <div className="flex items-center gap-2">
                      <Input readOnly value={linkResult.shortUrl} className="h-8 text-xs" />
                      <Button size="sm" variant="outline" onClick={handleCopy}>
                        <Copy className="size-3.5" />
                      </Button>
                    </div>
                    <div className="flex items-center justify-between">
                      <StatusBadge status={linkResult.status} />
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={handleResend} disabled={resendNotify.isPending || linkResult.status !== 'PENDING'}>
                          Resend by email
                        </Button>
                        <Button size="sm" onClick={handleCheckStatus} disabled={verifyStatus.isPending || linkResult.status !== 'PENDING'}>
                          Check status
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <Button size="sm" onClick={handleSendLink} disabled={createLink.isPending}>
                    Send payment link
                  </Button>
                )}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {usageChartData.length > 0 ? (
        <Card>
          <CardHeader><CardTitle className="text-base">Resource usage</CardTitle></CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={usageChartData} layout="vertical" margin={{ left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="used" name="Used" fill="var(--chart-1)" radius={[0, 4, 4, 0]} maxBarSize={22} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader><CardTitle className="text-base">Branches ({tenant.branches.length})</CardTitle></CardHeader>
        <CardContent>
          <DataTable columns={branchColumns} rows={tenant.branches} rowKey={(b) => b.id} emptyMessage="No branches yet." />
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
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

      <Card>
        <CardHeader><CardTitle className="text-base">Payments</CardTitle></CardHeader>
        <CardContent>
          {payments.isLoading || !payments.data ? (
            <Skeleton className="h-40 rounded-lg" />
          ) : (
            <>
              <DataTable columns={paymentColumns} rows={payments.data.items} rowKey={(p) => p.id} emptyMessage="No payments yet." />
              <Pagination page={payments.data.page} totalPages={payments.data.totalPages} onPageChange={setPaymentsPage} />
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Invoices</CardTitle></CardHeader>
        <CardContent>
          {invoices.isLoading || !invoices.data ? (
            <Skeleton className="h-40 rounded-lg" />
          ) : (
            <>
              <DataTable columns={invoiceColumns} rows={invoices.data.items} rowKey={(i) => i.id} emptyMessage="No invoices yet." />
              <Pagination page={invoices.data.page} totalPages={invoices.data.totalPages} onPageChange={setInvoicesPage} />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
