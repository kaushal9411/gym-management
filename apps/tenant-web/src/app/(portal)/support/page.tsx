'use client';

import * as React from 'react';
import { HelpCircle, LifeBuoy, Mail } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import { Pagination } from '@/components/ui/pagination';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { NewTicketDialog } from '@/features/support/components/new-ticket-dialog';
import { TicketDetailDialog } from '@/features/support/components/ticket-detail-dialog';
import { TicketPriorityBadge, TicketStatusBadge } from '@/features/support/components/ticket-badges';
import { useTicketList } from '@/features/support/hooks/use-tickets';
import type { TicketListItem } from '@/features/support/types';
import { useTenant } from '@/features/tenant/tenant-provider';

const FAQS = [
  { question: 'How do I invite a staff member?', answer: 'Staff invitations are managed from the Staff module once it ships.' },
  { question: 'How do I change my subscription plan?', answer: 'Go to Billing → Overview and choose "Change plan".' },
  { question: 'Can I add another branch?', answer: 'Branch management is coming with the Branches module.' },
];

function buildColumns(onView: (ticketId: string) => void): DataTableColumn<TicketListItem>[] {
  return [
    {
      key: 'subject',
      header: 'Subject',
      render: (row) => (
        <div>
          <p className="font-medium text-foreground">{row.subject}</p>
          <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{row.description}</p>
        </div>
      ),
    },
    { key: 'priority', header: 'Priority', render: (row) => <TicketPriorityBadge priority={row.priority} /> },
    { key: 'status', header: 'Status', render: (row) => <TicketStatusBadge status={row.status} /> },
    {
      key: 'createdAt',
      header: 'Raised',
      render: (row) => <span className="text-xs text-muted-foreground">{new Date(row.createdAt).toLocaleDateString()}</span>,
    },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (row) => (
        <Button variant="outline" size="sm" onClick={() => onView(row.id)}>
          View
        </Button>
      ),
    },
  ];
}

/** Help Center: FAQs + contact info + support tickets (Prompt 32). */
export default function SupportPage() {
  const tenant = useTenant();
  const { hasPermission } = usePermissions();
  const hasTickets = tenant.featureFlags.includes('support_tickets');
  const canView = hasPermission('support:view');
  const canCreate = hasPermission('support:create');

  const [page, setPage] = React.useState(1);
  const [selectedTicketId, setSelectedTicketId] = React.useState<string | null>(null);
  const ticketsQuery = useTicketList({ page, limit: 10 });
  const tickets = ticketsQuery.data;
  const columns = React.useMemo(() => buildColumns(setSelectedTicketId), []);

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15">
          <LifeBuoy className="size-5" aria-hidden />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Help Center</h1>
          <p className="text-muted-foreground">Find answers or reach the FitCloud team.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <HelpCircle className="size-4 text-muted-foreground" aria-hidden />
            Frequently asked questions
          </CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-border">
          {FAQS.map((faq) => (
            <div key={faq.question} className="py-3.5 first:pt-0 last:pb-0">
              <p className="text-sm font-medium">{faq.question}</p>
              <p className="mt-1 text-sm text-muted-foreground">{faq.answer}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">Support tickets</CardTitle>
            <CardDescription>Track and raise issues directly with our team.</CardDescription>
          </div>
          {hasTickets && canCreate ? <NewTicketDialog /> : null}
        </CardHeader>
        <CardContent>
          {!hasTickets ? (
            <EmptyState icon={LifeBuoy} title="Not on your plan" description="Upgrade your subscription to unlock support tickets." />
          ) : !canView ? (
            <EmptyState icon={LifeBuoy} title="No access" description="You don't have permission to view support tickets." />
          ) : (
            <div className="space-y-4">
              <DataTable
                columns={columns}
                rows={tickets?.items ?? []}
                rowKey={(row) => row.id}
                loading={ticketsQuery.isLoading}
                error={ticketsQuery.error}
                onRetry={() => void ticketsQuery.refetch()}
                emptyMessage="No tickets yet — raise one above if you run into an issue."
              />
              {tickets ? (
                <Pagination page={page} totalPages={tickets.totalPages} onPageChange={setPage} totalItems={tickets.total} pageSize={tickets.limit} />
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>

      <TicketDetailDialog ticketId={selectedTicketId} onOpenChange={(open) => !open && setSelectedTicketId(null)} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Contact us</CardTitle>
        </CardHeader>
        <CardContent>
          <a
            href="mailto:support@fitcloud.com"
            className="inline-flex items-center gap-2.5 rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm font-medium text-foreground shadow-xs transition-colors duration-150 hover:bg-accent hover:text-accent-foreground"
          >
            <span className="flex size-7 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Mail className="size-3.5" aria-hidden />
            </span>
            support@fitcloud.com
          </a>
        </CardContent>
      </Card>
    </div>
  );
}
