import '../../models/comm_channel.dart';
import '../utils/count_format.dart';
import 'api_exception.dart';

enum CommFailureKind {
  validation,
  audienceEmpty,
  recipientLimit,
  confirmationRequired,
  channelDisabled,
  quotaExceeded,
  rateLimited,
  forbidden,
  notFound,
  invalidState,
  network,
  other,
}

/// A paid channel that cannot carry the send (409 CHANNEL_DISABLED).
class DisabledChannelInfo {
  const DisabledChannelInfo({required this.channel, required this.reason});

  final CommChannel channel;
  final String reason;
}

/// A channel without enough monthly allowance (409 QUOTA_EXCEEDED).
class ShortChannelInfo {
  const ShortChannelInfo({
    required this.channel,
    required this.remaining,
    required this.wouldUse,
    required this.shortBy,
  });

  final CommChannel channel;
  final int remaining;
  final int wouldUse;
  final int shortBy;
}

/// A Communications call that failed, translated into a specific, human
/// message plus the structured pieces a screen can act on (which fields to
/// flag, which channels are short, ...). Extends [ApiException] so generic
/// `on ApiException` handlers keep working. The raw server text is only used
/// where it is already a clear sentence (validation, 422/409 `INVALID_STATE`).
class CommFailure extends ApiException {
  const CommFailure({
    required this.kind,
    required super.message,
    super.statusCode,
    super.fieldErrors,
    super.code,
    super.data,
    this.fieldMessages = const {},
    this.recipientCount,
    this.threshold,
    this.shortChannels = const [],
    this.disabledChannels = const [],
  });

  final CommFailureKind kind;

  /// Root field name (`title`, `body`, `channels`, `scheduledAt`,
  /// `pickedMemberIds`, `audienceFilter`, `offsets`, ...) -> first message.
  final Map<String, String> fieldMessages;

  /// CONFIRMATION_REQUIRED payload.
  final int? recipientCount;
  final int? threshold;
  final List<ShortChannelInfo> shortChannels;
  final List<DisabledChannelInfo> disabledChannels;

