'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Copy, ExternalLink, Mail, MoreHorizontal, UserCog, Wrench } from 'lucide-react';
import { toast } from 'sonner';

import { Chip } from '@/features/dashboard/components/ui';
import { initials } from '@/features/dashboard/components/format';
import type { TenantOverview } from '@/features/tenants/api/detail';
import { toTenantError, useImpersonateTenant } from '@/features/tenants/hooks/use-tenants';
import { InlineConfirm, READONLY_TIP, type ConfirmCfg } from '../controls/confirm';
import { STATUS_TONE } from '../controls/control-panel';

const BANNER_BG = 'radial-gradient(700px 260px at 92% -40%, rgba(94,234,212,.45), transparent 60%), linear-gradient(115deg, #0f172a, #115e59 58%, #0e7490)';
const btn = 'inline-flex h-9 items-center gap-1.5 rounded-lg border border-white/30 bg-white/15 px-3.5 text-[13px] font-semibold text-white outline-none transition-colors hover:bg-white/25 focus-visible:ring-2 focus-visible:ring-white disabled:opacity-50';
const fmtSince = (s: string) => new Date(s).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });

export function TenantBanner({ tenant, canManage, onChangePlan }: { tenant: TenantOverview['tenant']; canManage: boolean; onChangePlan: () => void }) {
  const reduce = useReducedMotion();
  const impersonate = useImpersonateTenant();
  const [confirming, setConfirming] = useState(false);
  const [menu, setMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !menuRef.current?.contains(e.target as Node)) setMenu(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', close); };
  }, [menu]);

  const cfg: ConfirmCfg = {
    title: 'Impersonate tenant', label: 'Open portal', pending: impersonate.isPending,
    text: <>Opens a 10-minute, non-renewable session inside <b>{tenant.name}</b> in a new tab. Audited.</>,
    run: () => void (async () => {
      const id = toast.loading('Creating impersonation session…');
      try {
        const res = await impersonate.mutateAsync(tenant.id);
        // Same token hand-off bridge as before: `rt` is a deliberate non-renewable placeholder (no refresh_tokens row backs this session).
        const fragment = new URLSearchParams({ at: res.accessToken, rt: 'impersonation-not-renewable', exp: res.expiresAt }).toString();
        window.open(`${res.portalUrl}/onboarding-complete#${fragment}`, '_blank');
        toast.success('Impersonation session created — opening portal', { id });
        setConfirming(false);
      } catch (e) { toast.error(toTenantError(e).message, { id }); }
    })(),
  };

  const owner = tenant.owner;
  return (
    <motion.header
      data-no-print
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="relative rounded-[18px] text-white"
      style={{ background: BANNER_BG }}
    >
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-[18px]" style={{ background: 'repeating-linear-gradient(135deg, rgba(255,255,255,.05) 0 1px, transparent 1px 14px)' }} />
      <div className="relative flex flex-wrap items-center gap-4 px-5 py-5 sm:px-6">
        <span className="grid size-14 shrink-0 place-items-center rounded-[14px] border border-white/40 bg-white/20 text-xl font-bold" aria-hidden>{initials(tenant.name)}</span>
        <div className="min-w-0 flex-[1_1_280px]">
          <h1 className="truncate text-[22px] font-bold leading-tight">{tenant.name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-teal-100">
            <Chip tone={STATUS_TONE[tenant.status]}>{tenant.status.replace('_', ' ')}</Chip>
            {tenant.plan ? <Chip tone="blue">{tenant.plan}</Chip> : <Chip tone="slate">No plan</Chip>}
            {tenant.maintenanceMode ? <Chip tone="amber"><Wrench className="mr-1 size-3" aria-hidden />Maintenance</Chip> : null}
            <span className="font-mono text-[12.5px]">{tenant.slug}</span>
            {owner ? <><span aria-hidden>·</span><span className="min-w-0 truncate">Owner {owner.name} ({owner.email})</span></> : null}
            <span aria-hidden>·</span><span>Customer since {fmtSince(tenant.createdAt)}</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {owner?.email ? <a className={btn} href={`mailto:${owner.email}`}><Mail className="size-4" aria-hidden />Message owner</a> : null}
          <button type="button" className={btn} disabled={!canManage} title={canManage ? undefined : READONLY_TIP} aria-expanded={confirming} onClick={() => setConfirming((v) => !v)}><UserCog className="size-4" aria-hidden />Impersonate</button>
          <button type="button" className="inline-flex h-9 items-center rounded-lg border border-white bg-white px-3.5 text-[13px] font-semibold text-teal-800 outline-none hover:bg-teal-50 focus-visible:ring-2 focus-visible:ring-white" onClick={onChangePlan}>Change plan</button>
          <div ref={menuRef} className="relative">
            <button type="button" className={btn} aria-label="More actions" aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu((v) => !v)}><MoreHorizontal className="size-4" aria-hidden /></button>
            {menu ? (
              <div role="menu" className="absolute right-0 top-full z-20 mt-1.5 w-52 rounded-lg border bg-popover p-1 text-[13px] text-popover-foreground shadow-lg">
                {owner?.email ? <a role="menuitem" href={`mailto:${owner.email}`} className="flex items-center gap-2 rounded-md px-2.5 py-2 hover:bg-accent focus-visible:bg-accent focus-visible:outline-none" onClick={() => setMenu(false)}><ExternalLink className="size-4" aria-hidden />Open owner email</a> : null}
                <button role="menuitem" type="button" className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left hover:bg-accent focus-visible:bg-accent focus-visible:outline-none" onClick={() => { void navigator.clipboard.writeText(tenant.id); toast.success('Tenant ID copied'); setMenu(false); }}><Copy className="size-4" aria-hidden />Copy tenant ID</button>
                <p className="px-2.5 py-1.5 text-[11px] text-muted-foreground">Delete lives in the Danger zone.</p>
              </div>
            ) : null}
          </div>
        </div>
      </div>
      {confirming ? <div className="relative px-5 pb-5 sm:px-6"><div className="max-w-xl rounded-lg bg-card text-card-foreground"><InlineConfirm cfg={cfg} slug={tenant.slug} onCancel={() => setConfirming(false)} /></div></div> : null}
    </motion.header>
  );
}
