'use client';

import { usePathname } from 'next/navigation';
import { useReportWebVitals } from 'next/web-vitals';

const RUM_ENDPOINT = `${process.env.NEXT_PUBLIC_API_URL}/public/rum`;

/**
 * No vendor lock-in (no Vercel Analytics — this app doesn't assume Vercel
 * hosting): reports Core Web Vitals to our own `/public/rum` sink, which
 * just logs them structured via Winston for now. `sendBeacon` is used
 * because these often fire as the user is navigating away — a normal
 * `fetch` can get cancelled mid-flight in that moment, `sendBeacon` is
 * built for exactly this. Falls back to `fetch(..., {keepalive: true})`
 * on the (rare) browser without `sendBeacon`.
 */
export function WebVitalsReporter() {
  const pathname = usePathname();

  useReportWebVitals((metric) => {
    const payload = JSON.stringify({
      app: 'tenant-web',
      name: metric.name,
      id: metric.id,
      value: metric.value,
      rating: metric.rating,
      navigationType: metric.navigationType,
      path: pathname,
    });

    if (navigator.sendBeacon) {
      navigator.sendBeacon(RUM_ENDPOINT, new Blob([payload], { type: 'application/json' }));
    } else {
      fetch(RUM_ENDPOINT, { body: payload, method: 'POST', headers: { 'Content-Type': 'application/json' }, keepalive: true }).catch(() => undefined);
    }
  });

  return null;
}
