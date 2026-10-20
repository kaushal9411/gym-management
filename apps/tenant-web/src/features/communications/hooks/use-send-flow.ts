'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { notifyProgrammaticNavigation } from '@/components/navigation-progress-provider';
import { CAMPAIGN_PLACEHOLDERS, COMMUNICATIONS_ROUTES, TEST_CHANNELS } from '../constants';
import { cleanFilter, composerToCampaignInput, pickedIds, scheduledIso, snapshot, type ComposerState } from '../lib/composer';
import { classifyError, type CommsError } from '../lib/errors';
import { validateMessage } from '../lib/message';
import { firstInvalid, FIELD_FOCUS_ID, validateComposer, type ComposerErrors } from '../lib/validate-composer';
import type { AudiencePreview, CampaignPatch, CampaignStatus, Channel, DisabledReason, SendMode, TestSendResult } from '../types';
import { useCreateCampaign, useSendDraft, useTestSend, useUpdateCampaign } from './use-communications';

export type Busy = null | 'send' | 'draft' | 'test';
export interface EditingTarget {
  id: string;
  status: CampaignStatus;
}

function newKey(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `k-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function focusField(field: keyof ComposerErrors) {
  const el = document.getElementById(FIELD_FOCUS_ID[field]);
  if (!el) return;
  el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  const target = el.matches('input,textarea,select,button') ? el : (el.querySelector<HTMLElement>('button,input,textarea,select') ?? el);
  (target as HTMLElement).focus({ preventScroll: true });
}

function toPatch(s: ComposerState, confirm: boolean): CampaignPatch {
  const patch: CampaignPatch = {
    title: s.title.trim(),
    body: s.body.trim(),
    channels: s.channels,
    audienceMode: s.mode,
    templateKey: s.templateKey,
    holdQuietHours: s.holdQuietHours,
    ...(s.mode === 'PICKED' ? { pickedMemberIds: pickedIds(s), audienceFilter: {} } : { audienceFilter: cleanFilter(s.filter) }),
  };
  const at = scheduledIso(s);
  if (at) patch.scheduledAt = at;
  if (confirm) patch.confirmLargeSend = true;
  return patch;
}

interface Args {
  state: ComposerState;
  preview: AudiencePreview | undefined;
  unavailable: Partial<Record<Channel, DisabledReason>>;
  editing: EditingTarget | null;
  onSaved: (draft: EditingTarget) => void;
  allowNavigation: () => void;
  markClean: () => void;
}

/**
 * The submit side of the Send message page: validation, confirm-large-send, one Idempotency-Key per send press,
 * draft save, test-send, and mapping every failure to a structured `CommsError` (banner + field errors + dialogs).
 */
export function useSendFlow({ state, preview, unavailable, editing, onSaved, allowNavigation, markClean }: Args) {
  const router = useRouter();
  const createCampaign = useCreateCampaign();
  const updateCampaign = useUpdateCampaign();
  const sendDraft = useSendDraft();
  const testSend = useTestSend();

  const [busy, setBusy] = React.useState<Busy>(null);
  const [submitted, setSubmitted] = React.useState(false);
  const [error, setError] = React.useState<(CommsError & { forSnapshot: string }) | null>(null);
  const [testResult, setTestResult] = React.useState<TestSendResult | null>(null);
  const [confirm, setConfirm] = React.useState<{ count: number; threshold: number } | null>(null);
  const busyRef = React.useRef(false); // synchronous double-submit guard (state lags a frame)
  const keyRef = React.useRef<{ sig: string; key: string } | null>(null);
  const lastAction = React.useRef<(() => void) | null>(null);

  const snap = snapshot(state);
  const localErrors = React.useMemo(() => validateComposer(state, CAMPAIGN_PLACEHOLDERS, { unavailable }), [state, unavailable]);
  // Server field errors apply only to the exact content that produced them.
  const activeError = error && error.forSnapshot === snap ? error : null;
  const errors: ComposerErrors = { ...(submitted ? localErrors : {}), ...(activeError?.fieldErrors ?? {}) } as ComposerErrors;

  const fail = (e: unknown): CommsError => {
    const c = classifyError(e);
    setError({ ...c, forSnapshot: snap });
    if (c.kind === 'confirmation' && c.confirm) setConfirm({ count: c.confirm.recipientCount || preview?.total || 0, threshold: c.confirm.threshold });
    return c;
  };

  const finishNavigate = (id: string, message: string) => {
    toast.success(message);
    allowNavigation();
    notifyProgrammaticNavigation(COMMUNICATIONS_ROUTES.history);
    router.push(`${COMMUNICATIONS_ROUTES.history}?campaign=${id}`);
  };

  /** Runs `fn` exactly once at a time; the ref blocks a second click before React re-renders the disabled button. */
  const run = async (kind: Exclude<Busy, null>, fn: () => Promise<void>) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(kind);
    setError(null);
    try {
      await fn();
    } finally {
      busyRef.current = false;
      setBusy(null);
    }
  };

  const submitSend = (confirmLargeSend: boolean) =>
    run('send', async () => {
      const mode: SendMode = state.scheduleOn ? 'SCHEDULE' : 'NOW';
      try {
        if (editing?.status === 'SCHEDULED') {
          const c = await updateCampaign.mutateAsync({ id: editing.id, patch: toPatch(state, confirmLargeSend) });
          finishNavigate(c.id, 'Changes saved. The message stays scheduled.');
          return;
        }
        if (editing?.status === 'DRAFT') {
          await updateCampaign.mutateAsync({ id: editing.id, patch: toPatch(state, confirmLargeSend) });
          const c = await sendDraft.mutateAsync({ id: editing.id, confirmLargeSend });
          finishNavigate(c.id, `Sending to ${c.recipientCount.toLocaleString('en-IN')} members.`);
          return;
        }
        const input = composerToCampaignInput(state, mode, confirmLargeSend);
        const sig = JSON.stringify(input);
        // Same payload after an ambiguous failure (e.g. network) reuses the key, so a retry can never double-send.
        if (keyRef.current?.sig !== sig) keyRef.current = { sig, key: newKey() };
        const c = await createCampaign.mutateAsync({ input, idempotencyKey: keyRef.current.key });
        keyRef.current = null;
        finishNavigate(c.id, mode === 'SCHEDULE' ? 'Scheduled. You can cancel it from History until it starts.' : `Sending to ${c.recipientCount.toLocaleString('en-IN')} members.`);
      } catch (e) {
        const c = fail(e);
        // A definite server answer ends the attempt; only a lost connection keeps the key for the retry.
        if (c.kind !== 'network') keyRef.current = null;
        if (c.kind === 'conflict') toast.error(c.message);
      }
    });

  const validateForSend = (): boolean => {
    setSubmitted(true);
    setTestResult(null);
    const errs = validateComposer(state, CAMPAIGN_PLACEHOLDERS, { unavailable });
    const first = firstInvalid(errs);
    if (first) {
      setError(null);
      focusField(first);
      toast.error('Please fix the highlighted fields.');
      return false;
    }
    return true;
  };

  const send = () => {
    lastAction.current = send;
    if (busyRef.current || !validateForSend()) return;
    if (preview && preview.total === 0) {
      setError({ ...classifyError(null), kind: 'audience-empty', message: 'Nobody matches this audience right now.', fieldErrors: { audience: 'Nobody matches this audience right now. Change the filters or pick members.' }, forSnapshot: snap });
      focusField('audience');
      return;
    }
    if (preview?.largeSend) {
      setConfirm({ count: preview.total, threshold: preview.largeSendThreshold });
      return;
    }
    void submitSend(false);
  };

  const acceptConfirm = () => {
    setConfirm(null);
    // Retrying after a failure re-runs the confirmed send directly (no second confirmation).
    lastAction.current = () => void submitSend(true);
    void submitSend(true);
  };

  /** Resolves true once the draft is stored (so "save and leave" can continue). */
  const saveDraft = async (): Promise<boolean> => {
    lastAction.current = () => void saveDraft();
    if (busyRef.current) return false;
    setSubmitted(true);
    setTestResult(null);
    const errs = validateComposer(state, CAMPAIGN_PLACEHOLDERS, { unavailable, scheduling: false });
    const first = firstInvalid(errs);
    if (first) {
      focusField(first);
      toast.error('Please fix the highlighted fields.');
      return false;
    }
    let saved = false;
    await run('draft', async () => {
      try {
        if (editing) {
          await updateCampaign.mutateAsync({ id: editing.id, patch: toPatch({ ...state, scheduleOn: false }, false) });
          toast.success('Draft saved.');
        } else {
          const input = composerToCampaignInput({ ...state, scheduleOn: false }, 'DRAFT', false);
          const c = await createCampaign.mutateAsync({ input, idempotencyKey: newKey() });
          toast.success('Draft saved. Find it under History.');
          onSaved({ id: c.id, status: c.status });
        }
        markClean();
        saved = true;
      } catch (e) {
        fail(e);
      }
    });
    return saved;
  };

  const test = () => {
    lastAction.current = test;
    if (busyRef.current) return;
    setSubmitted(true);
    const m = validateMessage({ title: state.title, body: state.body, channels: state.channels }, CAMPAIGN_PLACEHOLDERS);
    if (m.title || m.body) {
      focusField(m.title ? 'title' : 'body');
      toast.error('Fix the message first, then send a test.');
      return;
    }
    const channels = state.channels.filter((c): c is Exclude<Channel, 'IN_APP'> => TEST_CHANNELS.includes(c) && !unavailable[c]);
    if (channels.length === 0) {
      setError({
        ...classifyError(null),
        kind: 'validation',
        message: 'A test goes to your own email, phone or app. Select Push, Email, SMS or WhatsApp (In-app is for members only).',
        fieldErrors: {},
        forSnapshot: snap,
      });
      return;
    }
    void run('test', async () => {
      try {
        const r = await testSend.mutateAsync({ title: state.title.trim(), body: state.body.trim(), channels });
        setTestResult(r);
        const sent = r.results.filter((x) => x.status === 'QUEUED').length;
        if (sent) toast.success(`Test sent on ${sent} channel${sent === 1 ? '' : 's'}.`);
        else toast.warning('No test went out. See the details below the buttons.');
      } catch (e) {
        fail(e);
      }
    });
  };

  return {
    busy,
    errors,
    submitted,
    banner: activeError,
    dismissBanner: () => setError(null),
    retry: () => lastAction.current?.(),
    testResult,
    clearTestResult: () => setTestResult(null),
    confirm,
    cancelConfirm: () => setConfirm(null),
    acceptConfirm,
    send,
    saveDraft,
    test,
  };
}
