import 'comm_channel.dart';
import 'payments_analytics.dart' show jsonInt, jsonList, jsonMap;

/// How a campaign's audience is chosen (`audienceMode`).
enum AudienceMode {
  filters('FILTERS'),
  picked('PICKED');

  const AudienceMode(this.api);
  final String api;
}

/// Membership-status values of the audience filter.
const kAudienceStatusExpiring = 'EXPIRING';
const kAudienceStatusExpired = 'EXPIRED';
const kAudienceStatusFrozen = 'FROZEN';

/// The "By filters" half of an audience (`audienceFilter`). Every field is
/// optional and AND-combined server-side. Immutable; the `with…`/`toggle…`
/// helpers return updated copies.
///
/// Only the filters the mobile design offers are modelled (membership status,
/// plan, branch, overdue invoice, not visited, birthday); the API also accepts
/// trainers / unpaid invoices / a booked class session.
class AudienceFilter {
  const AudienceFilter({
    this.membershipStatus,
    this.expiringWithinDays = 7,
    this.planIds = const [],
    this.branchIds = const [],
    this.hasOverdueInvoice = false,
    this.notVisitedDays,
    this.birthdayThisWeek = false,
  });

  final String? membershipStatus;

  /// Only sent together with `membershipStatus: EXPIRING` (the API rejects it
  /// otherwise).
  final int expiringWithinDays;
  final List<String> planIds;
  final List<String> branchIds;
  final bool hasOverdueInvoice;
  final int? notVisitedDays;
  final bool birthdayThisWeek;

  static const empty = AudienceFilter();

  /// No narrowing at all (everybody messageable).
  bool get isEmpty =>
      membershipStatus == null &&
      planIds.isEmpty &&
      branchIds.isEmpty &&
      !hasOverdueInvoice &&
      notVisitedDays == null &&
      !birthdayThisWeek;

  /// How many filters are switched on (for a "3 filters" badge).
  int get activeCount =>
      (membershipStatus == null ? 0 : 1) +
      (planIds.isEmpty ? 0 : 1) +
      (branchIds.isEmpty ? 0 : 1) +
      (hasOverdueInvoice ? 1 : 0) +
      (notVisitedDays == null ? 0 : 1) +
      (birthdayThisWeek ? 1 : 0);

  /// Selecting the already-selected status clears it.
  AudienceFilter withStatus(String? status) => AudienceFilter(
        membershipStatus: status == membershipStatus ? null : status,
        expiringWithinDays: expiringWithinDays,
        planIds: planIds,
        branchIds: branchIds,
        hasOverdueInvoice: hasOverdueInvoice,
        notVisitedDays: notVisitedDays,
        birthdayThisWeek: birthdayThisWeek,
      );

  AudienceFilter togglePlan(String id) => AudienceFilter(
        membershipStatus: membershipStatus,
        expiringWithinDays: expiringWithinDays,
        planIds: _toggled(planIds, id),
        branchIds: branchIds,
        hasOverdueInvoice: hasOverdueInvoice,
        notVisitedDays: notVisitedDays,
        birthdayThisWeek: birthdayThisWeek,
      );

  AudienceFilter toggleBranch(String id) => AudienceFilter(
        membershipStatus: membershipStatus,
        expiringWithinDays: expiringWithinDays,
        planIds: planIds,
        branchIds: _toggled(branchIds, id),
        hasOverdueInvoice: hasOverdueInvoice,
        notVisitedDays: notVisitedDays,
        birthdayThisWeek: birthdayThisWeek,
      );

  AudienceFilter toggleOverdue() => AudienceFilter(
        membershipStatus: membershipStatus,
        expiringWithinDays: expiringWithinDays,
        planIds: planIds,
        branchIds: branchIds,
        hasOverdueInvoice: !hasOverdueInvoice,
        notVisitedDays: notVisitedDays,
        birthdayThisWeek: birthdayThisWeek,
      );

  AudienceFilter toggleNotVisited(int days) => AudienceFilter(
        membershipStatus: membershipStatus,
        expiringWithinDays: expiringWithinDays,
        planIds: planIds,
        branchIds: branchIds,
        hasOverdueInvoice: hasOverdueInvoice,
        notVisitedDays: notVisitedDays == days ? null : days,
        birthdayThisWeek: birthdayThisWeek,
      );

