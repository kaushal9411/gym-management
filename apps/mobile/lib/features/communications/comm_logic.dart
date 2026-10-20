import '../../core/utils/count_format.dart';
import '../../models/comm_audience.dart';
import '../../models/comm_campaign.dart';
import '../../models/comm_channel.dart';
import 'comm_constants.dart';

/// Pure validation + formatting rules of the Communications flow. Everything
/// here mirrors a server rule (`apps/api/src/modules/communications`), so a
/// problem is caught on the step where it is fixed instead of as a 422 at the
/// very end. The server stays the authority: its answers are still mapped
/// back onto the fields (see `CommFailure`).

final _token = RegExp(r'\{\{\s*([A-Za-z0-9_]+)\s*\}\}');

/// Names of the `{{placeholders}}` in [text] that are not in [allowed].
List<String> unknownPlaceholders(
  String text, {
  List<String> allowed = kCommPlaceholders,
}) {
  final out = <String>[];
  for (final m in _token.allMatches(text)) {
    final name = m.group(1)!;
    if (!allowed.contains(name) && !out.contains(name)) out.add(name);
  }
  return out;
}

/// Human problems with the placeholders in [text] (empty = fine): unknown
/// names are named, stray or half-written braces get their own sentence.
List<String> placeholderIssues(
  String text, {
  List<String> allowed = kCommPlaceholders,
}) {
  final issues = <String>[];
  for (final name in unknownPlaceholders(text, allowed: allowed)) {
    issues.add(
      'Unknown placeholder {{$name}}. Use only: '
      '${allowed.map((p) => '{{$p}}').join(' ')}',
    );
  }
  final leftover = text.replaceAll(_token, '');
  if (leftover.contains('{{') || leftover.contains('}}')) {
    issues.add(
      'Incomplete placeholder: every "{{" or "}}" must be part of a whole '
      '{{name}}.',
    );
  }
  return issues;
}

/// Fills known `{{name}}` tokens; unknown ones are left as typed.
String renderPlaceholders(String text, Map<String, String> vars) =>
    text.replaceAllMapped(
      _token,
      (m) => vars[m.group(1)] ?? m.group(0)!,
    );

/// Title rules: required, at most [kCommTitleMax] characters, valid
/// placeholders. Null = valid.
String? validateTitle(String title) {
  final t = title.trim();
  if (t.isEmpty) return 'Add a title.';
  if (t.length > kCommTitleMax) {
    return 'The title can be at most $kCommTitleMax characters '
        '(now ${t.length}).';
  }
  final issues = placeholderIssues(t);
  return issues.isEmpty ? null : issues.first;
}

/// Message rules: required, at most [kCommBodyMax] characters, valid
/// placeholders. Null = valid.
String? validateBody(String body) {
  final t = body.trim();
  if (t.isEmpty) return 'Write the message.';
  if (t.length > kCommBodyMax) {
    return 'The message can be at most $kCommBodyMax characters '
        '(now ${t.length}).';
  }
  final issues = placeholderIssues(t);
  return issues.isEmpty ? null : issues.first;
}

/// SMS carries `title\nbody` after placeholders are filled in; the API caps
/// that at [kCommSmsMax]. Null = fits (or SMS is not used).
String? validateSmsLength(
  String title,
  String body, {
  Map<String, String> vars = kCommSampleVars,
}) {
  final text = renderPlaceholders('${title.trim()}\n${body.trim()}', vars);
  if (text.length <= kCommSmsMax) return null;
  return 'For SMS the title and message together can be at most '
      '$kCommSmsMax characters (yours is about ${text.length}). Shorten it '
      'or turn SMS off.';
}

/// Schedule rules: at least a minute ahead, at most [kCommMaxScheduleDays]
/// days ahead. Null = valid.
String? validateSchedule(DateTime? at, DateTime now) {
  if (at == null) return 'Choose a date and time, or send now.';
  final soonest = now.add(
    const Duration(minutes: kCommMinScheduleLeadMinutes),
  );
  if (at.isBefore(soonest)) {
    return 'Pick a time at least a minute from now.';
  }
  if (at.isAfter(now.add(const Duration(days: kCommMaxScheduleDays)))) {
    return 'You can schedule at most $kCommMaxScheduleDays days ahead.';
  }
  return null;
}

/// At least one channel is needed.
String? validateChannelsSelected(Iterable<CommChannel> channels) =>
    channels.isEmpty ? 'Choose at least one channel.' : null;

/// Why [channel] cannot be used for this audience, or null when it can:
/// switched off for the gym, or not enough monthly allowance.
String? channelBlockReason(AudiencePreview preview, CommChannel channel) {
  final a = preview.forChannel(channel);
  if (a == null) return null;
  final q = a.quota;
  if (!q.enabled) {
    return '${channel.label} is ${switch (q.disabledReason) {
      'disabled_platform' => 'not included in your plan',
      'disabled_tenant' => 'switched off in your gym settings',
      _ => 'switched off',
    }}.';
  }
  if (q.over) {
    return 'Only ${groupDigits(q.remaining ?? 0)} ${channel.label} left this '
        'month, you need ${groupDigits(q.wouldUse)}.';
  }
  return null;
}

