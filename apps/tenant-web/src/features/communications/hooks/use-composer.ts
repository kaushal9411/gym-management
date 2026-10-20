'use client';

import * as React from 'react';

import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { composerToPreview, snapshot, type ComposerState, type PickedMember } from '../lib/composer';
import type { AudienceFilter, Channel, PreviewRequest } from '../types';

type Action =
  | { type: 'patch'; patch: Partial<ComposerState> }
  | { type: 'filter'; patch: Partial<AudienceFilter> }
  | { type: 'pick'; members: PickedMember[] }
  | { type: 'unpick'; ids: string[] }
  | { type: 'clear-picked' }
  | { type: 'toggle-channel'; channel: Channel }
  | { type: 'reset'; state: ComposerState };

function reducer(state: ComposerState, action: Action): ComposerState {
  switch (action.type) {
    case 'patch':
      return { ...state, ...action.patch };
    case 'filter': {
      const filter = { ...state.filter, ...action.patch };
      if (filter.membershipStatus !== 'EXPIRING') delete filter.expiringWithinDays;
      return { ...state, filter };
    }
    case 'pick': {
      const picked = { ...state.picked };
      for (const m of action.members) picked[m.id] = m;
      return { ...state, picked };
    }
    case 'unpick': {
      const picked = { ...state.picked };
      for (const id of action.ids) delete picked[id];
      return { ...state, picked };
    }
    case 'clear-picked':
      return { ...state, picked: {} };
    case 'toggle-channel':
      return {
        ...state,
        channels: state.channels.includes(action.channel) ? state.channels.filter((c) => c !== action.channel) : [...state.channels, action.channel],
      };
    case 'reset':
      return action.state;
  }
}

/**
 * Local (UI-only) state of the Send message form plus dirty tracking against a
 * baseline (the initial / just-loaded / just-saved state), and the debounced
 * audience-preview request derived from it.
 */
export function useComposer(initial: ComposerState) {
  const [state, dispatch] = React.useReducer(reducer, initial);
  const [baseline, setBaseline] = React.useState(() => snapshot(initial));

  const dirty = snapshot(state) !== baseline;

  const actions = React.useMemo(
    () => ({
      patch: (patch: Partial<ComposerState>) => dispatch({ type: 'patch', patch }),
      filter: (patch: Partial<AudienceFilter>) => dispatch({ type: 'filter', patch }),
      pick: (members: PickedMember[]) => dispatch({ type: 'pick', members }),
      unpick: (ids: string[]) => dispatch({ type: 'unpick', ids }),
      clearPicked: () => dispatch({ type: 'clear-picked' }),
      toggleChannel: (channel: Channel) => dispatch({ type: 'toggle-channel', channel }),
      /** Replace the whole form and treat it as the new clean baseline (after load / save). */
      load: (next: ComposerState) => {
        dispatch({ type: 'reset', state: next });
        setBaseline(snapshot(next));
      },
      /** Mark the current content as saved (e.g. after a successful draft save). */
      markClean: (next: ComposerState) => setBaseline(snapshot(next)),
    }),
    [],
  );

  // Debounce on the serialised request so object identity does not retrigger the timer every render.
  const previewJson = JSON.stringify(composerToPreview(state));
  const debouncedJson = useDebouncedValue(previewJson, 300);
  const previewRequest = React.useMemo(() => JSON.parse(debouncedJson) as PreviewRequest | null, [debouncedJson]);
  const previewSettling = previewJson !== debouncedJson;

  return { state, actions, dirty, previewRequest, previewSettling };
}
