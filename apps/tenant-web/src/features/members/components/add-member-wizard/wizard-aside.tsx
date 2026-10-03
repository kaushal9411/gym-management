'use client';

import { motion } from 'framer-motion';
import { Check, FileText, ListChecks } from 'lucide-react';

import { useCurrencySymbol } from '@/lib/currency';
import { PanelCard, formatMoney } from '../detail/detail-ui';
import { GOAL_LABELS, type MemberExtendedInfoFormState } from '../member-extended-info-fields';
import type { MemberProgramFormState } from '../member-program-fields';
import { useWizardPricing } from './use-wizard-pricing';
import type { WizardCorePersonalState, WizardPaymentState } from './types';

interface WizardAsideProps {
  core: WizardCorePersonalState;
  extended: MemberExtendedInfoFormState;
  program: MemberProgramFormState;
  payment: WizardPaymentState;
  branchName?: string;
}

function Row({ label, value, strong }: { label: string; value: React.ReactNode; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-3 border-b border-dashed py-2 text-[13px] last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className={`text-right tabular-nums ${strong ? 'font-extrabold' : 'font-semibold'}`}>{value}</span>
    </div>
  );
}

/** Live preview, completion checklist and running invoice — visible on every step so nothing has to be remembered until the payment step. */
export function WizardAside({ core, extended, program, payment, branchName }: WizardAsideProps) {
  const symbol = useCurrencySymbol();
  const p = useWizardPricing(extended, program, payment);
  const name = `${core.firstName} ${core.lastName}`.trim();
  const initials = `${core.firstName[0] ?? ''}${core.lastName[0] ?? ''}`.toUpperCase();

  const required = [
    { label: 'Full name', ok: Boolean(core.firstName.trim() && core.lastName.trim()) },
    { label: 'Phone or email', ok: Boolean(core.phone.trim() || core.email.trim()) },
    { label: 'Branch', ok: Boolean(core.branchId) },
    { label: 'Joining date', ok: Boolean(core.joiningDate) },
  ];
  const done = required.filter((r) => r.ok).length;
  const percent = Math.round((done / required.length) * 100);
  const pills = [branchName, p.selectedPlan?.name, extended.goal ? GOAL_LABELS[extended.goal] : undefined].filter(Boolean) as string[];

  return (
    <aside aria-label="Live summary" className="flex flex-col gap-4 lg:sticky lg:top-3">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl p-5 text-center text-white shadow-lg"
        style={{ backgroundImage: 'radial-gradient(400px 200px at 80% -20%, color-mix(in oklch, #c026d3 70%, transparent), transparent 60%), linear-gradient(135deg, #4338ca, #7c3aed)' }}
      >
        <div className="mx-auto mb-2.5 size-[84px] rounded-full p-1" style={{ backgroundImage: 'conic-gradient(from 210deg, #fde68a, #f9a8d4, #a5b4fc, #6ee7b7, #fde68a)' }}>
          <motion.span key={initials} initial={{ scale: 0.7 }} animate={{ scale: 1 }} className="grid size-full place-items-center rounded-full bg-indigo-950/85 text-[26px] font-extrabold">
            {initials || '?'}
          </motion.span>
        </div>
        <h3 className="min-h-[26px] truncate text-xl font-extrabold">{name || 'New member'}</h3>
        <p className="min-h-[19px] truncate text-[12.5px] text-white/85">{core.phone ? `${core.phone}${core.email ? ` · ${core.email}` : ''}` : core.email || 'Start typing a name'}</p>
        <div className="mt-2.5 flex flex-wrap justify-center gap-1.5">
          {pills.map((t) => (
            <span key={t} className="rounded-full border border-white/30 bg-white/20 px-2.5 py-0.5 text-[11.5px] font-semibold">
              {t}
            </span>
          ))}
        </div>
      </motion.div>

      <PanelCard icon={ListChecks} accent="success" title="Ready to save" delay={0.1}>
        <div className="flex items-center gap-4">
          <div className="grid size-[74px] shrink-0 place-items-center rounded-full transition-all duration-500" style={{ backgroundImage: `conic-gradient(var(--success) ${percent}%, color-mix(in oklch, var(--success) 16%, transparent) 0)` }}>
            <div className="grid size-[54px] place-items-center rounded-full bg-card text-[15px] font-extrabold tabular-nums">{percent}%</div>
          </div>
          <ul className="grid gap-1 text-[12.5px]">
            {required.map((r) => (
              <li key={r.label} className={`flex items-center gap-2 ${r.ok ? 'font-semibold' : 'text-muted-foreground'}`} style={r.ok ? { color: 'var(--success)' } : undefined}>
                <span className="grid size-3.5 place-items-center rounded-full border-2" style={r.ok ? { backgroundColor: 'var(--success)', borderColor: 'var(--success)', color: '#fff' } : undefined}>
                  {r.ok ? <Check className="size-2.5" strokeWidth={4} /> : null}
                </span>
                {r.label}
              </li>
            ))}
          </ul>
        </div>
      </PanelCard>

      <PanelCard icon={FileText} accent="primary" title="Proforma invoice" delay={0.2}>
        <div className="-my-2">
          <Row label="Program" value={p.selectedPlan?.name ?? 'None yet'} />
          {p.selectedPlan ? <Row label="Plan price" value={formatMoney(symbol, p.basePrice)} /> : null}
          {p.planDiscountAmount > 0 ? <Row label={`Plan discount (${p.selectedPlan?.discountPercentage}%)`} value={`-${formatMoney(symbol, p.planDiscountAmount)}`} /> : null}
          {p.planTaxAmount > 0 ? <Row label={`Tax (${p.selectedPlan?.taxPercentage}%)`} value={formatMoney(symbol, p.planTaxAmount)} /> : null}
          {p.planJoiningFee > 0 ? <Row label="Plan registration fee" value={formatMoney(symbol, p.planJoiningFee)} /> : null}
          {p.registrationFee > 0 ? <Row label="Registration fee" value={formatMoney(symbol, p.registrationFee)} /> : null}
          {p.discount > 0 ? <Row label="Discount allowed" value={`-${formatMoney(symbol, p.discount)}`} /> : null}
        </div>
        <div className="flex items-baseline justify-between rounded-2xl px-3.5 py-3" style={{ backgroundImage: 'linear-gradient(120deg, color-mix(in oklch, var(--primary) 14%, transparent), color-mix(in oklch, var(--chart-7) 12%, transparent))' }}>
          <span className="text-sm font-bold">Total due</span>
          <b className="text-2xl font-extrabold tabular-nums" style={{ color: 'var(--primary)' }}>{formatMoney(symbol, Math.max(p.totalDue, 0))}</b>
        </div>
        <div className="-my-2">
          <Row label="Payment received" value={formatMoney(symbol, p.paymentReceived)} />
        </div>
        <div className="flex justify-between rounded-xl px-3 py-2 text-[13px] font-bold" style={p.pendingAmount > 0 ? { backgroundColor: 'color-mix(in oklch, var(--destructive) 11%, transparent)', color: 'var(--destructive)' } : { backgroundColor: 'color-mix(in oklch, var(--success) 11%, transparent)', color: 'var(--success)' }}>
          <span>Pending</span>
          <span className="tabular-nums">{formatMoney(symbol, p.pendingAmount)}</span>
        </div>
      </PanelCard>
    </aside>
  );
}
