'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Lock, PencilLine } from 'lucide-react';

import { Skeleton } from '@/components/ui/skeleton';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { EmptyState } from '@/features/reports/components/ui';
import { useTenant } from '@/features/tenant/tenant-provider';
import { COMMUNICATIONS_PERMISSIONS, COMMUNICATIONS_ROUTES, EDITABLE_STATUSES } from '../../constants';
import { useAudiencePreview, useCampaign, useCommunicationsOverview } from '../../hooks/use-communications';
import { useComposer } from '../../hooks/use-composer';
import { useLeaveGuard } from '../../hooks/use-leave-guard';
import { useSendFlow, type EditingTarget } from '../../hooks/use-send-flow';
import { activeFilterCount, campaignToComposer, INITIAL_COMPOSER, type ComposerState } from '../../lib/composer';
import { describeLoadError } from '../../lib/errors';
import { validateMessage } from '../../lib/message';
import { CAMPAIGN_PLACEHOLDERS } from '../../constants';
import type { Channel, DisabledReason } from '../../types';
import { Banner } from '../common';
import { AudienceStep } from './audience-step';
import { channelStates, ChannelsStep } from './channels-step';
import { MessageStep } from './message-step';
import { SendActions, SendErrorBanner, TestResults } from './send-actions';
import { ConfirmLargeSendDialog, LeaveDialog } from './send-dialogs';
import { PreviewBubble, RecipientsCard, UsageCard } from './summary-panel';

const fmt = (n: number) => n.toLocaleString('en-IN');

/** Permission wrapper: only `notifications:send` reaches the composer; everyone else gets an explanation, never a dead form. */
export function SendMessagePage() {
  const { hasPermission } = usePermissions();
  if (!hasPermission(COMMUNICATIONS_PERMISSIONS.send)) {
    return (
      <EmptyState
        icon={Lock}
        title="You can't send messages"
        description="Sending needs the Send notifications permission. You can still see what was sent under History and how reminders are set up under Automations. Ask your gym owner to grant access."
        action={
          <Link href={COMMUNICATIONS_ROUTES.history} className="text-sm font-semibold text-primary underline-offset-2 hover:underline">
            Open History
          </Link>
        }
        className="mt-6"
      />
    );
  }
  return <SendComposer />;
}

function initialState(params: URLSearchParams): ComposerState {
  const memberUuid = params.get('memberId');
  if (!memberUuid) return INITIAL_COMPOSER;
  return {
    ...INITIAL_COMPOSER,
    mode: 'PICKED',
    picked: { [memberUuid]: { id: memberUuid, memberId: params.get('code') ?? '', name: params.get('name') ?? 'Selected member' } },
  };
}

