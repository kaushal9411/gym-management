/// The five delivery channels of the Communications module
/// (`TenantNotificationChannel` on the API), in the order every UI lists them.
///
/// Colours live in `features/communications/comm_constants.dart`; this file is
/// pure wire-format knowledge.
enum CommChannel {
  push('PUSH', 'Push', 'P'),
  inApp('IN_APP', 'In-app', 'In'),
  email('EMAIL', 'Email', '@'),
  sms('SMS', 'SMS', 'S'),
  whatsapp('WHATSAPP', 'WhatsApp', 'W');

  const CommChannel(this.api, this.label, this.short);

  /// The upper-case value on the wire.
  final String api;
  final String label;

  /// One- or two-character glyph used in the channel dots.
  final String short;

  /// Email, SMS and WhatsApp are metered (platform ceiling -> gym toggle ->
  /// monthly quota); push and in-app never are.
  bool get isPaid =>
      this == CommChannel.email ||
      this == CommChannel.sms ||
      this == CommChannel.whatsapp;

  /// Channels a staff test-send can reach (the member inbox is member-only).
  bool get canTestSend => this != CommChannel.inApp;

  /// Channels a member may opt out of for promotions.
  bool get memberCanOptOut => this != CommChannel.inApp;

  /// Parses a wire value; null for anything unknown (a newer API channel).
  static CommChannel? tryParse(Object? raw) {
    if (raw is! String) return null;
    for (final c in CommChannel.values) {
      if (c.api == raw) return c;
    }
    return null;
  }

  /// Parses a JSON list of wire values, dropping unknown/duplicate ones and
  /// returning them in canonical order.
  static List<CommChannel> parseList(Object? raw) {
    if (raw is! List) return const [];
    final found = <CommChannel>{};
    for (final v in raw) {
      final c = tryParse(v);
      if (c != null) found.add(c);
    }
    return [
      for (final c in CommChannel.values)
        if (found.contains(c)) c,
    ];
  }
}

/// Joins channel labels for a sentence: "Push", "Push and Email",
/// "Push, Email and SMS".
String joinChannelLabels(Iterable<CommChannel> channels) {
  final labels = channels.map((c) => c.label).toList();
  if (labels.isEmpty) return 'No channel';
  if (labels.length == 1) return labels.first;
  return '${labels.sublist(0, labels.length - 1).join(', ')} and ${labels.last}';
}