  AudienceFilter toggleBirthday() => AudienceFilter(
        membershipStatus: membershipStatus,
        expiringWithinDays: expiringWithinDays,
        planIds: planIds,
        branchIds: branchIds,
        hasOverdueInvoice: hasOverdueInvoice,
        notVisitedDays: notVisitedDays,
        birthdayThisWeek: !birthdayThisWeek,
      );

  static List<String> _toggled(List<String> list, String id) {
    if (list.contains(id)) {
      return [
        for (final x in list)
          if (x != id) x,
      ];
    }
    return [...list, id];
  }

  /// The strict request object: only keys that are switched on.
  Map<String, dynamic> toJson() => {
        if (membershipStatus != null) 'membershipStatus': membershipStatus,
        if (membershipStatus == kAudienceStatusExpiring)
          'expiringWithinDays': expiringWithinDays,
        if (planIds.isNotEmpty) 'planIds': planIds,
        if (branchIds.isNotEmpty) 'branchIds': branchIds,
        if (hasOverdueInvoice) 'hasOverdueInvoice': true,
        if (notVisitedDays != null) 'notVisitedDays': notVisitedDays,
        if (birthdayThisWeek) 'birthdayThisWeek': true,
      };

  /// Value equality on the wire form (used to skip a redundant preview).
  @override
  bool operator ==(Object other) =>
      other is AudienceFilter && _same(toJson(), other.toJson());

  @override
  int get hashCode => Object.hashAll(
        toJson().entries.map((e) => Object.hash(e.key, e.value.toString())),
      );

  static bool _same(Map<String, dynamic> a, Map<String, dynamic> b) {
    if (a.length != b.length) return false;
    for (final e in a.entries) {
      if (!b.containsKey(e.key) || b[e.key].toString() != e.value.toString()) {
        return false;
      }
    }
    return true;
  }
}

/// One row of `GET /communications/audience/members` (the picker). The API
/// never returns contact values, only whether each channel is reachable.
class PickerMember {
  const PickerMember({
    required this.id,
    required this.memberId,
    required this.name,
    this.planName,
    this.branchName,
    this.membershipStatus = '',
    this.hasEmail = false,
    this.hasPhone = false,
    this.hasDevice = false,
  });

  /// The member's uuid (what `pickedMemberIds` carries).
  final String id;

  /// The human member code, e.g. `MEM-0001`.
  final String memberId;
  final String name;
  final String? planName;
  final String? branchName;
  final String membershipStatus;
  final bool hasEmail;
  final bool hasPhone;
  final bool hasDevice;

  factory PickerMember.fromJson(Map<String, dynamic> j) => PickerMember(
        id: (j['id'] ?? '').toString(),
        memberId: (j['memberId'] ?? '').toString(),
        name: (j['name'] ?? '').toString(),
        planName: j['planName'] as String?,
        branchName: j['branchName'] as String?,
        membershipStatus: (j['membershipStatus'] ?? '').toString(),
        hasEmail: j['hasEmail'] == true,
        hasPhone: j['hasPhone'] == true,
        hasDevice: j['hasDevice'] == true,
      );

  String get firstName {
    final parts = name.trim().split(RegExp(r'\s+'));
    return parts.isEmpty ? '' : parts.first;
  }

  String get initials {
    final parts =
        name.trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty).toList();
    if (parts.isEmpty) return '?';
    final first = parts.first[0];
    final second = parts.length > 1 ? parts.last[0] : '';
    return '$first$second'.toUpperCase();
  }

  /// "MEM-0001 · Monthly · Main Branch" (blank parts skipped).
  String get subtitle => [
        memberId,
        if (planName != null && planName!.isNotEmpty) planName!,
        if (branchName != null && branchName!.isNotEmpty) branchName!,
      ].join(' · ');
}

/// The "sample" members of an audience preview (id, code and display name).
class AudienceSample {
  const AudienceSample({
    required this.id,
    required this.memberId,
    required this.name,
  });

  final String id;
  final String memberId;
  final String name;

  factory AudienceSample.fromJson(Map<String, dynamic> j) => AudienceSample(
        id: (j['id'] ?? '').toString(),
        memberId: (j['memberId'] ?? '').toString(),
        name: (j['name'] ?? '').toString(),
      );
}

/// A channel's monthly allowance as it would stand after this send.
class QuotaPreview {
  const QuotaPreview({
    required this.enabled,
    this.disabledReason,
    this.limit,
    this.used = 0,
    this.remaining,
    this.wouldUse = 0,
    this.over = false,
    this.shortBy = 0,
  });