function SendComposer() {
  const router = useRouter();
  const params = useSearchParams();
  const tenant = useTenant();
  const editId = params.get('edit');

  const composer = useComposer(React.useMemo(() => initialState(params), [])); // eslint-disable-line react-hooks/exhaustive-deps -- seeded once from the URL
  const { state, actions, dirty } = composer;

  const [editing, setEditing] = React.useState<EditingTarget | null>(null);
  const [touched, setTouched] = React.useState({ title: false, body: false });
  const editQuery = useCampaign(editId && !editing ? editId : editId);
  const hydrated = React.useRef<string | null>(null);

  // Hydrate once from the stored campaign (not a mutation, so a plain once-guarded effect is fine here).
  React.useEffect(() => {
    const c = editQuery.data;
    if (!c || hydrated.current === c.id) return;
    hydrated.current = c.id;
    if (!EDITABLE_STATUSES.includes(c.status)) return;
    actions.load(campaignToComposer(c, c.pickedMemberIds));
    setEditing({ id: c.id, status: c.status });
  }, [editQuery.data, actions]);

  const overview = useCommunicationsOverview();
  const previewQuery = useAudiencePreview(composer.previewRequest);
  const preview = previewQuery.data;
  const states = React.useMemo(() => channelStates(overview.data?.channels, preview, state.channels), [overview.data, preview, state.channels]);
  const unavailable = React.useMemo(() => {
    const out: Partial<Record<Channel, DisabledReason>> = {};
    for (const [c, s] of Object.entries(states)) if (s.disabledReason) out[c as Channel] = s.disabledReason;
    return out;
  }, [states]);

  const guard = useLeaveGuard(dirty);
  const flow = useSendFlow({
    state,
    preview,
    unavailable,
    editing,
    onSaved: (draft) => {
      setEditing(draft);
      hydrated.current = draft.id;
      router.replace(`${COMMUNICATIONS_ROUTES.send}?edit=${draft.id}`);
    },
    allowNavigation: guard.allowNavigation,
    markClean: () => actions.markClean(state),
  });

  const none = state.mode === 'PICKED' && Object.keys(state.picked).length === 0;
  const total = none ? 0 : (preview?.total ?? 0);
  const overChannels = state.channels.filter((c) => states[c].short || states[c].disabledReason);
  const filterCount = activeFilterCount(state.filter);
  const msgErrors = validateMessage({ title: state.title, body: state.body, channels: state.channels }, CAMPAIGN_PLACEHOLDERS);
  const visibleErrors = {
    title: flow.errors.title ?? (touched.title || flow.submitted ? msgErrors.title : undefined),
    body: flow.errors.body ?? (touched.body || flow.submitted ? msgErrors.body : undefined),
  };

  // Mark title/body as touched once the user leaves them (inline validation after first blur).
  const onBlurCapture = (e: React.FocusEvent) => {
    const id = (e.target as HTMLElement).id;
    if (id === 'cm-title') setTouched((t) => ({ ...t, title: true }));
    if (id === 'cm-body') setTouched((t) => ({ ...t, body: true }));
  };

  let blocker: string | null = null;
  if (editQuery.isLoading && editId) blocker = 'Loading the saved message…';
  else if (editId && editQuery.data && !EDITABLE_STATUSES.includes(editQuery.data.status)) blocker = 'This message can no longer be edited.';
  else if (state.channels.length === 0) blocker = 'Choose at least one channel.';
  else if (none) blocker = 'Pick at least one member.';
  else if (previewQuery.isError) blocker = "Recipients couldn't be counted. Try again.";
  else if (!preview) blocker = 'Counting recipients…';
  else if (total === 0) blocker = 'Nobody matches yet. Change the filters.';
  else if (preview.exceedsMax) blocker = `Narrow the audience to ${fmt(preview.maxRecipients)} members or fewer.`;
  else if (overChannels.length) blocker = 'Turn off the channels marked in red, or narrow the audience.';

  const scheduled = state.scheduleOn;
  const sendLabel = editing?.status === 'SCHEDULED' ? 'Save changes' : `${scheduled ? 'Schedule for' : 'Send to'} ${fmt(total)} ${total === 1 ? 'member' : 'members'}`;
  const channelError = flow.errors.channels ?? (flow.submitted && state.channels.length === 0 ? 'Choose at least one channel.' : undefined);

  const stale = composer.previewSettling || (previewQuery.isFetching && !previewQuery.isLoading);

  return (
    <div onBlurCapture={onBlurCapture}>
      {editId ? <EditBanner query={editQuery} editing={editing} /> : null}
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_330px]">
        <div className="flex min-w-0 flex-col gap-4">
          <AudienceStep
            state={state}
            onMode={(mode) => actions.patch({ mode })}
            onFilter={actions.filter}
            onPick={actions.pick}
            onUnpick={actions.unpick}
            onClearPicked={actions.clearPicked}
            error={flow.errors.audience}
          />
          <MessageStep state={state} onPatch={actions.patch} errors={visibleErrors} smsSelected={state.channels.includes('SMS')} />
          <ChannelsStep
            state={state}
            states={states}
            onToggle={actions.toggleChannel}
            onPatch={actions.patch}
            channelError={channelError}
            scheduleError={flow.errors.scheduledAt}
            scheduleLocked={editing?.status === 'DRAFT' ? 'This draft can be sent now or saved. To schedule it, create a new scheduled message.' : undefined}
          />
        </div>

        <aside aria-label="Summary" className="flex min-w-0 flex-col gap-3.5 lg:sticky lg:top-20">
          <RecipientsCard
            state={state}
            filterCount={filterCount}
            preview={{ data: none ? undefined : preview, isLoading: previewQuery.isLoading, isError: previewQuery.isError, error: previewQuery.error, refetch: () => void previewQuery.refetch(), stale }}
          />
          <UsageCard
            state={state}
            states={states}
            preview={{ data: preview, isLoading: previewQuery.isLoading, isError: previewQuery.isError, error: previewQuery.error, refetch: () => void previewQuery.refetch(), stale }}
          />
          <PreviewBubble title={state.title} body={state.body} gymName={tenant.name} />
          {flow.banner && flow.banner.kind !== 'confirmation' ? <SendErrorBanner error={flow.banner} onRetry={flow.retry} retrying={flow.busy !== null} /> : null}
          <SendActions
            label={sendLabel}
            busy={flow.busy}
            blocker={blocker}
            canDraft={editing?.status !== 'SCHEDULED'}
            onSend={flow.send}
            onDraft={() => void flow.saveDraft()}
            onTest={flow.test}
          />
          {flow.testResult ? <TestResults result={flow.testResult} /> : null}
        </aside>
      </div>

      <ConfirmLargeSendDialog
        open={!!flow.confirm}
        count={flow.confirm?.count ?? 0}
        threshold={flow.confirm?.threshold ?? 100}
        channels={state.channels}
        scheduled={scheduled}
        loading={flow.busy === 'send'}
        onCancel={flow.cancelConfirm}
        onConfirm={flow.acceptConfirm}
      />
      <LeaveDialog
        open={guard.pendingTarget !== null}
        canSaveDraft={editing?.status !== 'SCHEDULED'}
        saving={flow.busy === 'draft'}
        onStay={guard.stay}
        onLeave={guard.leave}
        onSaveAndLeave={async () => {
          if (await flow.saveDraft()) guard.leave();
          else guard.stay();
        }}
      />
    </div>
  );
}

