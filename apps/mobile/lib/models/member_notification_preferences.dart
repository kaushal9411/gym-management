import 'comm_channel.dart';
import 'payments_analytics.dart' show jsonList;

/// One channel row of `GET /portal/notification-preferences`.
class ChannelPreference {
  const ChannelPreference({
    required this.channel,
    required this.label,
    required this.promotionalOptOut,
  });

  final CommChannel channel;
  final String label;

  /// True = the member does NOT want promotional messages on this channel.
  final bool promotionalOptOut;

  ChannelPreference withOptOut(bool value) => ChannelPreference(
        channel: channel,
        label: label,
        promotionalOptOut: value,
      );
}

/// A message category that is always delivered (cannot be blocked).
class NonBlockableCategory {
  const NonBlockableCategory({required this.key, required this.label});

  final String key;
  final String label;
}

/// `GET` / `PUT /portal/notification-preferences` (member plane).
class MemberNotificationPreferences {
  const MemberNotificationPreferences({
    required this.channels,
    required this.nonBlockable,
    required this.note,
  });

  final List<ChannelPreference> channels;
  final List<NonBlockableCategory> nonBlockable;
  final String note;

  factory MemberNotificationPreferences.fromJson(Map<String, dynamic> j) =>
      MemberNotificationPreferences(
        channels: [
          for (final raw in jsonList(j['channels']))
            if (CommChannel.tryParse(raw['channel']) case final c?)
              ChannelPreference(
                channel: c,
                label: (raw['label'] ?? c.label).toString(),
                promotionalOptOut: raw['promotionalOptOut'] == true,
              ),
        ],
        nonBlockable: [
          for (final raw in jsonList(j['nonBlockable']))
            NonBlockableCategory(
              key: (raw['key'] ?? '').toString(),
              label: (raw['label'] ?? '').toString(),
            ),
        ],
        note: (j['note'] ?? '').toString(),
      );

  MemberNotificationPreferences withChannel(ChannelPreference updated) =>
      MemberNotificationPreferences(
        channels: [
          for (final c in channels) c.channel == updated.channel ? updated : c,
        ],
        nonBlockable: nonBlockable,
        note: note,
      );
}