  final bool enabled;

  /// `disabled_platform` (not on the plan) or `disabled_tenant` (switched off
  /// in the gym's own settings); null when enabled.
  final String? disabledReason;

  /// null = unlimited.
  final int? limit;
  final int used;
  final int? remaining;
  final int wouldUse;
  final bool over;
  final int shortBy;

  factory QuotaPreview.fromJson(Map<String, dynamic> j) => QuotaPreview(
        enabled: j['enabled'] != false,
        disabledReason: j['disabledReason'] as String?,
        limit: j['limit'] == null ? null : jsonInt(j['limit']),
        used: jsonInt(j['used']),
        remaining: j['remaining'] == null ? null : jsonInt(j['remaining']),
        wouldUse: jsonInt(j['wouldUse']),
        over: j['over'] == true,
        shortBy: jsonInt(j['shortBy']),
      );
}

/// Per-channel reach of an audience.
class ChannelAudience {
  const ChannelAudience({
    required this.channel,
    required this.contactable,
    required this.optedOut,
    required this.willReceive,
    required this.quota,
  });

  final CommChannel channel;
  final int contactable;
  final int optedOut;
  final int willReceive;
  final QuotaPreview quota;

  factory ChannelAudience.fromJson(
    CommChannel channel,
    Map<String, dynamic> j,
  ) =>
      ChannelAudience(
        channel: channel,
        contactable: jsonInt(j['contactable']),
        optedOut: jsonInt(j['optedOut']),
        willReceive: jsonInt(j['willReceive']),
        quota: QuotaPreview.fromJson(jsonMap(j['quota'])),
      );
}

/// SMS length note (`sms` block of the preview).
class SmsInfo {
  const SmsInfo({
    required this.characters,
    required this.segments,
    required this.encoding,
  });

  final int characters;
  final int segments;
  final String encoding;

  factory SmsInfo.fromJson(Map<String, dynamic> j) => SmsInfo(
        characters: jsonInt(j['characters']),
        segments: jsonInt(j['segments']),
        encoding: (j['encoding'] ?? '').toString(),
      );
}

/// `POST /communications/audience/preview`.
class AudiencePreview {
  const AudiencePreview({
    required this.total,
    this.sample = const [],
    this.maxRecipients = 5000,
    this.exceedsMax = false,
    this.largeSend = false,
    this.largeSendThreshold = 100,
    this.channels = const {},
    this.overLimit = const [],
    this.sms,
  });

  final int total;
  final List<AudienceSample> sample;
  final int maxRecipients;
  final bool exceedsMax;
  final bool largeSend;
  final int largeSendThreshold;
  final Map<CommChannel, ChannelAudience> channels;
  final List<CommChannel> overLimit;
  final SmsInfo? sms;

  factory AudiencePreview.fromJson(Map<String, dynamic> j) {
    final channels = <CommChannel, ChannelAudience>{};
    for (final raw in jsonList(j['channels'])) {
      final c = CommChannel.tryParse(raw['channel']);
      if (c != null) channels[c] = ChannelAudience.fromJson(c, raw);
    }
    final sms = j['sms'];
    return AudiencePreview(
      total: jsonInt(j['total']),
      sample: jsonList(j['sample']).map(AudienceSample.fromJson).toList(),
      maxRecipients:
          j['maxRecipients'] == null ? 5000 : jsonInt(j['maxRecipients']),
      exceedsMax: j['exceedsMax'] == true,
      largeSend: j['largeSend'] == true,
      largeSendThreshold: j['largeSendThreshold'] == null
          ? 100
          : jsonInt(j['largeSendThreshold']),
      channels: channels,
      overLimit: CommChannel.parseList(j['overLimit']),
      sms: sms is Map<String, dynamic> ? SmsInfo.fromJson(sms) : null,
    );
  }

  ChannelAudience? forChannel(CommChannel c) => channels[c];

  /// "Aarav K., Diya A. and 407 more" — null when there is nobody.
  String? get sampleLine {
    if (total <= 0) return null;
    final names = sample.map((s) => s.name).where((n) => n.isNotEmpty).toList();
    if (names.isEmpty) return null;
    final rest = total - names.length;
    return rest > 0 ? '${names.join(', ')} and $rest more' : names.join(', ');
  }
}
