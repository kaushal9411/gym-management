'use client';

import { motion } from 'framer-motion';
import { ChevronDown, HelpCircle, Mail } from 'lucide-react';
import * as React from 'react';

import { usePublishedCmsPages } from '@/features/cms/hooks/use-cms';
import { ChartCard } from '@/features/reports/components/ui';
import { useMotionSafe } from '@/features/reports/lib/motion';
import { cn } from '@/lib/utils';
import { SUPPORT_COLOR, tint } from '../lib/ticket-meta';

/** Same content as before (published FAQ pages + the support e-mail link) as animated cards. */
export function HelpCentre() {
  const faqsQuery = usePublishedCmsPages('FAQ');
  const faqs = faqsQuery.data ?? [];
  const m = useMotionSafe();
  const [openId, setOpenId] = React.useState<string | null>(null);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <ChartCard className="lg:col-span-2" title="Frequently asked questions" subtitle="Quick answers before you raise a ticket" loading={faqsQuery.isPending} empty={faqs.length === 0} emptyText="No FAQs published yet." minHeight={140}>
        <motion.ul className="grid grid-cols-1 gap-2.5" variants={m.staggerContainer(0.06)} initial={m.initial} animate="show">
          {faqs.map((faq) => {
            const open = openId === faq.id;
            return (
              <motion.li key={faq.id} variants={m.fadeUp} className="overflow-hidden rounded-xl border transition-shadow hover:shadow-sm" style={open ? { backgroundColor: tint(SUPPORT_COLOR, 6) } : undefined}>
                <button type="button" aria-expanded={open} onClick={() => setOpenId(open ? null : faq.id)} className="flex w-full items-center gap-3 px-3.5 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: tint(SUPPORT_COLOR, 16), color: SUPPORT_COLOR }}>
                    <HelpCircle className="size-4" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1 text-sm font-bold">{faq.title}</span>
                  <ChevronDown className={cn('size-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} aria-hidden />
                </button>
                {open ? (
                  <motion.p initial={m.reduce ? false : { opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="px-3.5 pb-3.5 pl-[58px] text-sm text-muted-foreground">
                    {String(faq.content.answer ?? '')}
                  </motion.p>
                ) : null}
              </motion.li>
            );
          })}
        </motion.ul>
      </ChartCard>

      <ChartCard title="Contact us" subtitle="Prefer e-mail? We read every message." minHeight={100}>
        <motion.a
          href="mailto:support@fitcloud.com"
          whileHover={m.reduce ? undefined : { y: -3 }}
          className="flex items-center gap-3 rounded-2xl border p-4 shadow-xs transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          style={{ backgroundImage: `linear-gradient(135deg, ${tint(SUPPORT_COLOR, 14)}, transparent 70%)` }}
        >
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl text-white" style={{ backgroundColor: SUPPORT_COLOR }}>
            <Mail className="size-5" aria-hidden />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-extrabold">support@fitcloud.com</span>
            <span className="block text-xs text-muted-foreground">Opens your mail app</span>
          </span>
        </motion.a>
      </ChartCard>
    </div>
  );
}
