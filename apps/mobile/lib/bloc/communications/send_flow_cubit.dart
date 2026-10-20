import 'dart:async';
import 'dart:math';

import 'package:flutter_bloc/flutter_bloc.dart';

import '../../core/network/api_exception.dart';
import '../../core/network/comm_failure.dart';
import '../../features/communications/comm_constants.dart';
import '../../models/comm_audience.dart';
import '../../models/comm_campaign.dart';
import '../../models/comm_channel.dart';
import '../../models/comm_request.dart';
import '../../repositories/communications_repository.dart';
import 'send_flow_state.dart';

/// Drives the four-step send flow: audience (filters or hand-picked members)
/// with a debounced live count, message, channels with quota meters, review
/// with confirm + schedule, and the submit with an `Idempotency-Key`.
///
/// Rules it owns: each step validates before Next ([next]), the audience
/// preview is re-fetched (debounced, stale answers dropped) when the audience
/// changes, a double-tap on Send is ignored while [SendFlowState.submitting],
/// the loading flag always resets, and every API failure is translated by
/// [CommFailure] into a banner / field errors / a step to jump back to.
class SendFlowCubit extends Cubit<SendFlowState> {
  SendFlowCubit(
    this._repo, {
    PickerMember? seed,
    Duration debounce = kCommPreviewDebounce,
    DateTime Function()? clock,
    String Function()? keyFactory,
  })  : _debounce = debounce,
        _clock = clock ?? DateTime.now,
        _newKey = keyFactory ?? _randomKey,
        super(
          seed == null
              ? const SendFlowState()
              : SendFlowState(
                  mode: AudienceMode.picked,
                  picked: {seed.id: seed},
                ),
        ) {
    unawaited(refreshPreview(immediate: true));
  }

  final CommunicationsRepository _repo;
  final Duration _debounce;
  final DateTime Function() _clock;
  final String Function() _newKey;

  Timer? _timer;
  int _seq = 0;
  String? _lastKey;

  static String _randomKey() {
    final r = Random.secure();
    final tail = List.generate(
      3,
      (_) => r.nextInt(1 << 30).toRadixString(36),
    ).join();
    return 'cm-${DateTime.now().microsecondsSinceEpoch.toRadixString(36)}-$tail';
  }

  @override
  Future<void> close() {
    _timer?.cancel();
    return super.close();
  }

  // ── audience ─────────────────────────────────────────────────────────

  void setMode(AudienceMode mode) {
    if (mode == state.mode) return;
    _edit(state.copyWith(mode: mode, preview: null, previewError: null));
    _schedulePreview();
  }

  void setFilter(AudienceFilter filter) {
    if (filter == state.filter) return;
    _edit(state.copyWith(filter: filter, preview: null, previewError: null));
    _schedulePreview();
  }

  void togglePick(PickerMember m) {
    final next = {...state.picked};
    if (next.containsKey(m.id)) {
      next.remove(m.id);
    } else {
      if (next.length >= kCommMaxRecipients) {
        emit(
          state.copyWith(
            banner: 'You can pick at most $kCommMaxRecipients members.',
            bannerKind: CommFailureKind.recipientLimit,
          ),
        );
        return;
      }
      next[m.id] = m;
    }
    _setPicked(next);
  }

  /// "Select shown": adds every member in [members] (respecting the 5,000
  /// cap).
  void pickMany(Iterable<PickerMember> members) {
    final next = {...state.picked};
    var capped = false;
    for (final m in members) {
      if (next.containsKey(m.id)) continue;
      if (next.length >= kCommMaxRecipients) {
        capped = true;
        break;
      }
      next[m.id] = m;
    }
    _setPicked(next);
    if (capped) {
      emit(
        state.copyWith(
          banner: 'Only the first $kCommMaxRecipients picks were kept.',
          bannerKind: CommFailureKind.recipientLimit,
        ),
      );
    }
  }

  void removePicked(String id) {
    if (!state.picked.containsKey(id)) return;
    _setPicked({...state.picked}..remove(id));
  }

  void clearPicked() {
    if (state.picked.isEmpty) return;
    _setPicked(const {});
  }

  void _setPicked(Map<String, PickerMember> next) {
    _edit(state.copyWith(picked: next, preview: null, previewError: null));
    _schedulePreview();
  }

  // ── message ──────────────────────────────────────────────────────────

  /// Sets the text (and which template chip is lit). Pass only what changed.
  void setTexts({String? title, String? body, CommTemplate? template}) {
    _edit(
      state.copyWith(
        title: title ?? state.title,
        body: body ?? state.body,
        template: template ?? state.template,
        fieldErrors: _without(state.fieldErrors, const ['title', 'body']),
      ),
    );
  }

  // ── channels ─────────────────────────────────────────────────────────

