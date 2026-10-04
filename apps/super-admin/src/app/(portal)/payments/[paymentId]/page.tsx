import { PaymentDetailView } from '@/features/payments/components/payment-detail';

export default async function Page({ params }: { params: Promise<{ paymentId: string }> }) {
  const { paymentId } = await params;
  return <PaymentDetailView paymentId={paymentId} />;
}
