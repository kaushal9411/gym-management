import 'comm_audience.dart';
import 'comm_channel.dart';

/// `templateKey` — a label only; the text is always what was typed.
enum CommTemplateGroup {
  offers('Offers'),
  reminders('Reminders'),
  notices('Notices');

  const CommTemplateGroup(this.label);
  final String label;
}

enum CommTemplate {
  custom('CUSTOM', 'Custom'),
  specialOffer('SPECIAL_OFFER', 'Special offer', CommTemplateGroup.offers),
  winterOffer('WINTER_OFFER', 'Winter offer', CommTemplateGroup.offers),
  summerOffer('SUMMER_OFFER', 'Summer offer', CommTemplateGroup.offers),
  festiveOffer('FESTIVE_OFFER', 'Festive offer', CommTemplateGroup.offers),
  renewalOffer('RENEWAL_OFFER', 'Early renewal', CommTemplateGroup.offers),
  referFriend('REFER_FRIEND', 'Refer a friend', CommTemplateGroup.offers),
  comeback('COMEBACK_OFFER', 'We miss you', CommTemplateGroup.offers),
  expiring('MEMBERSHIP_EXPIRING', 'Expiring', CommTemplateGroup.reminders),
  overdue('PAYMENT_OVERDUE', 'Overdue', CommTemplateGroup.reminders),
  classUpdate('CLASS_UPDATE', 'New class', CommTemplateGroup.reminders),
  holidayNotice('HOLIDAY_NOTICE', 'Holiday notice', CommTemplateGroup.notices),
  timingChange('TIMING_CHANGE', 'Timing change', CommTemplateGroup.notices),
  feedback('FEEDBACK_REQUEST', 'Feedback', CommTemplateGroup.notices);

  const CommTemplate(this.api, this.label, [this.group]);
  final String api;
  final String label;

  /// null for Custom, which is not in any group.
  final CommTemplateGroup? group;
}

/// When a campaign goes out.
enum CommSendMode {
  now('NOW'),
  schedule('SCHEDULE'),
  draft('DRAFT');

  const CommSendMode(this.api);
  final String api;
}

/// Body of `POST /communications/campaigns` (strict on the server, so only
/// known keys are emitted, and `pickedMemberIds` / `audienceFilter` are
/// mutually exclusive).
class CampaignRequest {
  const CampaignRequest({
    required this.title,
    required this.body,
    required this.channels,
    required this.mode,
    this.filter = AudienceFilter.empty,
    this.pickedMemberIds = const [],
    this.template = CommTemplate.custom,
    this.sendMode = CommSendMode.now,
    this.scheduledAt,
    this.holdQuietHours = true,
    this.confirmLargeSend = false,
  });

  final String title;
  final String body;
  final List<CommChannel> channels;
  final AudienceMode mode;
  final AudienceFilter filter;
  final List<String> pickedMemberIds;
  final CommTemplate template;
  final CommSendMode sendMode;
  final DateTime? scheduledAt;
  final bool holdQuietHours;
  final bool confirmLargeSend;

  Map<String, dynamic> toJson() => {
        'title': title.trim(),
        'body': body.trim(),
        'channels': [for (final c in channels) c.api],
        'audienceMode': mode.api,
        if (mode == AudienceMode.filters) 'audienceFilter': filter.toJson(),
        if (mode == AudienceMode.picked) 'pickedMemberIds': pickedMemberIds,
        'templateKey': template.api,
        'sendMode': sendMode.api,
        if (sendMode == CommSendMode.schedule && scheduledAt != null)
          'scheduledAt': scheduledAt!.toUtc().toIso8601String(),
        'holdQuietHours': holdQuietHours,
        'confirmLargeSend': confirmLargeSend,
      };
}
