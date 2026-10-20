import 'comm_channel.dart';
import 'comm_overview.dart';
import 'payments_analytics.dart' show jsonInt, jsonList, jsonMap;

/// How a rule's timing is expressed (`timing.unit`).
enum TimingUnit {
  daysBefore('DAYS_BEFORE'),
  daysAfter('DAYS_AFTER'),
  hoursBefore('HOURS_BEFORE'),
  daysSinceVisit('DAYS_SINCE_VISIT'),
  onDay('ON_DAY'),
  event('EVENT');

  const TimingUnit(this.api);
  final String api;

  static TimingUnit parse(Object? raw) {
    for (final u in TimingUnit.values) {
      if (u.api == raw) return u;
    }
    return TimingUnit.event;
  }
}

/// `timing` of an automation rule.
class AutomationTiming {
  const AutomationTiming({
    required this.unit,
    required this.editable,
    this.min = 1,
    this.max = 1,
    this.maxCount = 1,
    this.defaultOffsets = const [],
  });

  final TimingUnit unit;

  /// False for ON_DAY / EVENT rules: the timing is fixed.
  final bool editable;
  final int min;
  final int max;
  final int maxCount;
  final List<int> defaultOffsets;

  factory AutomationTiming.fromJson(Object? raw) {
    final j = jsonMap(raw);
    return AutomationTiming(
      unit: TimingUnit.parse(j['unit']),
      editable: j['editable'] == true,
      min: j['min'] == null ? 1 : jsonInt(j['min']),
      max: j['max'] == null ? 1 : jsonInt(j['max']),
      maxCount: j['maxCount'] == null ? 1 : jsonInt(j['maxCount']),
      defaultOffsets: _ints(j['defaultOffsets']),
    );
  }

  /// "7 days before" for the chip; [short] drops the trailing words
  /// ("3 days").
  String chipLabel(int n, {bool short = false}) {
    switch (unit) {
      case TimingUnit.daysBefore:
        return short ? _days(n) : '${_days(n)} before';
      case TimingUnit.daysAfter:
        return short ? _days(n) : '${_days(n)} after';
      case TimingUnit.hoursBefore:
        return short ? '$n h' : '$n h before';
      case TimingUnit.daysSinceVisit:
        return short ? _days(n) : '${_days(n)} since last visit';
      case TimingUnit.onDay:
        return 'On the day';
      case TimingUnit.event:
        return 'When it happens';
    }
  }

  /// One-line summary of the chosen [offsets] for the list card:
  /// "7, 3, 1 days before", "1 day after", "24 h, 2 h before".
  String summary(List<int> offsets) {
    switch (unit) {
      case TimingUnit.onDay:
        return 'On the day';
      case TimingUnit.event:
        return 'When it happens';
      default:
        if (offsets.isEmpty) return 'No timing chosen';
        final sorted = sortedOffsets(offsets);
        switch (unit) {
          case TimingUnit.hoursBefore:
            return '${sorted.map((n) => '$n h').join(', ')} before';
          case TimingUnit.daysSinceVisit:
            return 'After ${sorted.join(', ')} '
                '${sorted.length == 1 && sorted.first == 1 ? 'day' : 'days'}'
                ' away';
          default:
            final word = unit == TimingUnit.daysBefore ? 'before' : 'after';
            final unitWord =
                sorted.length == 1 && sorted.first == 1 ? 'day' : 'days';
            return '${sorted.join(', ')} $unitWord $word';
        }
    }
  }

  /// "Before" rules read biggest-first (7, 3, 1); the rest smallest-first.
  List<int> sortedOffsets(Iterable<int> offsets) {
    final list = offsets.toList()..sort();
    final before =
        unit == TimingUnit.daysBefore || unit == TimingUnit.hoursBefore;
    return before ? list.reversed.toList() : list;
  }

  static String _days(int n) => n == 1 ? '1 day' : '$n days';
}

List<int> _ints(Object? raw) => raw is List
    ? raw.whereType<num>().map((n) => n.toInt()).toList()
    : const [];

/// A selected channel the gym cannot send on right now.
class UnavailableChannel {
  const UnavailableChannel({required this.channel, required this.reason});

  final CommChannel channel;
  final String reason;
}

/// Human wording for a quota `disabledReason`.
String disabledReasonText(String? reason) => switch (reason) {
      'disabled_platform' => 'not included in your plan',
      'disabled_tenant' => 'switched off in your gym settings',
      _ => 'switched off',
    };

