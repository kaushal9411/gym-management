import 'comm_campaign.dart';
import 'comm_channel.dart';
import 'payments_analytics.dart' show jsonInt, jsonList, jsonMap;

/// One channel's monthly allowance on the hub (`channels[]` of the overview).
class ChannelQuota {
  const ChannelQuota({
    required this.channel,
    required this.enabled,
    this.disabledReason,
    this.limit,
    this.used = 0,
    this.remaining,
  });

  final CommChannel channel;
  final bool enabled;

  /// `disabled_platform` | `disabled_tenant` | null.
  final String? disabledReason;

  /// null = unlimited.
  final int? limit;
  final int used;
  final int? remaining;

  bool get unlimited => limit == null;

  /// Share of the allowance already used, 0..1 (0 when unlimited).
  double get usedFraction {
    final l = limit;
    if (l == null || l <= 0) return 0;
    return (used / l).clamp(0.0, 1.0);
  }

  static ChannelQuota? tryParse(Map<String, dynamic> j) {
    final c = CommChannel.tryParse(j['channel']);
    if (c == null) return null;
    return ChannelQuota(
      channel: c,
      enabled: j['enabled'] != false,
      disabledReason: j['disabledReason'] as String?,
      limit: j['limit'] == null ? null : jsonInt(j['limit']),
      used: jsonInt(j['used']),
      remaining: j['remaining'] == null ? null : jsonInt(j['remaining']),
    );
  }
}

/// Quiet-hours rule (SMS and WhatsApp are held overnight).
class QuietHours {
  const QuietHours({
    this.start = '21:00',
    this.end = '08:00',
    this.channels = const [CommChannel.sms, CommChannel.whatsapp],
    this.timezoneBasis = 'member branch',
  });

  final String start;
  final String end;
  final List<CommChannel> channels;
  final String timezoneBasis;

  factory QuietHours.fromJson(Object? raw) {
    final j = jsonMap(raw);
    if (j.isEmpty) return const QuietHours();
    final channels = CommChannel.parseList(j['channels']);
    return QuietHours(
      start: (j['start'] ?? '21:00').toString(),
      end: (j['end'] ?? '08:00').toString(),
      channels: channels.isEmpty ? const QuietHours().channels : channels,
      timezoneBasis: (j['timezoneBasis'] ?? 'member branch').toString(),
    );
  }
}

/// `GET /communications/overview` (perm `notifications:view`).
class CommOverview {
  const CommOverview({
    required this.periodKey,
    required this.channels,
    required this.recent,
    required this.automationsTotal,
    required this.automationsEnabled,
    required this.quietHours,
  });

  final String periodKey;
  final List<ChannelQuota> channels;
  final List<CommCampaign> recent;
  final int automationsTotal;
  final int automationsEnabled;
  final QuietHours quietHours;

  factory CommOverview.fromJson(Map<String, dynamic> j) {
    final automations = jsonMap(j['automations']);
    return CommOverview(
      periodKey: (j['periodKey'] ?? '').toString(),
      channels: [
        for (final raw in jsonList(j['channels']))
          if (ChannelQuota.tryParse(raw) case final q?) q,
      ],
      recent: jsonList(j['recent']).map(CommCampaign.fromJson).toList(),
      automationsTotal: jsonInt(automations['total']),
      automationsEnabled: jsonInt(automations['enabled']),
      quietHours: QuietHours.fromJson(j['quietHours']),
    );
  }

  ChannelQuota? quota(CommChannel c) {
    for (final q in channels) {
      if (q.channel == c) return q;
    }
    return null;
  }
}
