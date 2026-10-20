import '../../core/network/comm_failure.dart';
import '../../core/utils/count_format.dart';
import '../../features/communications/comm_constants.dart';
import '../../features/communications/comm_logic.dart';
import '../../models/comm_audience.dart';
import '../../models/comm_campaign.dart';
import '../../models/comm_channel.dart';
import '../../models/comm_request.dart';

/// The four steps of the send flow, in order.
const kStepAudience = 0;
const kStepMessage = 1;
const kStepChannels = 2;
const kStepReview = 3;

const _keep = Object();

/// Everything the send flow knows. Plain immutable value (a new instance per
/// change); the text controllers live in the screen, the cubit keeps the
/// authoritative copy of the text.
class SendFlowState {
  const SendFlowState({
    this.step = kStepAudience,
    this.mode = AudienceMode.filters,
    this.filter = AudienceFilter.empty,
    this.picked = const {},
    this.template = CommTemplate.custom,
    this.title = '',
    this.body = '',
    this.channels = const {CommChannel.push, CommChannel.inApp},
    this.preview,
    this.previewLoading = false,
    this.previewError,
    this.scheduledAt,
    this.confirmed = false,
    this.forceConfirm = false,
    this.submitting = false,
    this.banner,
    this.bannerKind,
    this.fieldErrors = const {},
    this.serverBlocked = const {},
    this.attempted = const {},
    this.idempotencyKey,
    this.sent,
  });

  final int step;
  final AudienceMode mode;
  final AudienceFilter filter;

  /// Hand-picked members, in the order they were picked.
  final Map<String, PickerMember> picked;
  final CommTemplate template;
  final String title;
  final String body;
  final Set<CommChannel> channels;

  /// The latest successful audience preview for the current audience.
  final AudiencePreview? preview;
  final bool previewLoading;
  final String? previewError;

  /// null = send now.
  final DateTime? scheduledAt;

  /// The "I checked the audience and message" box.
  final bool confirmed;

  /// The server asked for confirmation (audience grew past 100).
  final bool forceConfirm;
  final bool submitting;

  /// Non-field error banner (and its kind, to colour/act on it).
  final String? banner;
  final CommFailureKind? bannerKind;

  /// Server 422 messages by root field name.
  final Map<String, String> fieldErrors;

  /// Channels the server refused (disabled / out of quota) with the reason.
  final Map<CommChannel, String> serverBlocked;

  /// Steps on which the user already pressed Next/Send, so their inline
  /// errors are showing.
  final Set<int> attempted;

  /// Sent as `Idempotency-Key`; reset whenever the request content changes.
  final String? idempotencyKey;

  /// Set once the campaign was created.
  final CommCampaign? sent;

  bool get isScheduled => scheduledAt != null;

  List<String> get pickedIds => picked.keys.toList();

  /// Members in the audience: the server's count, or the picked count while
  /// no preview exists in hand-pick mode.
  int? get audienceCount =>
      preview?.total ?? (mode == AudienceMode.picked ? picked.length : null);

  /// Large sends (and a server demand) need the confirmation box.
  bool get needsConfirm => (preview?.largeSend ?? false) || forceConfirm;

  /// Worth protecting against an accidental back-press.
  bool get isDirty =>
      title.trim().isNotEmpty || body.trim().isNotEmpty || picked.isNotEmpty;

  /// The message with sample values (for the SMS length check).
  bool get usesSms => channels.contains(CommChannel.sms);

  List<CommChannel> get orderedChannels => [
        for (final c in CommChannel.values)
          if (channels.contains(c)) c,
      ];

  SendFlowState copyWith({
    int? step,
    AudienceMode? mode,
    AudienceFilter? filter,
    Map<String, PickerMember>? picked,
    CommTemplate? template,
    String? title,
    String? body,
    Set<CommChannel>? channels,
    Object? preview = _keep,
    bool? previewLoading,
    Object? previewError = _keep,
    Object? scheduledAt = _keep,
    bool? confirmed,
    bool? forceConfirm,
    bool? submitting,
    Object? banner = _keep,
    Object? bannerKind = _keep,
    Map<String, String>? fieldErrors,
    Map<CommChannel, String>? serverBlocked,
    Set<int>? attempted,
    Object? idempotencyKey = _keep,
    Object? sent = _keep,
  }) =>
      SendFlowState(
        step: step ?? this.step,
        mode: mode ?? this.mode,
        filter: filter ?? this.filter,
        picked: picked ?? this.picked,
        template: template ?? this.template,
        title: title ?? this.title,
        body: body ?? this.body,
        channels: channels ?? this.channels,
        preview: identical(preview, _keep)
            ? this.preview
            : preview as AudiencePreview?,
        previewLoading: previewLoading ?? this.previewLoading,
        previewError: identical(previewError, _keep)
            ? this.previewError
            : previewError as String?,
        scheduledAt: identical(scheduledAt, _keep)
            ? this.scheduledAt
            : scheduledAt as DateTime?,
        confirmed: confirmed ?? this.confirmed,
        forceConfirm: forceConfirm ?? this.forceConfirm,
        submitting: submitting ?? this.submitting,
        banner: identical(banner, _keep) ? this.banner : banner as String?,
        bannerKind: identical(bannerKind, _keep)
            ? this.bannerKind
            : bannerKind as CommFailureKind?,
        fieldErrors: fieldErrors ?? this.fieldErrors,
        serverBlocked: serverBlocked ?? this.serverBlocked,
        attempted: attempted ?? this.attempted,
        idempotencyKey: identical(idempotencyKey, _keep)
            ? this.idempotencyKey
            : idempotencyKey as String?,
        sent: identical(sent, _keep) ? this.sent : sent as CommCampaign?,
      );
}

