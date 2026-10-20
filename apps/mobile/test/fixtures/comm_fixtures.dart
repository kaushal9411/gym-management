import 'package:gym_saas_mobile/models/comm_audience.dart';
import 'package:gym_saas_mobile/models/comm_automation.dart';
import 'package:gym_saas_mobile/models/comm_campaign.dart';
import 'package:gym_saas_mobile/models/comm_overview.dart';

/// JSON shaped exactly like docs/COMMUNICATIONS-API.md (decimals/ints may
/// arrive as strings in places, nullable fields as null).

Map<String, dynamic> channelQuotaJson(
  String channel, {
  bool enabled = true,
  String? reason,
  Object? limit,
  Object used = 0,
  Object? remaining,
}) =>
    {
      'channel': channel,
      'enabled': enabled,
      'disabledReason': reason,
      'limit': limit,
      'used': used,
      'remaining': remaining,
    };

Map<String, dynamic> campaignJson({
  String id = 'c1',
  String name = 'Diwali timings',
  String status = 'SENT',
  List<String> channels = const ['EMAIL', 'SMS'],
  int recipients = 38,
  int messages = 38,
  int sent = 34,
  int failed = 2,
  int skipped = 2,
  int queued = 0,
  String? failureReason,
  List<String> notices = const [],
}) =>
    {
      'id': id,
      'name': name,
      'title': 'Hi {{firstName}}',
      'body': 'Body',
      'channels': channels,
      'audienceMode': 'FILTERS',
      'audienceFilter': <String, dynamic>{},
      'pickedCount': 0,
      'templateKey': 'CUSTOM',
      'status': status,
      'scheduledAt': null,
      'startedAt': '2026-10-15T02:30:00.000Z',
      'finishedAt': null,
      'holdQuietHours': true,
      'recipientCount': recipients,
      'messageCount': messages,
      'queuedCount': queued,
      'sentCount': sent,
      'failedCount': failed,
      'skippedCount': skipped,
      'cancelledCount': 0,
      'failureReason': failureReason,
      'createdBy': {'id': 'u1', 'name': 'Asha'},
      'createdAt': '2026-10-15T02:29:00.000Z',
      'updatedAt': '2026-10-15T02:31:00.000Z',
      'notices': notices,
    };

Map<String, dynamic> overviewJson({List<Map<String, dynamic>>? recent}) => {
      'periodKey': '2026-10',
      'channels': [
        channelQuotaJson('PUSH'),
        channelQuotaJson('IN_APP'),
        channelQuotaJson('EMAIL', limit: 5000, used: 1210, remaining: 3790),
        channelQuotaJson('SMS', limit: '1000', used: '760', remaining: 240),
        channelQuotaJson('WHATSAPP', enabled: false, reason: 'disabled_platform'),
      ],
      'recent': recent ??
          [
            campaignJson(id: 'a', name: 'Extended closing time', status: 'SENDING', recipients: 412, messages: 824, sent: 410, failed: 0, skipped: 0, queued: 414),
            campaignJson(id: 'b', name: 'Renew before 31 Oct', status: 'PARTIAL'),
            campaignJson(id: 'c', name: 'Diwali timings', recipients: 297, messages: 297, sent: 297, failed: 0, skipped: 0),
          ],
      'automations': {'total': 9, 'enabled': 8},
      'quietHours': {
        'start': '21:00',
        'end': '08:00',
        'channels': ['SMS', 'WHATSAPP'],
        'timezoneBasis': 'member branch',
      },
    };

Map<String, dynamic> channelAudienceJson(
  String channel, {
  int contactable = 400,
  int optedOut = 0,
  int willReceive = 400,
  bool enabled = true,
  String? reason,
  int? limit,
  int used = 0,
  int? remaining,
  bool over = false,
  int shortBy = 0,
}) =>
    {
      'channel': channel,
      'contactable': contactable,
      'optedOut': optedOut,
      'willReceive': willReceive,
      'quota': {
        'enabled': enabled,
        'disabledReason': reason,
        'limit': limit,
        'used': used,
        'remaining': remaining,
        'wouldUse': willReceive,
        'over': over,
        'shortBy': shortBy,
      },
    };

/// A 412-member preview: push/in-app free, email fine, SMS over its limit,
/// WhatsApp switched off by the plan.
Map<String, dynamic> previewJson({
  int total = 412,
  bool largeSend = true,
  bool exceedsMax = false,
  List<Map<String, dynamic>>? channels,
  bool withSms = true,
}) =>
    {
      'total': total,
      'sample': [
        {'id': 'm1', 'memberId': 'MEM-0001', 'name': 'Aarav K.'},
        {'id': 'm2', 'memberId': 'MEM-0002', 'name': 'Diya A.'},
      ],
      'maxRecipients': 5000,
      'exceedsMax': exceedsMax,
      'largeSend': largeSend,
      'largeSendThreshold': 100,
      'channels': channels ??
          [
            channelAudienceJson('PUSH', contactable: 390, willReceive: 390),
            channelAudienceJson('IN_APP', contactable: total, willReceive: total),
            channelAudienceJson('EMAIL', contactable: 400, optedOut: 12, willReceive: 388, limit: 5000, used: 1210, remaining: 3790),
            channelAudienceJson('SMS', contactable: 380, willReceive: 380, limit: 1000, used: 760, remaining: 240, over: true, shortBy: 140),
            channelAudienceJson('WHATSAPP', enabled: false, reason: 'disabled_platform', willReceive: 0, contactable: 0),
          ],
      'overLimit': ['SMS', 'WHATSAPP'],
      if (withSms) 'sms': {'characters': 143, 'segments': 1, 'encoding': 'GSM-7'},
    };