/// `AutomationKey` + one rule of `GET /communications/automations`.
class AutomationRule {
  const AutomationRule({
    required this.key,
    required this.label,
    required this.description,
    required this.kind,
    required this.timing,
    required this.enabled,
    required this.isDefault,
    required this.offsets,
    required this.channels,
    required this.allowedChannels,
    this.unavailable = const [],
    this.title,
    this.body,
    this.defaultTitle = '',
    this.defaultBody = '',
    this.allowedPlaceholders = const [],
    this.sentLast7Days = 0,
    this.lastSentAt,
    this.updatedAt,
  });

  final String key;
  final String label;
  final String description;

  /// `TRANSACTIONAL` (ignores promotional opt-out) or `PROMOTIONAL`.
  final String kind;
  final AutomationTiming timing;
  final bool enabled;
  final bool isDefault;
  final List<int> offsets;
  final List<CommChannel> channels;
  final List<CommChannel> allowedChannels;
  final List<UnavailableChannel> unavailable;
  final String? title;
  final String? body;
  final String defaultTitle;
  final String defaultBody;
  final List<String> allowedPlaceholders;
  final int sentLast7Days;
  final DateTime? lastSentAt;
  final DateTime? updatedAt;

  factory AutomationRule.fromJson(Map<String, dynamic> j) => AutomationRule(
        key: (j['key'] ?? '').toString(),
        label: (j['label'] ?? '').toString(),
        description: (j['description'] ?? '').toString(),
        kind: (j['kind'] ?? 'TRANSACTIONAL').toString(),
        timing: AutomationTiming.fromJson(j['timing']),
        enabled: j['enabled'] == true,
        isDefault: j['isDefault'] == true,
        offsets: _ints(j['offsets']),
        channels: CommChannel.parseList(j['channels']),
        allowedChannels: () {
          final l = CommChannel.parseList(j['allowedChannels']);
          return l.isEmpty ? CommChannel.values.toList() : l;
        }(),
        unavailable: [
          for (final raw in jsonList(j['unavailableChannels']))
            if (CommChannel.tryParse(raw['channel']) case final c?)
              UnavailableChannel(
                channel: c,
                reason: (raw['reason'] ?? '').toString(),
              ),
        ],
        title: j['title'] as String?,
        body: j['body'] as String?,
        defaultTitle: (j['defaultTitle'] ?? '').toString(),
        defaultBody: (j['defaultBody'] ?? '').toString(),
        allowedPlaceholders: j['allowedPlaceholders'] is List
            ? (j['allowedPlaceholders'] as List).whereType<String>().toList()
            : const [],
        sentLast7Days: jsonInt(j['sentLast7Days']),
        lastSentAt: j['lastSentAt'] is String
            ? DateTime.tryParse(j['lastSentAt'] as String)
            : null,
        updatedAt: j['updatedAt'] is String
            ? DateTime.tryParse(j['updatedAt'] as String)
            : null,
      );

  String get timingSummary => timing.summary(offsets);

  /// Promotional rules respect a member's opt-out; transactional ones do not.
  bool get isTransactional => kind == 'TRANSACTIONAL';

  AutomationRule copyWithEnabled(bool value) => AutomationRule(
        key: key,
        label: label,
        description: description,
        kind: kind,
        timing: timing,
        enabled: value,
        isDefault: isDefault,
        offsets: offsets,
        channels: channels,
        allowedChannels: allowedChannels,
        unavailable: unavailable,
        title: title,
        body: body,
        defaultTitle: defaultTitle,
        defaultBody: defaultBody,
        allowedPlaceholders: allowedPlaceholders,
        sentLast7Days: sentLast7Days,
        lastSentAt: lastSentAt,
        updatedAt: updatedAt,
      );
}

/// `GET /communications/automations`.
class AutomationList {
  const AutomationList({required this.quietHours, required this.items});

  final QuietHours quietHours;
  final List<AutomationRule> items;

  factory AutomationList.fromJson(Map<String, dynamic> j) => AutomationList(
        quietHours: QuietHours.fromJson(j['quietHours']),
        items: jsonList(j['items']).map(AutomationRule.fromJson).toList(),
      );

  int get enabledCount => items.where((r) => r.enabled).length;
}

/// One entry of a test-send response.
class TestSendResult {
  const TestSendResult({
    required this.channel,
    required this.status,
    required this.message,
  });

  final CommChannel? channel;

  /// `QUEUED` | `SKIPPED` | `FAILED`.
  final String status;
  final String message;

  factory TestSendResult.fromJson(Map<String, dynamic> j) => TestSendResult(
        channel: CommChannel.tryParse(j['channel']),
        status: (j['status'] ?? '').toString(),
        message: (j['message'] ?? '').toString(),
      );

  bool get ok => status == 'QUEUED';
}