  void toggleChannel(CommChannel c) {
    final next = {...state.channels};
    if (!next.remove(c)) next.add(c);
    _edit(
      state.copyWith(
        channels: next,
        fieldErrors: _without(state.fieldErrors, const ['channels']),
        serverBlocked: {...state.serverBlocked}..remove(c),
      ),
    );
  }

  // ── review ───────────────────────────────────────────────────────────

  /// null = send now.
  void setSchedule(DateTime? at) {
    _edit(
      state.copyWith(
        scheduledAt: at,
        fieldErrors: _without(state.fieldErrors, const ['scheduledAt']),
      ),
    );
  }

  void setConfirmed(bool value) {
    _edit(state.copyWith(confirmed: value));
  }

  void dismissBanner() {
    if (state.banner == null) return;
    emit(state.copyWith(banner: null, bannerKind: null));
  }

  // ── navigation ───────────────────────────────────────────────────────

  Map<String, String> errorsFor(int step) =>
      validateSendStep(state, step, _clock());

  /// Whether Next on [step] is allowed right now (without marking errors).
  /// The audience step additionally waits for a fresh preview.
  bool canAdvance(int step) {
    if (state.submitting) return false;
    if (step == kStepAudience) {
      if (state.previewLoading || state.preview == null) return false;
    }
    return errorsFor(step).isEmpty;
  }

  /// Validates the current step and moves on. Returns false (and flags the
  /// inline errors) when something is wrong.
  bool next() {
    final s = state;
    if (s.step >= kStepReview) return false;
    if (s.step == kStepAudience && (s.previewLoading || s.preview == null)) {
      // Still counting: nothing to validate against yet.
      emit(s.copyWith(attempted: {...s.attempted, s.step}));
      return false;
    }
    final errors = errorsFor(s.step);
    if (errors.isNotEmpty) {
      emit(s.copyWith(attempted: {...s.attempted, s.step}));
      return false;
    }
    final target = s.step + 1;
    emit(s.copyWith(step: target, banner: null, bannerKind: null));
    // The channel meters need the freshest numbers (and the SMS note needs
    // the finished text).
    if (target == kStepChannels) unawaited(refreshPreview(immediate: true));
    return true;
  }

  void back() {
    if (state.step <= kStepAudience || state.submitting) return;
    emit(state.copyWith(step: state.step - 1, banner: null, bannerKind: null));
  }

  void goToStep(int step) {
    if (step < kStepAudience || step > kStepReview) return;
    emit(state.copyWith(step: step, banner: null, bannerKind: null));
  }

  // ── preview ──────────────────────────────────────────────────────────

  bool get _canPreview =>
      state.mode == AudienceMode.filters || state.picked.isNotEmpty;

  void _schedulePreview() {
    _timer?.cancel();
    if (!_canPreview) {
      _seq++;
      emit(state.copyWith(previewLoading: false));
      return;
    }
    emit(state.copyWith(previewLoading: true, previewError: null));
    if (_debounce == Duration.zero) {
      unawaited(refreshPreview(immediate: true));
      return;
    }
    _timer = Timer(_debounce, () => unawaited(refreshPreview(immediate: true)));
  }

  /// Fetches the audience preview now. [immediate] skips the debounce timer
  /// that [_schedulePreview] already ran.
  Future<void> refreshPreview({bool immediate = false}) async {
    _timer?.cancel();
    if (!_canPreview) {
      if (!isClosed) emit(state.copyWith(previewLoading: false));
      return;
    }
    final seq = ++_seq;
    final s = state;
    emit(s.copyWith(previewLoading: true, previewError: null));
    AudiencePreview? preview;
    String? error;
    try {
      preview = await _repo.previewAudience(
        mode: s.mode,
        filter: s.filter,
        pickedMemberIds: s.pickedIds,
        title: s.title.trim().length <= kCommTitleMax ? s.title : null,
        body: s.body.trim().length <= kCommBodyMax ? s.body : null,
      );
    } on ApiException catch (e) {
      error = CommFailure.from(e).message;
    } catch (_) {
      error = 'Could not count the audience. Try again.';
    } finally {
      // Only the newest request may touch the state.
      if (seq == _seq && !isClosed) {
        emit(
          state.copyWith(
            preview: preview,
            previewLoading: false,
            previewError: error,
            // Fresh numbers supersede what an earlier 409 told us.
            serverBlocked: preview == null ? null : const {},
          ),
        );
      }
    }
  }

  // ── submit ───────────────────────────────────────────────────────────

