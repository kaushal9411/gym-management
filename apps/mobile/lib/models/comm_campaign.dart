import 'comm_channel.dart';
import 'payments_analytics.dart' show jsonInt, jsonList, jsonMap;

/// `CampaignStatus` on the wire. [unknown] absorbs a newer server value so
/// one odd row never breaks the list.
enum CampaignStatus {
  draft('DRAFT', 'Draft'),
  scheduled('SCHEDULED', 'Scheduled'),
  sending('SENDING', 'Sending'),
  sent('SENT', 'Sent'),
  partial('PARTIAL', 'Partly sent'),
  failed('FAILED', 'Failed'),
  cancelled('CANCELLED', 'Cancelled'),
  unknown('', 'Unknown');

  const CampaignStatus(this.api, this.label);
  final String api;
  final String label;

  static CampaignStatus parse(Object? raw) {
    for (final s in CampaignStatus.values) {
      if (s != unknown && s.api == raw) return s;
    }
    return unknown;
  }

  /// A cancel is possible (the API: DRAFT | SCHEDULED | SENDING).
  bool get canCancel => this == draft || this == scheduled || this == sending;

  /// "Send again to failed only" can apply (SENT | PARTIAL | FAILED).
  bool get canRetryFailed => this == sent || this == partial || this == failed;

  bool get isActive => this == sending || this == scheduled;
}

/// A staff member's name next to a campaign.
class CampaignAuthor {
  const CampaignAuthor({required this.id, required this.name});

  final String id;
  final String name;

  static CampaignAuthor? tryParse(Object? raw) {
    if (raw is! Map<String, dynamic>) return null;
    return CampaignAuthor(
      id: (raw['id'] ?? '').toString(),
      name: (raw['name'] ?? '').toString(),
    );
  }
}

/// `CampaignDto`. Counts are MESSAGE level (one per recipient x channel)
/// except [recipientCount].
class CommCampaign {
  const CommCampaign({
    required this.id,
    required this.name,
    required this.title,
    required this.body,
    required this.status,
    this.channels = const [],
    this.audienceMode = 'FILTERS',
    this.pickedCount = 0,
    this.scheduledAt,
    this.startedAt,
    this.finishedAt,
    this.holdQuietHours = true,
    this.recipientCount = 0,
    this.messageCount = 0,
    this.queuedCount = 0,
    this.sentCount = 0,
    this.failedCount = 0,
    this.skippedCount = 0,
    this.cancelledCount = 0,
    this.failureReason,
    this.createdBy,
    this.createdAt,
    this.updatedAt,
    this.notices = const [],
    this.idempotentReplay = false,
  });

  final String id;
  final String name;
  final String title;
  final String body;
  final CampaignStatus status;
  final List<CommChannel> channels;
  final String audienceMode;
  final int pickedCount;
  final DateTime? scheduledAt;
  final DateTime? startedAt;
  final DateTime? finishedAt;
  final bool holdQuietHours;
  final int recipientCount;
  final int messageCount;
  final int queuedCount;
  final int sentCount;
  final int failedCount;
  final int skippedCount;
  final int cancelledCount;
  final String? failureReason;
  final CampaignAuthor? createdBy;
  final DateTime? createdAt;
  final DateTime? updatedAt;
  final List<String> notices;
  final bool idempotentReplay;

  factory CommCampaign.fromJson(Map<String, dynamic> j) => CommCampaign(
        id: (j['id'] ?? '').toString(),
        name: (j['name'] ?? '').toString(),
        title: (j['title'] ?? '').toString(),
        body: (j['body'] ?? '').toString(),
        status: CampaignStatus.parse(j['status']),
        channels: CommChannel.parseList(j['channels']),
        audienceMode: (j['audienceMode'] ?? 'FILTERS').toString(),
        pickedCount: jsonInt(j['pickedCount']),
        scheduledAt: _date(j['scheduledAt']),
        startedAt: _date(j['startedAt']),
        finishedAt: _date(j['finishedAt']),
        holdQuietHours: j['holdQuietHours'] != false,
        recipientCount: jsonInt(j['recipientCount']),
        messageCount: jsonInt(j['messageCount']),
        queuedCount: jsonInt(j['queuedCount']),
        sentCount: jsonInt(j['sentCount']),
        failedCount: jsonInt(j['failedCount']),
        skippedCount: jsonInt(j['skippedCount']),
        cancelledCount: jsonInt(j['cancelledCount']),
        failureReason: j['failureReason'] as String?,
        createdBy: CampaignAuthor.tryParse(j['createdBy']),
        createdAt: _date(j['createdAt']),
        updatedAt: _date(j['updatedAt']),
        notices: j['notices'] is List
            ? (j['notices'] as List).whereType<String>().toList()
            : const [],
        idempotentReplay: j['idempotentReplay'] == true,
      );

  /// What to show as the headline: the internal name, else the title.
  String get displayName => name.trim().isNotEmpty ? name : title;

  /// The moment that matters for "when": scheduled time while it waits,
  /// otherwise when it started, else when it was created.
  DateTime? get when => status == CampaignStatus.scheduled
      ? (scheduledAt ?? createdAt)
      : (startedAt ?? scheduledAt ?? createdAt);

  /// Messages that left the building without trouble.
  int get delivered => sentCount;
}

DateTime? _date(Object? v) => v is String ? DateTime.tryParse(v) : null;

/// Per-channel message counts of a campaign.
class ChannelBreakdown {
  const ChannelBreakdown({
    required this.channel,
    this.total = 0,
    this.queued = 0,
    this.sent = 0,
    this.failed = 0,
    this.skipped = 0,
    this.cancelled = 0,
  });

