'use client';

import { useParams } from 'next/navigation';

import { CouponDetailView } from '@/features/coupons/components/coupon-detail-view';

export default function CouponDetailPage() {
  const params = useParams<{ couponId: string }>();
  return <CouponDetailView couponId={params.couponId} />;
}