/// Per-step validation, kept pure so it is unit-testable and shared by the
/// inline error display, the Next buttons and `submit`.
///
/// Returns field/rule key -> message. Keys: `audience`, `title`, `body`,
/// `channels`, `sms`, `reach`, `schedule`, `confirm`.
Map<String, String> validateSendStep(
  SendFlowState s,
  int step,
  DateTime now,
) {
  final e = <String, String>{};
  switch (step) {
    case kStepAudience:
      if (s.mode == AudienceMode.picked && s.picked.isEmpty) {
        e['audience'] = 'Pick at least one member.';
      } else if (s.preview != null && s.preview!.total == 0) {
        e['audience'] = s.mode == AudienceMode.picked
            ? 'Nobody picked yet.'
            : 'No members match these filters. Remove a filter.';
      } else if (s.preview != null && s.preview!.exceedsMax) {
        e['audience'] = 'That is more than ${groupDigits(kCommMaxRecipients)} '
            'members. Narrow the audience.';
      } else if (s.fieldErrors['pickedMemberIds'] != null) {
        e['audience'] = s.fieldErrors['pickedMemberIds']!;
      } else if (s.fieldErrors['audienceFilter'] != null) {
        e['audience'] = s.fieldErrors['audienceFilter']!;
      }
    case kStepMessage:
      final t = validateTitle(s.title);
      if (t != null) e['title'] = t;
      final b = validateBody(s.body);
      if (b != null) e['body'] = b;
      if (t == null && s.fieldErrors['title'] != null) {
        e['title'] = s.fieldErrors['title']!;
      }
      if (b == null && s.fieldErrors['body'] != null) {
        e['body'] = s.fieldErrors['body']!;
      }
    case kStepChannels:
      final c = validateChannelsSelected(s.channels);
      if (c != null) {
        e['channels'] = c;
      } else {
        final preview = s.preview;
        for (final ch in s.orderedChannels) {
          final server = s.serverBlocked[ch];
          final reason =
              (preview == null ? null : channelBlockReason(preview, ch)) ??
                  server;
          if (reason != null) {
            e['channels'] = reason;
            break;
          }
        }
        if (e['channels'] == null && preview != null) {
          final reach = s.orderedChannels
              .fold<int>(0, (sum, ch) => sum + messagesFor(preview, ch));
          if (reach == 0) {
            e['reach'] = 'Nobody in this audience can receive a message on '
                'the chosen channels (no contact details, or they opted '
                'out). Choose another channel or audience.';
          }
        }
        if (e['channels'] == null && s.usesSms) {
          final sms = validateSmsLength(s.title, s.body);
          if (sms != null) e['sms'] = sms;
        }
        if (e['channels'] == null && s.fieldErrors['channels'] != null) {
          e['channels'] = s.fieldErrors['channels']!;
        }
      }
    case kStepReview:
      if (s.isScheduled) {
        final sched = validateSchedule(s.scheduledAt, now);
        if (sched != null) e['schedule'] = sched;
      }
      if (e['schedule'] == null && s.fieldErrors['scheduledAt'] != null) {
        e['schedule'] = s.fieldErrors['scheduledAt']!;
      }
      if (s.needsConfirm && !s.confirmed) {
        e['confirm'] = 'Tick the box to confirm this large send.';
      }
  }
  return e;
}

/// Which step shows a server field error.
int stepForField(String field) => switch (field) {
      'pickedMemberIds' || 'audienceFilter' || 'audienceMode' => kStepAudience,
      'title' || 'body' || 'templateKey' || 'name' => kStepMessage,
      'channels' => kStepChannels,
      'scheduledAt' || 'sendMode' || 'confirmLargeSend' => kStepReview,
      _ => -1,
    };