Map<String, dynamic> automationJson(
  String key, {
  String label = 'Membership expiring',
  bool enabled = true,
  List<int> offsets = const [7, 3, 1],
  List<String> channels = const ['PUSH', 'EMAIL'],
  String unit = 'DAYS_BEFORE',
  bool editable = true,
  List<Map<String, String>> unavailable = const [],
}) =>
    {
      'key': key,
      'label': label,
      'description': 'Before the end date, to members with an active plan.',
      'kind': 'TRANSACTIONAL',
      'timing': {
        'unit': unit,
        'editable': editable,
        'min': 1,
        'max': 60,
        'maxCount': 5,
        'defaultOffsets': [7, 3, 1],
      },
      'enabled': enabled,
      'isDefault': true,
      'offsets': offsets,
      'channels': channels,
      'allowedChannels': ['PUSH', 'IN_APP', 'EMAIL', 'SMS', 'WHATSAPP'],
      'unavailableChannels': unavailable,
      'title': null,
      'body': null,
      'defaultTitle': 'T',
      'defaultBody': 'B',
      'allowedPlaceholders': ['firstName'],
      'sentLast7Days': 38,
      'lastSentAt': null,
      'updatedAt': null,
    };

Map<String, dynamic> automationsJson() => {
      'quietHours': {'start': '21:00', 'end': '08:00', 'channels': ['SMS', 'WHATSAPP']},
      'items': [
        automationJson('MEMBERSHIP_EXPIRING'),
        automationJson(
          'MEMBERSHIP_EXPIRED',
          label: 'Membership expired',
          offsets: [1],
          unit: 'DAYS_AFTER',
        ),
        automationJson(
          'BIRTHDAY',
          label: 'Birthday',
          offsets: [],
          unit: 'ON_DAY',
          editable: false,
          unavailable: [
            {'channel': 'SMS', 'reason': 'disabled_platform'},
          ],
          channels: ['PUSH', 'SMS'],
        ),
        automationJson(
          'WE_MISS_YOU',
          label: 'We miss you',
          enabled: false,
          offsets: [14],
          unit: 'DAYS_SINCE_VISIT',
          channels: ['PUSH'],
        ),
      ],
    };

CommOverview overview() => CommOverview.fromJson(overviewJson());
AudiencePreview preview({int total = 412, bool largeSend = true}) =>
    AudiencePreview.fromJson(previewJson(total: total, largeSend: largeSend));
CommCampaign campaign({String status = 'SENT'}) =>
    CommCampaign.fromJson(campaignJson(status: status));
AutomationList automations() => AutomationList.fromJson(automationsJson());

Map<String, dynamic> detailJson({
  String status = 'PARTIAL',
  int heldCount = 0,
}) =>
    {
      ...campaignJson(status: status),
      'breakdown': [
        {'channel': 'EMAIL', 'total': 38, 'queued': 0, 'sent': 34, 'failed': 2, 'skipped': 2, 'cancelled': 0},
        {'channel': 'SMS', 'total': 0, 'queued': 0, 'sent': 0, 'failed': 0, 'skipped': 0, 'cancelled': 0},
      ],
      'skippedByReason': {
        'SKIPPED_OPTED_OUT': 2,
        'SKIPPED_NO_CONTACT': 0,
        'SKIPPED_QUOTA': 0,
        'SKIPPED_DISABLED': 0,
      },
      'heldCount': heldCount,
      'nextReleaseAt': null,
    };

Map<String, dynamic> recipientJson(
  String id,
  String name, {
  String channel = 'SMS',
  String status = 'FAILED',
  String? error = 'Phone number is not valid',
}) =>
    {
      'id': id,
      'memberId': 'uuid-$id',
      'memberCode': 'MEM-$id',
      'memberName': name,
      'channel': channel,
      'status': status,
      'error': error,
      'sentAt': null,
      'heldUntil': null,
    };

Map<String, dynamic> pickerJson(String id, String name) => {
      'id': id,
      'memberId': 'MEM-$id',
      'name': name,
      'planName': 'Monthly',
      'branchId': 'b1',
      'branchName': 'Main Branch',
      'membershipStatus': 'ACTIVE',
      'hasEmail': true,
      'hasPhone': true,
      'hasDevice': false,
    };
