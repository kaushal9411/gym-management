'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { CalendarDays, IdCard, MapPin, MessageCircle, Phone, Send } from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import type { MemberDetail } from '@/features/members/types';
import { useCurrencySymbol } from '@/lib/currency';
import { CountUp, ProgressBar, formatMoney } from './detail-ui';
import { useMemberMoney } from './use-member-money';

function whatsappUrl(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return `https://wa.me/${digits.length === 10 ? `91${digits}` : digits}`;
}

function statusDot(status: string, deleted: boolean): string {
  if (deleted) return 'bg-rose-300';
  if (status === 'ACTIVE') return 'bg-emerald-300 shadow-[0_0_0_3px_rgba(110,231,183,.35)]';
  if (status === 'FROZEN') return 'bg-sky-300';
  return 'bg-amber-300';
}

const ACTION_SKIN =
  'contents [&_button:not(.bg-destructive)]:border [&_button:not(.bg-destructive)]:border-white/30 [&_button:not(.bg-destructive)]:bg-white/15 [&_button:not(.bg-destructive)]:text-white [&_button:not(.bg-destructive):hover]:bg-white/25';

interface MemberHeroProps {
  data: MemberDetail;
  /** The existing Freeze / Deactivate / Restore / Delete buttons — passed through untouched so their permission logic stays on the page. */
  actions: React.ReactNode;
  canSendLink: boolean;
  onSendLink: () => void;
}

export function MemberHero({ data, actions, canSendLink, onSendLink }: MemberHeroProps) {
  const symbol = useCurrencySymbol();
  const { totalPaid, due, totalBilled } = useMemberMoney(data.id, data.outstandingAmount);
  const initials = data.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  const membership = data.currentMembership;

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="relative grid gap-6 overflow-hidden rounded-3xl p-6 text-white shadow-lg lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:p-7"
      style={{
        backgroundImage:
          'radial-gradient(900px 300px at 85% -20%, color-mix(in oklch, #c026d3 75%, transparent), transparent 60%), linear-gradient(115deg, #4338ca, #7c3aed 62%, #c026d3)',
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{ backgroundImage: 'repeating-linear-gradient(135deg, rgba(255,255,255,.06) 0 1px, transparent 1px 14px)' }}
      />
      <div className="relative min-w-0 space-y-4">
        <div className="flex flex-wrap items-center gap-5">
          <motion.div
            initial={{ opacity: 0, rotate: -80, scale: 0.7 }}
            animate={{ opacity: 1, rotate: 0, scale: 1 }}
            transition={{ duration: 0.8, ease: [0.2, 0.8, 0.2, 1] }}
            className="rounded-full p-1"
            style={{ backgroundImage: 'conic-gradient(from 210deg, #fde68a, #f9a8d4, #a5b4fc, #6ee7b7, #fde68a)' }}
          >
            <Avatar className="size-20 border-0">
              {data.profilePhotoUrl ? <AvatarImage src={data.profilePhotoUrl} alt="" /> : null}
              <AvatarFallback className="bg-indigo-950/85 text-2xl font-extrabold text-white">{initials}</AvatarFallback>
            </Avatar>
          </motion.div>
          <div className="min-w-0">
            <h1 className="text-balance text-2xl font-extrabold tracking-tight sm:text-3xl">{data.name}</h1>
            <p className="mt-0.5 text-sm font-medium text-white/80">
              {data.memberId || 'No member ID'}
              {data.gender ? ` · ${data.gender.charAt(0)}${data.gender.slice(1).toLowerCase()}` : ''}
              {` · joined ${new Date(data.joiningDate).toLocaleDateString()}`}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/30 bg-white/20 px-3 py-1 backdrop-blur">
                <span className={`size-2 rounded-full ${statusDot(data.status, !!data.deletedAt)}`} aria-hidden />
                {data.deletedAt ? 'Deleted' : data.status.charAt(0) + data.status.slice(1).toLowerCase().replace('_', ' ')}
              </span>
              {membership ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/15 px-3 py-1 backdrop-blur">
                  <IdCard className="size-3.5" aria-hidden /> {membership.planName}
                </span>
              ) : null}
              {membership ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/15 px-3 py-1 backdrop-blur">
                  <CalendarDays className="size-3.5" aria-hidden /> Valid till {new Date(membership.endDate).toLocaleDateString()}
                </span>
              ) : null}
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/15 px-3 py-1 backdrop-blur">
                <MapPin className="size-3.5" aria-hidden /> {data.branch.name}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {data.phone ? (
            <>
              <Button asChild size="sm" variant="secondary" className="border border-white/30 bg-white/15 text-white hover:bg-white/25">
                <a href={`tel:${data.phone}`}>
                  <Phone className="size-4" /> Call
                </a>
              </Button>
              <Button asChild size="sm" variant="secondary" className="border border-white/30 bg-white/15 text-white hover:bg-white/25">
                <a href={whatsappUrl(data.phone)} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="size-4" /> WhatsApp
                </a>
              </Button>
            </>
          ) : null}
          <div className={ACTION_SKIN}>{actions}</div>
        </div>
      </div>

      <motion.aside
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, delay: 0.2 }}
        aria-label="Amount due"
        className="relative flex min-w-0 flex-col gap-2.5 rounded-2xl bg-white/95 p-5 text-slate-900 shadow-xl lg:min-w-[280px]"
      >
        <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: due > 0 ? '#e11d48' : '#059669' }}>
          {due > 0 ? 'Amount due' : 'All paid up'}
        </span>
        <div className="text-4xl font-extrabold leading-none tabular-nums" style={{ color: due > 0 ? '#be123c' : '#047857' }}>
          {symbol}
          <CountUp value={due} format={(n) => Math.round(n).toLocaleString()} />
        </div>
        <ProgressBar percent={totalBilled > 0 ? (totalPaid / totalBilled) * 100 : 100} accent={due > 0 ? 'destructive' : 'success'} />
        <p className="text-xs text-slate-500 tabular-nums">
          {formatMoney(symbol, totalPaid)} paid of {formatMoney(symbol, totalBilled)}
        </p>
        {due > 0 && canSendLink ? (
          <Button
            type="button"
            onClick={onSendLink}
            className="mt-1 border-0 text-white shadow-md hover:opacity-95"
            style={{ backgroundImage: 'linear-gradient(120deg, #e11d48, #c026d3)' }}
          >
            <Send className="size-4" /> Send payment link
          </Button>
        ) : null}
      </motion.aside>
    </motion.section>
  );
}
