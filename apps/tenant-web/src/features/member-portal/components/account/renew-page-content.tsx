'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'sonner';
import { AlertTriangle, CalendarClock, Check, CheckCircle2, CircleDollarSign, CreditCard, Lock, RefreshCw, ShieldCheck, XCircle } from 'lucide-react';

import { LoadingButton } from '@/components/ui/loading-button';
import { loadRazorpayScript } from '@/lib/razorpay-checkout';
import { cn } from '@/lib/utils';
import { useMotionSafe } from '@/features/reports/lib/motion';
import { MEMBER_PORTAL_ROUTES } from '../../constants';
import { useMemberOverview, useMemberProfile, useStartRenewalCheckout, useVerifyRenewalCheckout } from '../../hooks/use-member-portal';
import { formatDate, parseMoney, plural, usePortalMoney } from '../../lib/format';
import { toMemberAuthServiceError } from '../../services/member-api-client';
import { EmptyBlock, HeroChip, PortalHero, ProgressRing, SectionCard, SkeletonCard, SkeletonHero, StatusChip, heroActionClass } from '../kit';
import { toneColor, toneTint } from '../kit/tones';

type Phase = 'review' | 'starting' | 'opening' | 'confirming';
const STEPS = ['Review', 'Pay', 'Done'] as const;

/**
 * Renews the member's CURRENT plan only (no self-service upgrade/downgrade)
 * and only once it has actually expired, same rule as staff's own Renew
 * action. Razorpay Orders + Checkout flow is unchanged from the previous
 * page (same hooks/helpers); only the presentation + result states are new.
 */