  /// Validates everything, then creates the campaign. Ignored while a submit
  /// is in flight (double-tap protection). Success sets [SendFlowState.sent].
  Future<void> submit() async {
    if (state.submitting) return;
    final now = _clock();

    // Walk every step: jump to the first one that is not valid.
    for (var step = kStepAudience; step <= kStepReview; step++) {
      if (step == kStepAudience && state.preview == null) {
        emit(
          state.copyWith(
            step: kStepAudience,
            attempted: {...state.attempted, step},
          ),
        );
        _schedulePreview();
        return;
      }
      if (validateSendStep(state, step, now).isNotEmpty) {
        emit(
          state.copyWith(
            step: step,
            attempted: {...state.attempted, step},
          ),
        );
        return;
      }
    }

    final s = state;
    final key = s.idempotencyKey ?? _newKey();
    _lastKey = key;
    emit(
      s.copyWith(
        submitting: true,
        banner: null,
        bannerKind: null,
        fieldErrors: const {},
        idempotencyKey: key,
      ),
    );

    CommCampaign? created;
    CommFailure? failure;
    try {
      created = await _repo.createCampaign(
        CampaignRequest(
          title: s.title,
          body: s.body,
          channels: s.orderedChannels,
          mode: s.mode,
          filter: s.filter,
          pickedMemberIds: s.pickedIds,
          template: s.template,
          sendMode: s.isScheduled ? CommSendMode.schedule : CommSendMode.now,
          scheduledAt: s.scheduledAt,
          confirmLargeSend: s.needsConfirm && s.confirmed,
        ),
        idempotencyKey: key,
      );
    } on ApiException catch (e) {
      failure = CommFailure.from(e);
    } catch (e) {
      failure = const CommFailure(
        kind: CommFailureKind.other,
        message: 'Something went wrong while sending. Please try again.',
      );
    } finally {
      if (!isClosed) {
        if (created != null) {
          emit(state.copyWith(submitting: false, sent: created));
        } else if (failure != null) {
          _applyFailure(failure);
        } else {
          emit(state.copyWith(submitting: false));
        }
      }
    }
  }

  void _applyFailure(CommFailure f) {
    var next = state.copyWith(
      submitting: false,
      banner: f.message,
      bannerKind: f.kind,
      fieldErrors: f.fieldMessages,
    );
    var jumpTo = -1;
    var refresh = false;
    switch (f.kind) {
      case CommFailureKind.confirmationRequired:
        next = next.copyWith(
          forceConfirm: true,
          confirmed: false,
          idempotencyKey: null,
          attempted: {...state.attempted, kStepReview},
        );
        jumpTo = kStepReview;
      case CommFailureKind.channelDisabled:
        next = next.copyWith(
          serverBlocked: {
            ...state.serverBlocked,
            for (final d in f.disabledChannels)
              d.channel: CommFailure.disabledSentence(d),
          },
          attempted: {...state.attempted, kStepChannels},
        );
        jumpTo = kStepChannels;
        refresh = true;
      case CommFailureKind.quotaExceeded:
        next = next.copyWith(
          serverBlocked: {
            ...state.serverBlocked,
            for (final q in f.shortChannels)
              q.channel: CommFailure.quotaSentence(q),
          },
          attempted: {...state.attempted, kStepChannels},
        );
        jumpTo = kStepChannels;
        refresh = true;
      case CommFailureKind.audienceEmpty:
      case CommFailureKind.recipientLimit:
        jumpTo = kStepAudience;
        refresh = true;
      case CommFailureKind.validation:
        var earliest = 99;
        for (final field in f.fieldMessages.keys) {
          final st = stepForField(field);
          if (st >= 0 && st < earliest) earliest = st;
        }
        if (earliest != 99) {
          jumpTo = earliest;
          next = next.copyWith(attempted: {...state.attempted, earliest});
        }
      case CommFailureKind.network:
      case CommFailureKind.rateLimited:
      case CommFailureKind.forbidden:
      case CommFailureKind.notFound:
      case CommFailureKind.invalidState:
      case CommFailureKind.other:
        // Stay on the review step; the key is kept so a retry after a
        // network drop cannot send twice.
        break;
    }
    if (jumpTo >= 0) next = next.copyWith(step: jumpTo);
    emit(next);
    if (refresh) unawaited(refreshPreview(immediate: true));
  }

  // ── helpers ──────────────────────────────────────────────────────────

  /// Any edit to the request content invalidates the idempotency key, the
  /// confirmation, and the banner that referred to the old content.
  void _edit(SendFlowState next) {
    emit(next.copyWith(idempotencyKey: null, banner: null, bannerKind: null));
    _lastKey = null;
  }

  /// The key used by the last submit (tests).
  String? get lastKey => _lastKey;

  static Map<String, String> _without(
    Map<String, String> m,
    List<String> keys,
  ) =>
      m.isEmpty || !keys.any(m.containsKey)
          ? m
          : {
              for (final e in m.entries)
                if (!keys.contains(e.key)) e.key: e.value,
            };
}