/// Messages [channel] would use for this audience.
int messagesFor(AudiencePreview preview, CommChannel channel) =>
    preview.forChannel(channel)?.willReceive ?? 0;

/// "412 push · 412 in-app" for the review summary.
String usesLine(AudiencePreview preview, Iterable<CommChannel> channels) {
  final parts = [
    for (final c in channels)
      '${groupDigits(messagesFor(preview, c))} ${c.label.toLowerCase()}',
  ];
  return parts.isEmpty ? '—' : parts.join(' · ');
}

/// "All active members", or the filters joined: "Expiring in 7 days · Monthly".
/// [names] maps plan / branch ids to display names.
String describeAudience({
  required AudienceMode mode,
  required AudienceFilter filter,
  required int pickedCount,
  Map<String, String> names = const {},
}) {
  if (mode == AudienceMode.picked) {
    return pickedCount == 1
        ? '1 picked member'
        : '${groupDigits(pickedCount)} picked members';
  }
  if (filter.isEmpty) return 'All active members';
  final parts = <String>[
    if (filter.membershipStatus == kAudienceStatusExpiring)
      'Expiring in ${filter.expiringWithinDays} days',
    if (filter.membershipStatus == kAudienceStatusExpired) 'Expired',
    if (filter.membershipStatus == kAudienceStatusFrozen) 'Frozen',
    for (final id in filter.planIds) names[id] ?? 'Plan',
    for (final id in filter.branchIds) names[id] ?? 'Branch',
    if (filter.hasOverdueInvoice) 'Overdue invoice',
    if (filter.notVisitedDays != null)
      'Not visited in ${filter.notVisitedDays} days',
    if (filter.birthdayThisWeek) 'Birthday this week',
  ];
  return parts.join(' · ');
}

// ── dates ────────────────────────────────────────────────────────────────

const _months = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

String _hm(DateTime l) {
  final h = l.hour % 12 == 0 ? 12 : l.hour % 12;
  final m = l.minute.toString().padLeft(2, '0');
  return '$h:$m ${l.hour >= 12 ? 'pm' : 'am'}';
}

/// "today" / "yesterday" / "15 Oct" (+ year when not this year), lower-case
/// first letter variants are produced by [commDay].
String commDay(DateTime? d, {DateTime? now}) {
  if (d == null) return '—';
  final n = (now ?? DateTime.now());
  final l = d.toLocal();
  final today = DateTime(n.year, n.month, n.day);
  final that = DateTime(l.year, l.month, l.day);
  final diff = today.difference(that).inDays;
  if (diff == 0) return 'today';
  if (diff == 1) return 'yesterday';
  final base = '${l.day} ${_months[l.month - 1]}';
  return l.year == n.year ? base : '$base ${l.year}';
}

/// "15 Oct, 8:00 am" (local time).
String commDateTime(DateTime? d, {DateTime? now}) {
  if (d == null) return '—';
  final l = d.toLocal();
  final day = commDay(l, now: now);
  final label = day == 'today' || day == 'yesterday'
      ? '${day[0].toUpperCase()}${day.substring(1)}'
      : day;
  return '$label, ${_hm(l)}';
}

/// Poll cadence of a campaign that is still sending: every 3 s for the first
/// two minutes, then every 15 s (held SMS can keep a send open all night).
Duration campaignPollInterval(Duration elapsed) =>
    elapsed < const Duration(minutes: 2)
        ? const Duration(seconds: 3)
        : const Duration(seconds: 15);

// ── campaign wording ─────────────────────────────────────────────────────

enum CommTone { ok, warn, run, bad, neutral }

CommTone campaignTone(CommCampaign c) => switch (c.status) {
      CampaignStatus.sent => CommTone.ok,
      CampaignStatus.partial => CommTone.warn,
      CampaignStatus.sending || CampaignStatus.scheduled => CommTone.run,
      CampaignStatus.failed => CommTone.bad,
      _ => CommTone.neutral,
    };

/// The pill text: "Sending", "Sent", "2 failed" (partly sent with failures)...
String campaignPillText(CommCampaign c) {
  if (c.status == CampaignStatus.partial && c.failedCount > 0) {
    return '${groupDigits(c.failedCount)} failed';
  }
  return c.status.label;
}

/// "412 members · today" — what the row under a campaign name says.
String campaignSubtitle(CommCampaign c, {DateTime? now}) {
  final n = c.recipientCount;
  final who = c.status == CampaignStatus.draft && n == 0
      ? 'Not sent yet'
      : '${groupDigits(n)} ${n == 1 ? 'member' : 'members'}';
  final day = c.when;
  if (c.status == CampaignStatus.scheduled && day != null) {
    return '$who · ${commDateTime(day, now: now)}';
  }
  return day == null ? who : '$who · ${commDay(day, now: now)}';
}
