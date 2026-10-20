'use client';

import * as React from 'react';
import { FlaskConical, Plus, RotateCcw, X } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { LoadingButton } from '@/components/ui/loading-button';
import { cn } from '@/lib/utils';
import { BODY_MAX, CHANNEL_META, DISABLED_REASON_COPY, PLACEHOLDER_HINT, TEST_CHANNELS, TITLE_MAX } from '../../constants';
import { useTestAutomation, useUpdateAutomation } from '../../hooks/use-communications';
import { describeTiming, draftChanged, draftFromRule, overrideText, timingUnitWord, validateRuleDraft, type RuleDraft } from '../../lib/automations';
import { classifyError } from '../../lib/errors';
import type { AutomationRule, Channel, TestSendResult } from '../../types';
import { Banner, ChannelDot, CommsSwitch, FieldError } from '../common';
import { TestResults } from '../send/send-actions';

/** Side sheet to edit one rule: enabled, timing chips, channels, custom text (placeholders), save and test-send. */
export function RuleEditor({ rule, canManage, onClose }: { rule: AutomationRule | null; canManage: boolean; onClose: () => void }) {
  return (
    <Drawer open={rule !== null} onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <DrawerContent className="w-full overflow-y-auto sm:max-w-xl" aria-describedby={undefined}>
        {rule ? <EditorBody key={rule.key} rule={rule} canManage={canManage} onClose={onClose} /> : null}
      </DrawerContent>
    </Drawer>
  );
}

