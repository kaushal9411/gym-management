'use client';

import * as React from 'react';

import { Select } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { BODY_MAX, CAMPAIGN_PLACEHOLDERS, PLACEHOLDER_HINT, TEMPLATES, TEMPLATE_GROUPS, TITLE_MAX } from '../../constants';
import { estimateSms } from '../../lib/message';
import type { ComposerState } from '../../lib/composer';
import { useCommunicationTemplates } from '../../hooks/use-communications';
import type { TemplateKey } from '../../types';
import { FieldError } from '../common';
import { StepCard } from './step-card';

function Counter({ used, max, id }: { used: number; max: number; id: string }) {
  const over = used > max;
  return (
    <span id={id} className={cn('text-xs tabular-nums', over ? 'font-bold text-destructive' : 'text-muted-foreground')}>
      {used.toLocaleString('en-IN')} / {max.toLocaleString('en-IN')}
      {over ? ` (${(used - max).toLocaleString('en-IN')} too many)` : ''}
    </span>
  );
}

const FIELD_CLASS =
  'w-full rounded-[10px] border border-input bg-background px-3 py-2.5 text-sm placeholder:text-muted-foreground/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:border-ring aria-invalid:border-destructive aria-invalid:focus-visible:ring-destructive/30 disabled:cursor-not-allowed disabled:opacity-60';

/** Step 2: template, title, message, insertable placeholders (only the ones the API accepts) and live counters. */
export function MessageStep({
  state,
  onPatch,
  errors,
  smsSelected,
  disabled,
}: {
  state: ComposerState;
  onPatch: (patch: Partial<ComposerState>) => void;
  /** Already filtered by the parent to what should be visible now (after blur / failed submit). */
  errors: { title?: string; body?: string };
  smsSelected: boolean;
  disabled?: boolean;
}) {
  const titleRef = React.useRef<HTMLInputElement>(null);
  const bodyRef = React.useRef<HTMLTextAreaElement>(null);
  const lastField = React.useRef<'title' | 'body'>('body');

  const insert = (token: string) => {
    const field = lastField.current;
    const el = field === 'title' ? titleRef.current : bodyRef.current;
    const value = field === 'title' ? state.title : state.body;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? start;
    const next = `${value.slice(0, start)}${token}${value.slice(end)}`;
    onPatch(field === 'title' ? { title: next, templateKey: 'CUSTOM' } : { body: next, templateKey: 'CUSTOM' });
    const caret = start + token.length;
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(caret, caret);
    });
  };

  const templates = useCommunicationTemplates(!disabled);
  const synced = templates.data?.find((t) => t.title === state.title && t.body === state.body);

  const sms = smsSelected ? estimateSms(`${state.title.trim()}\n${state.body.trim()}`) : null;

  return (
    <StepCard n={2} id="step-message" title="What do you want to say?" sub="Start from a template or write your own. Placeholders are filled in for each person.">
      <div className="mb-3 flex flex-col gap-1.5">
        <label htmlFor="cm-template" className="text-[13px] font-semibold">
          Template
        </label>
        <Select
          id="cm-template"
          disabled={disabled}
          value={synced ? `SYNC:${synced.type}` : state.templateKey}
          onChange={(e) => {
            const picked = e.target.value.startsWith('SYNC:') ? templates.data?.find((x) => `SYNC:${x.type}` === e.target.value) : undefined;
            if (picked) {
              onPatch({ templateKey: 'CUSTOM', title: picked.title, body: picked.body });
              return;
            }
            const t = TEMPLATES.find((x) => x.key === (e.target.value as TemplateKey));
            onPatch(t?.title !== undefined ? { templateKey: t.key, title: t.title, body: t.body ?? '' } : { templateKey: 'CUSTOM' });
          }}
        >
          <option value="CUSTOM">Custom message</option>
          {templates.data?.length ? (
            <optgroup label="Your notification templates">
              {templates.data.map((t) => (
                <option key={t.type} value={`SYNC:${t.type}`}>
                  {t.label}
                </option>
              ))}
            </optgroup>
          ) : null}
          {TEMPLATE_GROUPS.map((g) => (
            <optgroup key={g} label={g}>
              {TEMPLATES.filter((t) => t.group === g).map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label}
                </option>
              ))}
            </optgroup>
          ))}
        </Select>
        <p className="text-xs text-muted-foreground">Offer templates are starting text. Add your real discount, dates and terms before sending.</p>
      </div>

      <div className="mb-3 flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between gap-2">
          <label htmlFor="cm-title" className="text-[13px] font-semibold">
            Title
          </label>
          <Counter id="cm-title-count" used={state.title.length} max={TITLE_MAX} />
        </div>
        <input
          id="cm-title"
          ref={titleRef}
          type="text"
          disabled={disabled}
          value={state.title}
          placeholder="Hi {{firstName}}, a quick note from {{gymName}}"
          aria-invalid={!!errors.title}
          aria-describedby={`cm-title-count${errors.title ? ' cm-title-err' : ''}`}
          onFocus={() => (lastField.current = 'title')}
          onChange={(e) => onPatch({ title: e.target.value, templateKey: 'CUSTOM' })}
          className={cn(FIELD_CLASS, 'h-11 sm:h-10')}
        />
        <FieldError id="cm-title-err">{errors.title}</FieldError>
      </div>

      <div className="mb-3 flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between gap-2">
          <label htmlFor="cm-body" className="text-[13px] font-semibold">
            Message
          </label>
          <Counter id="cm-body-count" used={state.body.length} max={BODY_MAX} />
        </div>
        <textarea
          id="cm-body"
          ref={bodyRef}
          disabled={disabled}
          rows={4}
          value={state.body}
          placeholder="Write the message members will read."
          aria-invalid={!!errors.body}
          aria-describedby={`cm-body-count${errors.body ? ' cm-body-err' : ''}${sms ? ' cm-sms-hint' : ''}`}
          onFocus={() => (lastField.current = 'body')}
          onChange={(e) => onPatch({ body: e.target.value, templateKey: 'CUSTOM' })}
          className={cn(FIELD_CLASS, 'min-h-[92px] resize-y')}
        />
        <FieldError id="cm-body-err">{errors.body}</FieldError>
        {sms && sms.characters > 0 ? (
          <p id="cm-sms-hint" className="text-xs text-muted-foreground">
            SMS: about {sms.characters.toLocaleString('en-IN')} characters, {sms.segments} message{sms.segments === 1 ? '' : 's'} per member
            {sms.unicode ? ' (special characters make each part shorter)' : ''}. Placeholders are counted as written and may be longer once filled in.
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Insert a placeholder">
        <span className="mr-1 text-[12.5px] text-muted-foreground">Insert:</span>
        {CAMPAIGN_PLACEHOLDERS.map((p) => (
          <button
            key={p}
            type="button"
            disabled={disabled}
            title={PLACEHOLDER_HINT[p]}
            aria-label={`Insert ${p}: ${PLACEHOLDER_HINT[p] ?? ''}`}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => insert(`{{${p}}}`)}
            className="min-h-9 rounded-md bg-primary/10 px-2.5 font-mono text-xs text-primary hover:bg-primary/16 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 sm:min-h-7 sm:px-2"
          >
            {`{{${p}}}`}
          </button>
        ))}
      </div>
    </StepCard>
  );
}