export function RenewPageContent() {
  const m = useMotionSafe();
  const router = useRouter();
  const money = usePortalMoney();
  const profile = useMemberProfile();
  const overview = useMemberOverview();
  const [error, setError] = React.useState<string | null>(null);
  const [openingModal, setOpeningModal] = React.useState(false);
  const [done, setDone] = React.useState(false);

  const startCheckout = useStartRenewalCheckout();
  const verifyCheckout = useVerifyRenewalCheckout();

  const current = profile.data?.currentMembership ?? null;
  const ov = overview.data?.membership ?? null;
  const endDate = ov?.endDate ?? current?.endDate ?? null;
  const planName = ov?.planName ?? current?.planName ?? null;
  const expired = ov ? ov.expired : endDate ? new Date(endDate).getTime() < Date.now() : false;

  const finish = () => {
    setDone(true);
    toast.success('Your membership has been renewed.');
    window.setTimeout(() => router.push(MEMBER_PORTAL_ROUTES.dashboard), 2600);
  };

  const submit = () => {
    setError(null);
    startCheckout.mutate(undefined, {
      onSuccess: async (result) => {
        if (!result.requiresPayment) {
          finish();
          return;
        }

        setOpeningModal(true);
        const loaded = await loadRazorpayScript();
        setOpeningModal(false);
        if (!loaded || !window.Razorpay) {
          setError('Could not load the payment checkout. Please try again.');
          return;
        }

        const razorpay = new window.Razorpay({
          key: result.keyId,
          amount: result.amount,
          currency: result.currency,
          order_id: result.orderId,
          name: 'FitCloud',
          description: current ? `${current.planName} plan renewal` : 'Membership renewal',
          theme: { color: '#16a34a' },
          handler: (response) => {
            verifyCheckout.mutate(
              {
                paymentId: result.paymentId,
                payload: {
                  razorpayOrderId: response.razorpay_order_id,
                  razorpayPaymentId: response.razorpay_payment_id,
                  razorpaySignature: response.razorpay_signature,
                },
              },
              {
                onSuccess: (verifyResult) => {
                  if (verifyResult.status === 'SUCCESS') {
                    finish();
                  } else {
                    setError('Payment verification failed. If you were charged, contact the front desk — your membership has not been renewed.');
                  }
                },
                onError: (err) => setError(toMemberAuthServiceError(err).message),
              },
            );
          },
          modal: {
            ondismiss: () => setError('Checkout closed before payment completed. Your membership has not been renewed — try again when ready.'),
          },
        });
        razorpay.open();
      },
      onError: (err) => setError(toMemberAuthServiceError(err).message),
    });
  };

  const phase: Phase = verifyCheckout.isPending ? 'confirming' : openingModal ? 'opening' : startCheckout.isPending ? 'starting' : 'review';
  const submitting = phase !== 'review';
  const step = done ? 2 : submitting ? 1 : 0;

  if (profile.isLoading && overview.isLoading) {
    return (
      <div className="space-y-4">
        <SkeletonHero />
        <SkeletonCard lines={4} />
      </div>
    );
  }

  if (!planName || !endDate) {
    return (
      <div className="space-y-4">
        <PortalHero eyebrow="Membership" title="Renew" subtitle="No membership on file yet." />
        <div className="rounded-2xl border bg-card">
          <EmptyBlock icon={RefreshCw} title="No membership on file" description="Contact the front desk to get a membership plan set up." />
        </div>
      </div>
    );
  }

  const ringPct = ov && ov.totalDays ? Math.max(0, Math.min(100, (ov.daysLeft / ov.totalDays) * 100)) : expired ? 0 : null;
  const price = ov?.price != null ? parseMoney(ov.price) : null;
  const paid = ov?.amountPaid != null ? parseMoney(ov.amountPaid) : null;

  return (
    <div className="space-y-4">
      <PortalHero
        eyebrow="Membership"
        title={planName}
        subtitle={expired ? `Expired on ${formatDate(endDate)}` : `Active until ${formatDate(endDate)}`}
        chips={
          <>
            <HeroChip>{expired ? 'Expired' : ov?.status ?? 'Active'}</HeroChip>
            {ov?.startDate ? <HeroChip>Since {formatDate(ov.startDate)}</HeroChip> : null}
          </>
        }
        aside={
          ringPct !== null ? (
            <ProgressRing value={ringPct} size={84} thickness={8} onDark>
              <div className="leading-none">
                <p className="text-xl font-bold tabular-nums">{Math.max(ov?.daysLeft ?? 0, 0)}</p>
                <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-white/80">days left</p>
              </div>
            </ProgressRing>
          ) : undefined
        }
        stats={[
          { label: 'Plan price', value: price ?? 0, format: money.format, hidden: price === null },
          { label: 'Duration', value: ov?.totalDays ? plural(ov.totalDays, 'day') : '', hidden: !ov?.totalDays },
          { label: 'Expires', value: formatDate(endDate, { day: 'numeric', month: 'short' }) },
        ]}
        actions={<Link href={MEMBER_PORTAL_ROUTES.invoices} className={heroActionClass('ghost')}><CreditCard className="size-4" /> Invoices</Link>}
      />

      {/* step tracker */}
      <ol className="flex items-center gap-2 rounded-2xl border bg-card px-4 py-3 shadow-xs" aria-label="Renewal steps">
        {STEPS.map((label, i) => {
          const reached = i <= step;
          return (
            <React.Fragment key={label}>
              <li className="flex items-center gap-2">
                <motion.span
                  animate={{ scale: i === step ? 1.1 : 1 }}
                  className="grid size-7 place-items-center rounded-full text-xs font-bold"
                  style={reached ? { background: toneColor('primary'), color: 'var(--primary-foreground)' } : { background: toneTint('muted', 15), color: toneColor('muted') }}
                >
                  {i < step || (done && i === 2) ? <Check className="size-4" /> : i + 1}
                </motion.span>
                <span className={cn('text-xs font-semibold', reached ? 'text-foreground' : 'text-muted-foreground')}>{label}</span>
              </li>
              {i < STEPS.length - 1 ? (
                <div className="relative h-0.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <motion.div className="absolute inset-y-0 left-0 rounded-full bg-primary" initial={false} animate={{ width: i < step ? '100%' : '0%' }} transition={{ duration: 0.5 }} />
                </div>
              ) : null}
            </React.Fragment>
          );
        })}
      </ol>

      <AnimatePresence mode="wait" initial={false}>
        {done ? (
          <motion.section key="success" initial={m.reduce ? false : { opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} className="grid place-items-center gap-3 rounded-2xl border bg-card px-6 py-10 text-center shadow-xs">
            <motion.span initial={m.reduce ? false : { scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 14, delay: 0.1 }} className="grid size-20 place-items-center rounded-full" style={{ background: toneTint('success', 16), color: toneColor('success') }}>
              <CheckCircle2 className="size-10" />
            </motion.span>
            <h2 className="text-xl font-semibold">You&apos;re renewed!</h2>
            <p className="text-sm text-muted-foreground">Your membership is active again. Taking you to your dashboard…</p>
            <Link href={MEMBER_PORTAL_ROUTES.dashboard} className="inline-flex min-h-11 items-center rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground">Go to dashboard</Link>
          </motion.section>
        ) : (
          <motion.div key="form" initial={m.reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
            <SectionCard title="Plan summary" subtitle={planName} icon={CircleDollarSign} tone="info" flush>
              <dl className="divide-y text-sm">
                <Row label="Plan" value={planName} />
                {ov?.totalDays ? <Row label="Duration" value={plural(ov.totalDays, 'day')} /> : null}
                {price !== null ? <Row label="Plan price" value={money.format(price)} strong /> : null}
                {paid !== null ? <Row label="Paid last period" value={money.format(paid)} /> : null}
                <Row label={expired ? 'Expired on' : 'Valid until'} value={formatDate(endDate)} />
                <Row label="New period starts" value="Today" hint />
              </dl>
              <p className="border-t px-4 py-3 text-xs text-muted-foreground">Renewing starts a fresh period from today at this plan&apos;s current price. Any discount or tax is applied at checkout.</p>
            </SectionCard>

            <section className="space-y-3 rounded-2xl border bg-card p-4 shadow-xs">
              <AnimatePresence initial={false}>
                {error ? (
                  <motion.div key="err" initial={m.reduce ? false : { opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} role="alert" className="overflow-hidden">
                    <div className="flex items-start gap-3 rounded-xl p-3 text-sm" style={{ background: toneTint('danger', 12), color: toneColor('danger') }}>
                      <XCircle className="mt-0.5 size-5 shrink-0" />
                      <div className="min-w-0"><p className="font-semibold">Renewal not completed</p><p className="text-foreground/80">{error}</p></div>
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>

              {!expired ? (
                <div className="flex items-start gap-3 rounded-xl p-3 text-sm" style={{ background: toneTint('info', 12) }}>
                  <CalendarClock className="mt-0.5 size-5 shrink-0" style={{ color: toneColor('info') }} />
                  <p>Your plan is still active until <b>{formatDate(endDate)}</b>. You can renew once it has expired.</p>
                </div>
              ) : (
                <div className="flex items-start gap-3 rounded-xl p-3 text-sm" style={{ background: toneTint('warning', 12) }}>
                  <AlertTriangle className="mt-0.5 size-5 shrink-0" style={{ color: toneColor('warning') }} />
                  <p>Your membership expired on <b>{formatDate(endDate)}</b>. Renew to get back in.</p>
                </div>
              )}

              <LoadingButton
                type="button"
                className="min-h-12 w-full rounded-xl text-base"
                onClick={submit}
                disabled={!expired}
                loading={submitting}
                loadingText={phase === 'opening' ? 'Opening checkout…' : phase === 'confirming' ? 'Confirming…' : 'Starting checkout…'}
              >
                {error ? 'Try again' : price !== null && expired ? `Renew & Pay ${money.format(price)}` : 'Renew & Pay'}
              </LoadingButton>
              <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
                <Lock className="size-3.5 shrink-0" /> <ShieldCheck className="size-3.5 shrink-0" /> Pay in Razorpay&apos;s secure popup — this app never sees your card or UPI details.
              </p>
              {expired ? null : <StatusChip tone="info" className="mx-auto flex w-fit">Renewal opens after expiry</StatusChip>}
            </section>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Row({ label, value, strong, hint }: { label: string; value: string; strong?: boolean; hint?: boolean }) {
  return (
    <div className="flex min-h-12 items-center justify-between gap-3 px-4 py-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn('min-w-0 truncate text-right tabular-nums', strong && 'text-base font-semibold', hint && 'text-primary')}>{value}</dd>
    </div>
  );
}