function EditorBody({ rule, canManage, onClose }: { rule: AutomationRule; canManage: boolean; onClose: () => void }) {
  const save = useUpdateAutomation();
  const test = useTestAutomation();
  const [draft, setDraft] = React.useState<RuleDraft>(() => draftFromRule(rule));
  const [offsetText, setOffsetText] = React.useState('');
  const [offsetError, setOffsetError] = React.useState<string>();
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [serverFields, setServerFields] = React.useState<Record<string, string>>({});
  const [result, setResult] = React.useState<TestSendResult | null>(null);
  const [submitted, setSubmitted] = React.useState(false);
  const lastField = React.useRef<'title' | 'body'>('body');
  const titleRef = React.useRef<HTMLInputElement>(null);
  const bodyRef = React.useRef<HTMLTextAreaElement>(null);

  const errors = validateRuleDraft(rule, draft);
  const changed = draftChanged(rule, draft);
  const readOnly = !canManage;
  const unit = timingUnitWord(rule.timing.unit);
  const shown = (k: keyof typeof errors) => serverFields[k] ?? (submitted ? errors[k] : undefined);

  const patch = (p: Partial<RuleDraft>) => {
    setDraft((d) => ({ ...d, ...p }));
    setServerFields({});
    setServerError(null);
  };

  const addOffset = () => {
    const n = Number(offsetText);
    const t = rule.timing;
    if (!/^\d+$/.test(offsetText)) return setOffsetError('Enter a whole number.');
    if (n < t.min || n > t.max) return setOffsetError(`Enter a number from ${t.min} to ${t.max}.`);
    if (draft.offsets.includes(n)) return setOffsetError(`${n} is already added.`);
    if (draft.offsets.length >= t.maxCount) return setOffsetError(`You can add up to ${t.maxCount}.`);
    setOffsetError(undefined);
    setOffsetText('');
    patch({ offsets: [...draft.offsets, n] });
  };

  const insert = (token: string) => {
    const f = lastField.current;
    const el = f === 'title' ? titleRef.current : bodyRef.current;
    const value = f === 'title' ? draft.title : draft.body;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? start;
    patch({ [f]: `${value.slice(0, start)}${token}${value.slice(end)}` } as Partial<RuleDraft>);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const onSave = () => {
    setSubmitted(true);
    if (Object.keys(errors).length) {
      toast.error('Please fix the highlighted fields.');
      return;
    }
    save.mutate(
      {
        key: rule.key,
        input: {
          enabled: draft.enabled,
          channels: draft.channels,
          ...(rule.timing.editable ? { offsets: draft.offsets } : {}),
          title: overrideText(draft.title, rule.defaultTitle),
          body: overrideText(draft.body, rule.defaultBody),
        },
      },
      {
        onSuccess: () => {
          toast.success(`${rule.label} saved.`);
          onClose();
        },
        onError: (err) => {
          const e = classifyError(err);
          setServerFields(e.fieldErrors as Record<string, string>);
          setServerError(Object.keys(e.fieldErrors).length ? null : e.message);
          if (e.kind === 'network' || e.kind === 'server' || e.kind === 'rate-limit' || e.kind === 'forbidden') toast.error(e.message);
        },
      },
    );
  };

  const onTest = () => {
    setResult(null);
    const channels = rule.channels.filter((c) => TEST_CHANNELS.includes(c));
    if (channels.length === 0) {
      setServerError('A test goes to your own email, phone or app. Add Push, Email, SMS or WhatsApp to this rule and save first.');
      return;
    }
    test.mutate(
      { key: rule.key, channels },
      {
        onSuccess: (r) => setResult(r),
        onError: (err) => {
          const e = classifyError(err);
          setServerError(e.message);
        },
      },
    );
  };

  const resetText = () => patch({ title: rule.defaultTitle, body: rule.defaultBody });
  const usingDefault = draft.title.trim() === rule.defaultTitle.trim() && draft.body.trim() === rule.defaultBody.trim();

  return (
    <>
      <DrawerHeader>
        <DrawerTitle>{rule.label}</DrawerTitle>
        <DrawerDescription>{rule.description}</DrawerDescription>
        <p className="text-xs text-muted-foreground">
          {rule.kind === 'TRANSACTIONAL' ? "This reminder is about the member's own membership, payments or bookings, so it is always delivered even if they opted out of promotions." : "Members who opted out of promotions on a channel don't get this on that channel."}
        </p>
      </DrawerHeader>

      {readOnly ? <Banner tone="info">You can view this rule. Changing it needs the Manage notifications permission.</Banner> : null}
      {serverError ? <Banner title="Couldn't save">{serverError}</Banner> : null}

      <div className="flex items-center justify-between gap-3 rounded-xl border bg-muted/40 px-3.5 py-1.5">
        <div>
          <b className="text-sm">Send this automatically</b>
          <p className="text-xs text-muted-foreground">{draft.enabled ? 'On' : 'Off'}</p>
        </div>
        <CommsSwitch label={`${rule.label} on or off`} checked={draft.enabled} disabled={readOnly || save.isPending} onChange={(v) => patch({ enabled: v })} />
      </div>

      <section aria-labelledby="re-timing">
        <h4 id="re-timing" className="mb-1.5 text-sm font-bold">When</h4>
        {rule.timing.editable ? (
          <>
            <p className="mb-2 text-[13px] text-muted-foreground">{describeTiming(rule, draft.offsets)}</p>
            <div className="mb-2 flex flex-wrap gap-1.5" aria-live="polite">
              {[...draft.offsets].sort((a, b) => b - a).map((n) => (
                <span key={n} className="inline-flex min-h-9 items-center gap-1 rounded-full bg-primary/10 py-1 pl-3 pr-1.5 text-[13px] font-bold text-primary">
                  {n} {unit}
                  {!readOnly ? (
                    <button type="button" aria-label={`Remove ${n} ${unit}`} onClick={() => patch({ offsets: draft.offsets.filter((x) => x !== n) })} className="grid size-6 place-items-center rounded-full bg-primary text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      <X className="size-3" aria-hidden />
                    </button>
                  ) : null}
                </span>
              ))}
            </div>
            {!readOnly ? (
              <div className="flex flex-wrap items-center gap-2">
                <label htmlFor="re-offset" className="sr-only">
                  Add a timing in {unit}
                </label>
                <input
                  id="re-offset"
                  inputMode="numeric"
                  value={offsetText}
                  placeholder={`${unit}`}
                  aria-invalid={!!offsetError}
                  aria-describedby="re-offset-hint"
                  onChange={(e) => {
                    setOffsetText(e.target.value.replace(/\D/g, '').slice(0, 3));
                    setOffsetError(undefined);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addOffset();
                    }
                  }}
                  className="h-11 w-24 rounded-lg border border-input bg-background px-3 text-sm tabular-nums aria-invalid:border-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 sm:h-10"
                />
                <Button type="button" variant="outline" className="min-h-11 sm:min-h-10" onClick={addOffset} disabled={draft.offsets.length >= rule.timing.maxCount}>
                  <Plus className="size-4" aria-hidden /> Add
                </Button>
                <span id="re-offset-hint" className="text-xs text-muted-foreground">
                  {rule.timing.min} to {rule.timing.max} {unit}, up to {rule.timing.maxCount}
                </span>
              </div>
            ) : null}
            <FieldError id="re-offset-err">{offsetError ?? shown('offsets')}</FieldError>
          </>
        ) : (
          <p className="text-[13px] text-muted-foreground">{rule.description} The timing is fixed for this rule.</p>
        )}
      </section>

      <section aria-labelledby="re-channels">
        <h4 id="re-channels" className="mb-1.5 text-sm font-bold">Channels</h4>
        <div className="flex flex-wrap gap-1.5" role="group" aria-labelledby="re-channels">
          {rule.allowedChannels.map((c: Channel) => {
            const on = draft.channels.includes(c);
            const bad = rule.unavailableChannels.find((u) => u.channel === c);
            return (
              <button
                key={c}
                type="button"
                aria-pressed={on}
                disabled={readOnly}
                onClick={() => patch({ channels: on ? draft.channels.filter((x) => x !== c) : [...draft.channels, c] })}
                className={cn(
                  'inline-flex min-h-11 items-center gap-2 rounded-full border px-3 text-[13px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-9',
                  on ? 'border-primary bg-primary/10' : 'bg-muted/50 hover:bg-accent',
                )}
              >
                <ChannelDot channel={c} size="sm" />
                {CHANNEL_META[c].label}
                {bad && on ? <span className="text-[11px] font-medium text-warning-foreground">({DISABLED_REASON_COPY[bad.reason].toLowerCase()})</span> : null}
              </button>
            );
          })}
        </div>
        <FieldError id="re-ch-err">{shown('channels')}</FieldError>
        {rule.unavailableChannels.some((u) => draft.channels.includes(u.channel)) ? <p className="mt-1.5 text-xs text-muted-foreground">Channels marked above cannot send right now. You can still save; those messages are skipped until they are available.</p> : null}
      </section>

      <section aria-labelledby="re-text">
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <h4 id="re-text" className="text-sm font-bold">Message text</h4>
          {!usingDefault ? (
            <Button type="button" variant="ghost" size="sm" disabled={readOnly} onClick={resetText}>
              <RotateCcw className="size-3.5" aria-hidden /> Use default text
            </Button>
          ) : (
            <span className="text-xs text-muted-foreground">Using default text</span>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between">
            <label htmlFor="re-title" className="text-[13px] font-semibold">Title</label>
            <span className={cn('text-xs tabular-nums', draft.title.length > TITLE_MAX ? 'font-bold text-destructive' : 'text-muted-foreground')}>{draft.title.length} / {TITLE_MAX}</span>
          </div>
          <input
            id="re-title"
            ref={titleRef}
            type="text"
            disabled={readOnly}
            value={draft.title}
            placeholder={rule.defaultTitle}
            aria-invalid={!!shown('title')}
            aria-describedby={shown('title') ? 're-title-err' : undefined}
            onFocus={() => (lastField.current = 'title')}
            onChange={(e) => patch({ title: e.target.value })}
            className="h-11 w-full rounded-[10px] border border-input bg-background px-3 text-sm placeholder:text-muted-foreground/70 aria-invalid:border-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-60 sm:h-10"
          />
          <FieldError id="re-title-err">{shown('title')}</FieldError>
        </div>
        <div className="mt-3 flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between">
            <label htmlFor="re-body" className="text-[13px] font-semibold">Message</label>
            <span className={cn('text-xs tabular-nums', draft.body.length > BODY_MAX ? 'font-bold text-destructive' : 'text-muted-foreground')}>{draft.body.length} / {BODY_MAX}</span>
          </div>
          <textarea
            id="re-body"
            ref={bodyRef}
            rows={4}
            disabled={readOnly}
            value={draft.body}
            placeholder={rule.defaultBody}
            aria-invalid={!!shown('body')}
            aria-describedby={shown('body') ? 're-body-err' : undefined}
            onFocus={() => (lastField.current = 'body')}
            onChange={(e) => patch({ body: e.target.value })}
            className="w-full resize-y rounded-[10px] border border-input bg-background px-3 py-2.5 text-sm placeholder:text-muted-foreground/70 aria-invalid:border-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-60"
          />
          <FieldError id="re-body-err">{shown('body')}</FieldError>
        </div>
        {!readOnly ? (
          <div className="mt-2 flex flex-wrap items-center gap-1.5" role="group" aria-label="Insert a placeholder">
            <span className="mr-1 text-[12.5px] text-muted-foreground">Insert:</span>
            {rule.allowedPlaceholders.map((p) => (
              <button
                key={p}
                type="button"
                title={PLACEHOLDER_HINT[p]}
                aria-label={`Insert ${p}${PLACEHOLDER_HINT[p] ? `: ${PLACEHOLDER_HINT[p]}` : ''}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => insert(`{{${p}}}`)}
                className="min-h-9 rounded-md bg-primary/10 px-2.5 font-mono text-xs text-primary hover:bg-primary/16 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-7"
              >{`{{${p}}}`}</button>
            ))}
          </div>
        ) : null}
        <p className="mt-2 text-xs text-muted-foreground">Leave both blank to use the standard wording.</p>
      </section>

      {result ? <TestResults result={result} /> : null}

      <div className="mt-auto flex flex-col gap-2 border-t pt-3 sm:flex-row sm:justify-between">
        {canManage ? (
          <LoadingButton type="button" variant="outline" className="min-h-11" loading={test.isPending} loadingText="Sending test…" disabled={changed || save.isPending} onClick={onTest} title={changed ? 'Save your changes first: the test uses the saved rule.' : undefined}>
            <FlaskConical className="size-4" aria-hidden /> Test to me
          </LoadingButton>
        ) : <span />}
        <div className="flex gap-2">
          <Button type="button" variant="ghost" className="min-h-11" onClick={onClose} disabled={save.isPending}>
            {readOnly ? 'Close' : 'Cancel'}
          </Button>
          {canManage ? (
            <LoadingButton type="button" className="min-h-11" loading={save.isPending} loadingText="Saving…" disabled={!changed} onClick={onSave}>
              Save changes
            </LoadingButton>
          ) : null}
        </div>
      </div>
      {canManage && changed ? <p className="-mt-1 text-xs text-muted-foreground">Test uses the saved rule, so save first.</p> : null}
    </>
  );
}