/** Edit-mode strip: loading skeleton, load failure with retry, "can't edit" for started messages, or the editing notice. */
function EditBanner({ query, editing }: { query: ReturnType<typeof useCampaign>; editing: EditingTarget | null }) {
  if (query.isLoading) return <Skeleton className="mb-4 h-14 w-full rounded-xl" />;
  if (query.isError) {
    return (
      <Banner className="mb-4" title="Couldn't load this message" action={{ label: 'Try again', onClick: () => void query.refetch(), busy: query.isFetching }}>
        {describeLoadError(query.error, 'the saved message')}
      </Banner>
    );
  }
  if (query.data && !EDITABLE_STATUSES.includes(query.data.status)) {
    return (
      <Banner tone="warning" className="mb-4" title="This message can't be edited">
        It is already {query.data.status.toLowerCase()}. Only drafts and scheduled messages can be changed.{' '}
        <Link href={`${COMMUNICATIONS_ROUTES.history}?campaign=${query.data.id}`} className="font-semibold underline underline-offset-2">
          View it in History
        </Link>
      </Banner>
    );
  }
  if (editing) {
    return (
      <Banner tone="info" className="mb-4" title={editing.status === 'DRAFT' ? 'Editing a draft' : 'Editing a scheduled message'}>
        <span className="inline-flex items-center gap-1.5">
          <PencilLine className="size-3.5" aria-hidden />
          {editing.status === 'DRAFT' ? 'Send it now or keep saving changes.' : 'Changes apply to the scheduled send. It stays scheduled.'}
        </span>
      </Banner>
    );
  }
  return null;
}
