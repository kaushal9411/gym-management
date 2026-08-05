'use client';

import { Download, Receipt } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { memberPortalService } from '@/features/member-portal/services/member-portal.service';
import { useMemberInvoices } from '@/features/member-portal/hooks/use-member-portal';

const STATUS_VARIANT: Record<string, 'success' | 'secondary' | 'destructive'> = {
  PAID: 'success',
  UNPAID: 'secondary',
  OVERDUE: 'destructive',
};

export default function MemberInvoicesPage() {
  const { data, isLoading } = useMemberInvoices();

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">My invoices</h1>
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : !data || data.items.length === 0 ? (
        <EmptyState icon={Receipt} title="No invoices yet" description="Your invoices will show up here once you're billed." />
      ) : (
        <div className="space-y-2">
          {data.items.map((inv) => (
            <Card key={inv.id}>
              <CardContent className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-medium">{inv.invoiceNumber}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(inv.invoiceDate).toLocaleDateString()} · ₹{inv.totalAmount}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={STATUS_VARIANT[inv.status] ?? 'secondary'}>{inv.status}</Badge>
                  <Button size="icon" variant="ghost" className="size-8" aria-label={`Download ${inv.invoiceNumber}`} onClick={() => memberPortalService.downloadInvoice(inv.id, inv.invoiceNumber)}>
                    <Download className="size-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