  /// [permission] names the key a 403 is about (shown to the user).
  factory CommFailure.from(
    ApiException e, {
    String permission = 'notifications:send',
  }) {
    if (e is CommFailure) return e;
    final status = e.statusCode;
    final code = e.code;
    final data = e.data ?? const <String, dynamic>{};

    CommFailure make(
      CommFailureKind kind,
      String message, {
      Map<String, String> fields = const {},
      int? recipientCount,
      int? threshold,
      List<ShortChannelInfo> shortChannels = const [],
      List<DisabledChannelInfo> disabled = const [],
    }) =>
        CommFailure(
          kind: kind,
          message: message,
          statusCode: status,
          fieldErrors: e.fieldErrors,
          code: code,
          data: e.data,
          fieldMessages: fields,
          recipientCount: recipientCount,
          threshold: threshold,
          shortChannels: shortChannels,
          disabledChannels: disabled,
        );

    if (status == null) {
      return make(CommFailureKind.network, e.message);
    }
    if (status == 403) {
      return make(
        CommFailureKind.forbidden,
        "You don't have permission to do this (it needs the "
        '"$permission" permission). Ask your gym owner to grant it.',
      );
    }
    if (status == 429) {
      final server = e.message;
      return make(
        CommFailureKind.rateLimited,
        server.toLowerCase().contains('per hour')
            ? server
            : "You're doing that too quickly. Wait a minute and try again.",
      );
    }
    if (status == 404) {
      return make(
        CommFailureKind.notFound,
        e.message.isEmpty || e.message == 'Something went wrong'
            ? 'That item no longer exists. Go back and refresh.'
            : e.message,
      );
    }

    switch (code) {
      case 'CONFIRMATION_REQUIRED':
        final n = _int(data['recipientCount']);
        return make(
          CommFailureKind.confirmationRequired,
          n == null
              ? 'This is a large send. Tick the box to confirm it.'
              : 'This will message ${_n(n)} members. Tick the box to confirm '
                  'the audience and message.',
          recipientCount: n,
          threshold: _int(data['threshold']),
        );
      case 'QUOTA_EXCEEDED':
        final short = <ShortChannelInfo>[
          for (final raw in _list(data['shortChannels']))
            if (CommChannel.tryParse(raw['channel']) case final c?)
              ShortChannelInfo(
                channel: c,
                remaining: _int(raw['remaining']) ?? 0,
                wouldUse: _int(raw['wouldUse']) ?? 0,
                shortBy: _int(raw['shortBy']) ?? 0,
              ),
        ];
        return make(
          CommFailureKind.quotaExceeded,
          short.isEmpty
              ? 'Not enough monthly messages left on a chosen channel. '
                  'Turn it off or narrow the audience.'
              : '${short.map(quotaSentence).join(' ')} '
                  'Turn the channel off or narrow the audience.',
          shortChannels: short,
        );
      case 'CHANNEL_DISABLED':
        final off = <DisabledChannelInfo>[
          for (final raw in _list(data['channels']))
            if (CommChannel.tryParse(raw['channel']) case final c?)
              DisabledChannelInfo(
                channel: c,
                reason: (raw['reason'] ?? '').toString(),
              ),
        ];
        return make(
          CommFailureKind.channelDisabled,
          off.isEmpty
              ? 'A chosen channel is switched off for your gym. Turn it off '
                  'here to continue.'
              : '${off.map(disabledSentence).join(' ')} '
                  'Turn it off here to continue.',
          disabled: off,
        );
      case 'AUDIENCE_EMPTY':
        return make(
          CommFailureKind.audienceEmpty,
          'Nobody matches this audience any more. Go back and change who '
          'gets the message.',
        );
      case 'RECIPIENT_LIMIT_EXCEEDED':
        return make(
          CommFailureKind.recipientLimit,
          'You can message at most 5,000 members at once. Narrow the '
          'audience and try again.',
        );
      case 'INVALID_STATE':
        return make(
          CommFailureKind.invalidState,
          '${e.message} Pull to refresh to see the latest status.',
        );
    }

    if (status == 422 || status == 400) {
      final fields = <String, String>{};
      for (final f in e.fieldErrors) {
        final root = rootField(f.field);
        if (root != null) fields.putIfAbsent(root, () => f.message);
      }
      return make(
        CommFailureKind.validation,
        e.fieldErrors.isEmpty ? e.message : e.fieldErrors.first.message,
        fields: fields,
      );
    }
    if (status == 409) {
      return make(CommFailureKind.invalidState, e.message);
    }
    if (status >= 500) {
      return make(
        CommFailureKind.other,
        'Something went wrong on our side. Please try again in a moment.',
      );
    }
    return make(CommFailureKind.other, e.message);
  }

  /// "SMS: only 240 left, you need 412."
  static String quotaSentence(ShortChannelInfo s) =>
      '${s.channel.label}: only ${_n(s.remaining)} left this month, you '
      'need ${_n(s.wouldUse)}.';

  /// "Email is not included in your plan."
  static String disabledSentence(DisabledChannelInfo d) =>
      '${d.channel.label} is ${_reasonText(d.reason)}.';

  static String _reasonText(String r) => switch (r) {
        'disabled_platform' => 'not included in your plan',
        'disabled_tenant' => 'switched off in your gym settings',
        _ => 'switched off',
      };

  /// `pickedMemberIds.3` / `audienceFilter.planIds[0]` -> the first segment.
  static String? rootField(String? field) {
    if (field == null || field.isEmpty) return null;
    final m = RegExp(r'^[A-Za-z0-9_]+').firstMatch(field);
    return m?.group(0);
  }

  static int? _int(Object? v) => v is num ? v.toInt() : int.tryParse('$v');

  static List<Map<String, dynamic>> _list(Object? v) => v is List
      ? v.whereType<Map<String, dynamic>>().toList()
      : const <Map<String, dynamic>>[];

  /// 1,234 style grouping without an intl dependency.
  static String _n(int n) => groupDigits(n);
}
