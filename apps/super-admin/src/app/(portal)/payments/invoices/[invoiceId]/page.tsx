import { InvoiceDetailView } from '@/features/payments/components/invoice-detail';

export default async function Page({ params }: { params: Promise<{ invoiceId: string }> }) {
  const { invoiceId } = await params;
  return <InvoiceDetailView invoiceId={invoiceId} />;
}