  final CommChannel channel;
  final int total;
  final int queued;
  final int sent;
  final int failed;
  final int skipped;
  final int cancelled;

  static ChannelBreakdown? tryParse(Map<String, dynamic> j) {
    final c = CommChannel.tryParse(j['channel']);
    if (c == null) return null;
    return ChannelBreakdown(
      channel: c,
      total: jsonInt(j['total']),
      queued: jsonInt(j['queued']),
      sent: jsonInt(j['sent']),
      failed: jsonInt(j['failed']),
      skipped: jsonInt(j['skipped']),
      cancelled: jsonInt(j['cancelled']),
    );
  }
}

/// Recipient-row statuses (`RecipientStatus`).
const kRecipientFailed = 'FAILED';
const kRecipientOptedOut = 'SKIPPED_OPTED_OUT';
const kRecipientNoContact = 'SKIPPED_NO_CONTACT';
const kRecipientQuota = 'SKIPPED_QUOTA';
const kRecipientDisabled = 'SKIPPED_DISABLED';

String recipientStatusLabel(String s) => switch (s) {
      'QUEUED' => 'Queued',
      'SENT' => 'Sent',
      'FAILED' => 'Failed',
      'SKIPPED_OPTED_OUT' => 'Opted out',
      'SKIPPED_NO_CONTACT' => 'No contact',
      'SKIPPED_QUOTA' => 'Over limit',
      'SKIPPED_DISABLED' => 'Channel off',
      'CANCELLED' => 'Cancelled',
      _ => s,
    };

/// `GET /communications/campaigns/:id` — the campaign plus its breakdown.
class CampaignDetail {
  const CampaignDetail({
    required this.campaign,
    this.breakdown = const [],
    this.skippedByReason = const {},
    this.heldCount = 0,
    this.nextReleaseAt,
    this.pickedMemberIds = const [],
  });

  final CommCampaign campaign;
  final List<ChannelBreakdown> breakdown;

  /// `SKIPPED_*` status -> count.
  final Map<String, int> skippedByReason;
  final int heldCount;
  final DateTime? nextReleaseAt;
  final List<String> pickedMemberIds;

  factory CampaignDetail.fromJson(Map<String, dynamic> j) {
    final skipped = <String, int>{};
    jsonMap(j['skippedByReason']).forEach((k, v) => skipped[k] = jsonInt(v));
    return CampaignDetail(
      campaign: CommCampaign.fromJson(j),
      breakdown: [
        for (final raw in jsonList(j['breakdown']))
          if (ChannelBreakdown.tryParse(raw) case final b?) b,
      ],
      skippedByReason: skipped,
      heldCount: jsonInt(j['heldCount']),
      nextReleaseAt: _date(j['nextReleaseAt']),
      pickedMemberIds: j['pickedMemberIds'] is List
          ? (j['pickedMemberIds'] as List).whereType<String>().toList()
          : const [],
    );
  }

  int skipped(String status) => skippedByReason[status] ?? 0;

  /// Skip reasons that actually occurred, in a stable order.
  List<String> get skipReasons => [
        for (final s in const [
          kRecipientOptedOut,
          kRecipientNoContact,
          kRecipientQuota,
          kRecipientDisabled,
        ])
          if (skipped(s) > 0) s,
      ];
}

/// Tenant-wide per-status counts on the campaign list (ignore the filter).
class CampaignCounts {
  const CampaignCounts({
    this.all = 0,
    this.draft = 0,
    this.scheduled = 0,
    this.sending = 0,
    this.sent = 0,
    this.partial = 0,
    this.failed = 0,
    this.cancelled = 0,
  });

  final int all;
  final int draft;
  final int scheduled;
  final int sending;
  final int sent;
  final int partial;
  final int failed;
  final int cancelled;

  static CampaignCounts? tryParse(Object? raw) {
    if (raw is! Map<String, dynamic>) return null;
    return CampaignCounts(
      all: jsonInt(raw['all']),
      draft: jsonInt(raw['draft']),
      scheduled: jsonInt(raw['scheduled']),
      sending: jsonInt(raw['sending']),
      sent: jsonInt(raw['sent']),
      partial: jsonInt(raw['partial']),
      failed: jsonInt(raw['failed']),
      cancelled: jsonInt(raw['cancelled']),
    );
  }

  int forStatus(CampaignStatus? s) => switch (s) {
        null => all,
        CampaignStatus.draft => draft,
        CampaignStatus.scheduled => scheduled,
        CampaignStatus.sending => sending,
        CampaignStatus.sent => sent,
        CampaignStatus.partial => partial,
        CampaignStatus.failed => failed,
        CampaignStatus.cancelled => cancelled,
        CampaignStatus.unknown => 0,
      };
}

/// One row of `GET /communications/campaigns/:id/recipients`.
class CampaignRecipient {
  const CampaignRecipient({
    required this.id,
    required this.memberCode,
    required this.memberName,
    required this.channel,
    required this.status,
    this.error,
    this.sentAt,
    this.heldUntil,
  });

  final String id;
  final String memberCode;
  final String memberName;
  final CommChannel? channel;
  final String status;
  final String? error;
  final DateTime? sentAt;
  final DateTime? heldUntil;

  factory CampaignRecipient.fromJson(Map<String, dynamic> j) =>
      CampaignRecipient(
        id: (j['id'] ?? '').toString(),
        memberCode: (j['memberCode'] ?? '').toString(),
        memberName: (j['memberName'] ?? '').toString(),
        channel: CommChannel.tryParse(j['channel']),
        status: (j['status'] ?? '').toString(),
        error: j['error'] as String?,
        sentAt: _date(j['sentAt']),
        heldUntil: _date(j['heldUntil']),
      );
}
