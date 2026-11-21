'use client';

import * as React from 'react';
import { RotateCcw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Chip } from '@/features/dashboard/components/ui';
import { FIELD, Field, TEXTAREA, fmtDateTime } from '@/features/shell/components/page-kit';
import { cn } from '@/lib/utils';
import type { SystemSetting } from '../types';
import { maskSecrets, stable, toObject, unmaskSecrets, type SettingField, type SettingMeta, type SettingObject } from '../config/schema';
import { SecretField, ToggleSwitch } from './controls';

const asText = (v: unknown) => (typeof v === 'string' ? v : v == null ? '' : String(v));

/**
 * One setting as a labelled-field form (fields come from KNOWN_SETTINGS). The draft is the FULL object, so keys the
 * schema doesn't know about are carried through untouched. "Advanced: edit as JSON" is the collapsed escape hatch;
 * stored secrets are masked there too. The page remounts the card (via `key`) after a save / revert to reset local UI state.
 */
export function SettingCard({
  meta, stored, draft, dirty, canManage, saving, onChange, onJsonInvalid, onRevert, onSave,
}: {
  meta: SettingMeta;
  stored: SystemSetting | undefined;
  draft: SettingObject | undefined;
  dirty: boolean;
  canManage: boolean;
  saving: boolean;
  onChange: (next: SettingObject) => void;
  onJsonInvalid: (bad: boolean) => void;
  onRevert: () => void;
  onSave: () => void;
}) {
  const base = React.useMemo(() => toObject(stored?.value), [stored]);
  const cur = draft ?? base;
  const [jsonText, setJsonText] = React.useState<string | null>(null);
  const [jsonBad, setJsonBad] = React.useState(false);
  const idOf = (f: SettingField) => `set-${meta.key}-${f.key}`;

  const setField = (key: string, value: unknown) => {
    const next = { ...cur };
    if (value === undefined) delete next[key]; else next[key] = value;
    setJsonText(null);
    setJsonBad(false);
    onJsonInvalid(false);
    onChange(next);
  };

  const onJsonChange = (text: string) => {
    setJsonText(text);
    try {
      const parsed: unknown = text.trim() ? JSON.parse(text) : {};
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) throw new Error('not an object');
      setJsonBad(false);
      onJsonInvalid(false);
      onChange(unmaskSecrets(parsed as SettingObject, base, meta.fields));
    } catch {
      setJsonBad(true);
      onJsonInvalid(true);
    }
  };

  const renderControl = (f: SettingField) => {
    const id = idOf(f);
    const v = cur[f.key];
    switch (f.type) {
      case 'boolean':
        return <ToggleSwitch id={id} label={f.label} checked={v === true} disabled={!canManage} onChange={(checked) => setField(f.key, checked)} />;
      case 'number':
        return (
          <input
            id={id} type="number" inputMode="numeric" className={FIELD} placeholder={f.placeholder} disabled={!canManage}
            value={asText(v)}
            onChange={(e) => setField(f.key, e.target.value === '' ? undefined : Number(e.target.value))}
          />
        );
      case 'select': {
        const options = f.options ?? [];
        const current = asText(v);
        const extra = current && !options.some((o) => o.value === current) ? [{ value: current, label: current }] : [];
        return (
          <select id={id} className={FIELD} value={current} disabled={!canManage} onChange={(e) => setField(f.key, e.target.value === '' ? undefined : e.target.value)}>
            <option value="">Select…</option>
            {[...options, ...extra].map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        );
      }
      case 'textarea':
        return <textarea id={id} rows={3} className={TEXTAREA} placeholder={f.placeholder} disabled={!canManage} value={asText(v)} onChange={(e) => setField(f.key, e.target.value === '' ? undefined : e.target.value)} />;
      case 'secret': {
        const storedSecret = base[f.key];
        const hasStored = typeof storedSecret === 'string' && storedSecret !== '';
        const typed = typeof v === 'string' && v !== storedSecret ? v : '';
        return (
          <SecretField
            id={id} hasStored={hasStored} savedLabel="•••••• saved" value={typed} disabled={!canManage}
            onChange={(next) => setField(f.key, next === '' ? (hasStored ? storedSecret : undefined) : next)}
          />
        );
      }
      default:
        return <input id={id} type="text" className={FIELD} placeholder={f.placeholder} disabled={!canManage} value={asText(v)} onChange={(e) => setField(f.key, e.target.value === '' ? undefined : e.target.value)} />;
    }
  };

  const jsonValue = jsonText ?? JSON.stringify(maskSecrets(cur, meta.fields), null, 2);

  return (
    <div className={cn('min-w-0 space-y-3 rounded-xl border p-3', dirty && 'border-amber-400/60')}>
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold">{meta.label}</h3>
          <Chip tone={stored ? 'green' : 'slate'}>{stored ? 'Configured' : 'Not configured'}</Chip>
          {dirty ? <Chip tone="amber">Unsaved</Chip> : null}
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">{meta.description}</p>
      </div>

      <div className="space-y-3">
        {meta.fields.map((f) => (
          f.type === 'boolean' ? (
            <div key={f.key} className="flex items-center justify-between gap-3">
              <label htmlFor={idOf(f)} className="min-w-0 text-[13px] font-medium">
                {f.label}
                {f.help ? <span className="block text-xs font-normal text-muted-foreground">{f.help}</span> : null}
              </label>
              {renderControl(f)}
            </div>
          ) : (
            <Field key={f.key} label={f.label} htmlFor={idOf(f)} hint={f.help}>{renderControl(f)}</Field>
          )
        ))}
      </div>

      <details className="rounded-lg border bg-muted/20 px-3 py-2 text-xs">
        <summary className="cursor-pointer select-none font-medium text-muted-foreground">Advanced: edit as JSON</summary>
        <div className="mt-2 space-y-1.5">
          <textarea
            id={`set-${meta.key}-json`}
            aria-label={`${meta.label} JSON`}
            className={cn(TEXTAREA, 'h-32 font-mono text-xs', jsonBad && 'border-destructive')}
            value={jsonValue}
            disabled={!canManage}
            spellCheck={false}
            aria-invalid={jsonBad}
            onChange={(e) => onJsonChange(e.target.value)}
          />
          {jsonBad ? <p className="text-xs text-destructive">Must be a valid JSON object.</p> : <p className="text-muted-foreground">Saved secrets show as {'••••••'}; leave them as is to keep them.</p>}
        </div>
      </details>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">{stored ? `Updated ${fmtDateTime(stored.updatedAt)}` : 'Not configured yet'}</p>
        <div className="flex gap-1.5">
          {dirty ? (
            <Button size="sm" variant="ghost" aria-label={`Revert ${meta.label}`} onClick={onRevert}><RotateCcw className="size-3.5" aria-hidden /></Button>
          ) : null}
          <Button size="sm" onClick={onSave} disabled={!canManage || saving || !dirty || jsonBad}>Save</Button>
        </div>
      </div>
    </div>
  );
}

/** True when the draft differs from what is stored. */
export const isDraftDirty = (draft: SettingObject | undefined, stored: SystemSetting | undefined) =>
  draft !== undefined && stable(draft) !== stable(toObject(stored?.value));
