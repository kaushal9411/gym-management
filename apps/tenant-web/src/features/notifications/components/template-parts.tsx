'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { Mail, Pencil, Smartphone, BellRing, MessageCircle, MessageSquare } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { staggerDelay, useMotionSafe } from '@/features/reports/lib/motion';
import { accentChipStyle, accentColor, accentTint, type ReportAccent } from '@/features/reports/lib/reports-theme';
import { cn } from '@/lib/utils';
import type { NotificationChannel, NotificationTemplate, NotificationTemplateType } from '../types';

export interface TemplateGroup {
  key: string;
  label: string;
  description: string;
  accent: ReportAccent;
  icon: LucideIcon;
  types: NotificationTemplateType[];
}

const CHANNEL_META: Record<NotificationChannel, { label: string; icon: LucideIcon; live: boolean }> = {
  IN_APP: { label: 'In-app', icon: BellRing, live: true },
  EMAIL: { label: 'Email', icon: Mail, live: true },
  PUSH: { label: 'Push', icon: Smartphone, live: false },
  SMS: { label: 'SMS', icon: MessageSquare, live: false },
  WHATSAPP: { label: 'WhatsApp', icon: MessageCircle, live: false },
};
const LIVE: NotificationChannel[] = ['IN_APP', 'EMAIL'];
const SOON: NotificationChannel[] = ['PUSH', 'SMS', 'WHATSAPP'];

/** `{{placeholder}}` tokens rendered as tinted code chips inside a template preview. */
function Preview({ text, className }: { text: string; className?: string }) {
  const parts = text.split(/(\{\{[^}]+\}\})/g);
  return (
    <p className={className}>
      {parts.map((part, i) =>
        part.startsWith('{{') ? (
          <code key={i} className="rounded px-1 py-px text-[0.92em] font-semibold" style={{ backgroundColor: 'color-mix(in oklch, var(--chart-7) 14%, transparent)', color: 'var(--chart-7)' }}>
            {part}
          </code>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        ),
      )}
    </p>
  );
}

/** Pill switch; the whole control is a real `role=switch` button. */
function Switch({ checked, onChange, disabled, label }: { checked: boolean; onChange: () => void; disabled?: boolean; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      className={cn('relative h-6 w-[42px] shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60', checked ? 'bg-primary' : 'bg-muted-foreground/30')}
    >
      <span className={cn('absolute top-[3px] size-[18px] rounded-full bg-white shadow-sm transition-all', checked ? 'right-[3px]' : 'left-[3px]')} />
    </button>
  );
}

export function TemplateCard({
  template,
  accent,
  index,
  toggling,
  onToggle,
  onEdit,
}: {
  template: NotificationTemplate;
  accent: ReportAccent;
  index: number;
  toggling: boolean;
  onToggle: () => void;
  onEdit: () => void;
}) {
  const m = useMotionSafe();
  return (
    <motion.article
      layout={false}
      initial={m.reduce ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: staggerDelay(index, 0.04, 8) }}
      whileHover={m.reduce ? undefined : { y: -3 }}
      className={cn('relative flex min-w-0 flex-col gap-3 overflow-hidden rounded-[20px] border bg-card p-4 shadow-xs transition-shadow hover:shadow-md', !template.isActive && 'opacity-80')}
    >
      <span aria-hidden className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: template.isActive ? accentColor(accent) : 'var(--border)' }} />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[15px] font-extrabold leading-tight">{template.label}</h3>
            {template.isCustomized ? (
              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ backgroundColor: accentTint(accent, 14), color: accentColor(accent) }}>
                <Pencil className="size-3" aria-hidden /> Customized
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">{template.description}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <Switch checked={template.isActive} onChange={onToggle} disabled={toggling} label={`${template.label} active`} />
          <span className={cn('text-[11px] font-bold', template.isActive ? 'text-success' : 'text-muted-foreground')}>{template.isActive ? 'Active' : 'Disabled'}</span>
        </div>
      </div>

      <div className="space-y-1 rounded-xl bg-muted/60 p-3">
        <Preview text={template.titleTemplate} className="text-[13px] font-bold" />
        <Preview text={template.bodyTemplate} className="line-clamp-3 text-xs leading-relaxed text-muted-foreground" />
      </div>

      <div className="mt-auto flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {LIVE.map((c) => {
            const on = template.channels.includes(c);
            const Icon = CHANNEL_META[c].icon;
            return (
              <span
                key={c}
                className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold', !on && 'border-dashed text-muted-foreground/70')}
                style={on ? { ...accentChipStyle(accent), borderColor: 'transparent' } : undefined}
                title={on ? `${CHANNEL_META[c].label} enabled` : `${CHANNEL_META[c].label} off`}
              >
                <Icon className="size-3" aria-hidden /> {CHANNEL_META[c].label}
                {on ? null : <span className="sr-only"> (off)</span>}
              </span>
            );
          })}
          {SOON.map((c) => (
            <span key={c} className="inline-flex items-center gap-1 rounded-full border border-dashed px-2 py-0.5 text-[11px] font-semibold text-muted-foreground/60" title={`${CHANNEL_META[c].label}: coming soon`}>
              {CHANNEL_META[c].label} <span className="text-[10px] font-medium">soon</span>
            </span>
          ))}
        </div>
        <button type="button" onClick={onEdit} className="inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs font-bold transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <Pencil className="size-3.5" aria-hidden /> Edit
        </button>
      </div>
    </motion.article>
  );
}
