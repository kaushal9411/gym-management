import 'package:flutter_test/flutter_test.dart';
import 'package:gym_saas_mobile/core/network/api_exception.dart';
import 'package:gym_saas_mobile/core/network/comm_failure.dart';
import 'package:gym_saas_mobile/core/utils/count_format.dart';
import 'package:gym_saas_mobile/models/comm_audience.dart';
import 'package:gym_saas_mobile/models/comm_automation.dart';
import 'package:gym_saas_mobile/models/comm_campaign.dart';
import 'package:gym_saas_mobile/models/comm_channel.dart';
import 'package:gym_saas_mobile/models/comm_overview.dart';
import 'package:gym_saas_mobile/models/comm_request.dart';
import 'package:gym_saas_mobile/models/member_notification_preferences.dart';

import '../fixtures/comm_fixtures.dart';

ApiException apiError(
  int? status,
  String code,
  String message, {
  Map<String, dynamic>? data,
  List<Map<String, dynamic>>? errors,
}) =>
    ApiException.fromResponseData(
      {
        'success': false,
        'message': message,
        'errors': errors ??
            [
              {'code': code, 'message': message},
            ],
        'data': data,
      },
      status,
    );

void main() {
  group('channels', () {
    test('wire values, order and unknown channels', () {
      expect(CommChannel.parseList(['SMS', 'PUSH', 'NOPE', 'SMS']),
          [CommChannel.push, CommChannel.sms],);
      expect(CommChannel.tryParse('IN_APP'), CommChannel.inApp);
      expect(CommChannel.tryParse(null), isNull);
      expect(CommChannel.email.isPaid, isTrue);
      expect(CommChannel.push.isPaid, isFalse);
      expect(CommChannel.inApp.canTestSend, isFalse);
      expect(joinChannelLabels([CommChannel.push, CommChannel.sms]),
          'Push and SMS',);
      expect(
        joinChannelLabels(
            [CommChannel.push, CommChannel.email, CommChannel.sms],),
        'Push, Email and SMS',
      );
    });

    test('Indian digit grouping', () {
      expect(groupDigits(240), '240');
      expect(groupDigits(3790), '3,790');
      expect(groupDigits(100000), '1,00,000');
      expect(groupDigits(-1234), '-1,234');
    });
  });

  group('overview', () {
    final o = CommOverview.fromJson(overviewJson());

    test('quota per channel, tolerant of string numbers and nulls', () {
      expect(o.channels.length, 5);
      expect(o.quota(CommChannel.push)!.unlimited, isTrue);
      final sms = o.quota(CommChannel.sms)!;
      expect(sms.limit, 1000);
      expect(sms.remaining, 240);
      expect(sms.usedFraction, closeTo(0.76, 1e-9));
      final wa = o.quota(CommChannel.whatsapp)!;
      expect(wa.enabled, isFalse);
      expect(wa.disabledReason, 'disabled_platform');
    });

    test('recent campaigns, automations, quiet hours', () {
      expect(o.recent.length, 3);
      expect(o.recent.first.status, CampaignStatus.sending);
      expect(o.automationsTotal, 9);
      expect(o.automationsEnabled, 8);
      expect(o.quietHours.start, '21:00');
      expect(o.quietHours.channels, [CommChannel.sms, CommChannel.whatsapp]);
    });

    test('an empty body still parses', () {
      final e = CommOverview.fromJson({});
      expect(e.channels, isEmpty);
      expect(e.recent, isEmpty);
      expect(e.automationsTotal, 0);
    });
  });

  group('audience', () {
    test('filter serialises only what is switched on', () {
      expect(AudienceFilter.empty.toJson(), isEmpty);
      final f = const AudienceFilter()
          .withStatus(kAudienceStatusExpiring)
          .togglePlan('p1')
          .toggleOverdue()
          .toggleNotVisited(14);
      expect(f.toJson(), {
        'membershipStatus': 'EXPIRING',
        'expiringWithinDays': 7,
        'planIds': ['p1'],
        'hasOverdueInvoice': true,
        'notVisitedDays': 14,
      });
      expect(f.activeCount, 4);
    });

    test('expiringWithinDays is dropped when status changes (API rejects it)',
        () {
      final f = const AudienceFilter()
          .withStatus(kAudienceStatusExpiring)
          .withStatus(kAudienceStatusExpired);
      expect(f.toJson().containsKey('expiringWithinDays'), isFalse);
      expect(f.toJson()['membershipStatus'], 'EXPIRED');
    });

    test('tapping a selected chip clears it; value equality', () {
      final a = const AudienceFilter().togglePlan('p1');
      expect(a.togglePlan('p1').isEmpty, isTrue);
      expect(a, const AudienceFilter().togglePlan('p1'));
      expect(a == const AudienceFilter(), isFalse);
      expect(const AudienceFilter().withStatus('FROZEN').withStatus('FROZEN').isEmpty, isTrue);
    });

    test('preview parses channels, quota and sample', () {
      final p = AudiencePreview.fromJson(previewJson());
      expect(p.total, 412);
      expect(p.largeSend, isTrue);
      expect(p.sampleLine, 'Aarav K., Diya A. and 410 more');
      final sms = p.forChannel(CommChannel.sms)!;
      expect(sms.quota.over, isTrue);
      expect(sms.quota.shortBy, 140);
      expect(sms.quota.remaining, 240);
      expect(p.forChannel(CommChannel.whatsapp)!.quota.enabled, isFalse);
      expect(p.sms!.segments, 1);
      expect(p.overLimit, [CommChannel.sms, CommChannel.whatsapp]);
    });

    test('preview without sms block / sample', () {
      final p = AudiencePreview.fromJson(
        previewJson(total: 0, withSms: false)..['sample'] = <Map<String, dynamic>>[],
      );
      expect(p.sms, isNull);
      expect(p.sampleLine, isNull);
    });

    test('picker member', () {
      final m = PickerMember.fromJson(pickerJson('1', 'Aarav Kapoor'));
      expect(m.initials, 'AK');
      expect(m.firstName, 'Aarav');
      expect(m.subtitle, 'MEM-1 · Monthly · Main Branch');
      expect(m.hasDevice, isFalse);
      expect(PickerMember.fromJson({'id': 'x'}).initials, '?');
    });
  });

  group('campaign', () {
    test('dto + status helpers', () {
      final c = CommCampaign.fromJson(campaignJson(status: 'PARTIAL'));
      expect(c.status, CampaignStatus.partial);
      expect(c.status.canRetryFailed, isTrue);
      expect(c.status.canCancel, isFalse);
      expect(c.channels, [CommChannel.email, CommChannel.sms]);
      expect(c.createdBy!.name, 'Asha');
      expect(c.displayName, 'Diwali timings');
      expect(c.startedAt, isNotNull);
      expect(CampaignStatus.parse('MYSTERY'), CampaignStatus.unknown);
      expect(CampaignStatus.sending.canCancel, isTrue);
    });

    test('detail adds breakdown and skip reasons', () {
      final d = CampaignDetail.fromJson(detailJson(heldCount: 3));
      expect(d.breakdown.length, 2);
      expect(d.breakdown.first.sent, 34);
      expect(d.skipReasons, [kRecipientOptedOut]);
      expect(d.skipped(kRecipientOptedOut), 2);
      expect(d.heldCount, 3);
    });

    test('counts and recipients', () {
      final counts = CampaignCounts.tryParse(
          {'all': 9, 'draft': 1, 'scheduled': 2, 'sending': 1, 'sent': 4, 'partial': 1, 'failed': 0, 'cancelled': 0},);
      expect(counts!.forStatus(null), 9);
      expect(counts.forStatus(CampaignStatus.sent), 4);
      expect(CampaignCounts.tryParse('x'), isNull);
      final r = CampaignRecipient.fromJson(recipientJson('1', 'Rohan T.'));
      expect(r.channel, CommChannel.sms);
      expect(r.error, 'Phone number is not valid');
      expect(recipientStatusLabel('SKIPPED_QUOTA'), 'Over limit');
    });

    test('request body is strict: PICKED has no filter, FILTERS no ids', () {
      final filters = CampaignRequest(
        title: ' Hi ',
        body: 'Body',
        channels: const [CommChannel.push, CommChannel.email],
        mode: AudienceMode.filters,
        filter: const AudienceFilter().toggleBirthday(),
        pickedMemberIds: const ['ignored'],
        confirmLargeSend: true,
      ).toJson();
      expect(filters['title'], 'Hi');
      expect(filters['channels'], ['PUSH', 'EMAIL']);
      expect(filters['audienceFilter'], {'birthdayThisWeek': true});
      expect(filters.containsKey('pickedMemberIds'), isFalse);
      expect(filters['sendMode'], 'NOW');
      expect(filters.containsKey('scheduledAt'), isFalse);
      expect(filters['confirmLargeSend'], true);

      final at = DateTime.utc(2026, 10, 25, 4, 30);
      final picked = CampaignRequest(
        title: 't',
        body: 'b',
        channels: const [CommChannel.push],
        mode: AudienceMode.picked,
        pickedMemberIds: const ['m1'],
        sendMode: CommSendMode.schedule,
        scheduledAt: at,
      ).toJson();
      expect(picked['pickedMemberIds'], ['m1']);
      expect(picked.containsKey('audienceFilter'), isFalse);
      expect(picked['scheduledAt'], '2026-10-25T04:30:00.000Z');
      expect(picked['sendMode'], 'SCHEDULE');
    });
  });

  group('automations', () {
    final list = AutomationList.fromJson(automationsJson());

    test('rules parse', () {
      expect(list.items.length, 4);
      expect(list.enabledCount, 3);
      final r = list.items.first;
      expect(r.key, 'MEMBERSHIP_EXPIRING');
      expect(r.channels, [CommChannel.push, CommChannel.email]);
      expect(r.timing.editable, isTrue);
      expect(r.timing.maxCount, 5);
      expect(r.isTransactional, isTrue);
      expect(list.items[2].unavailable.single.channel, CommChannel.sms);
    });

    test('timing wording per unit', () {
      expect(list.items[0].timingSummary, '7, 3, 1 days before');
      expect(list.items[1].timingSummary, '1 day after');
      expect(list.items[2].timingSummary, 'On the day');
      expect(list.items[3].timingSummary, 'After 14 days away');
      final t = list.items[0].timing;
      expect(t.chipLabel(7), '7 days before');
      expect(t.chipLabel(3, short: true), '3 days');
      expect(t.chipLabel(1, short: true), '1 day');
      expect(t.sortedOffsets([1, 7, 3]), [7, 3, 1]);
      expect(list.items[1].timing.sortedOffsets([14, 1, 7]), [1, 7, 14]);
    });

    test('test-send results', () {
      final r = TestSendResult.fromJson(
          {'channel': 'EMAIL', 'status': 'QUEUED', 'message': 'Queued to a***@x.com'},);
      expect(r.ok, isTrue);
      expect(r.channel, CommChannel.email);
      expect(
          TestSendResult.fromJson({'channel': 'SMS', 'status': 'SKIPPED', 'message': 'x'}).ok,
          isFalse,);
    });
  });

  group('member preferences', () {
    test('parse and update one channel', () {
      final p = MemberNotificationPreferences.fromJson({
        'channels': [
          {'channel': 'PUSH', 'label': 'Push notifications', 'promotionalOptOut': false},
          {'channel': 'SMS', 'label': 'SMS', 'promotionalOptOut': true},
          {'channel': 'FAX', 'label': 'Fax', 'promotionalOptOut': true},
        ],
        'nonBlockable': [
          {'key': 'MEMBERSHIP_REMINDERS', 'label': 'Membership expiry reminders'},
        ],
        'note': 'Opting out stops promotions.',
      });
      expect(p.channels.length, 2);
      expect(p.channels.last.promotionalOptOut, isTrue);
      expect(p.nonBlockable.single.label, 'Membership expiry reminders');
      final next = p.withChannel(p.channels.last.withOptOut(false));
      expect(next.channels.last.promotionalOptOut, isFalse);
      expect(next.channels.first.promotionalOptOut, isFalse);
    });
  });

  group('CommFailure mapping', () {
    test('network failure has no status', () {
      final f = CommFailure.from(ApiException.network());
      expect(f.kind, CommFailureKind.network);
      expect(f.message, contains("Can't reach the server"));
    });

    test('403 names the missing permission', () {
      final f = CommFailure.from(apiError(403, 'FORBIDDEN', 'nope'));
      expect(f.kind, CommFailureKind.forbidden);
      expect(f.message, contains('notifications:send'));
      final m = CommFailure.from(apiError(403, 'FORBIDDEN', 'nope'),
          permission: 'notifications:manage',);
      expect(m.message, contains('notifications:manage'));
    });

    test('429: hourly cap keeps the server sentence, others are generic', () {
      final hourly = CommFailure.from(apiError(429, 'RATE_LIMITED',
          'You can send up to 10 campaigns per hour. Try again a little later.',),);
      expect(hourly.kind, CommFailureKind.rateLimited);
      expect(hourly.message, contains('10 campaigns per hour'));
      final generic = CommFailure.from(apiError(429, 'RATE_LIMITED', 'Too many requests.'));
      expect(generic.message, contains('too quickly'));
    });

    test('409 CONFIRMATION_REQUIRED carries the count', () {
      final f = CommFailure.from(apiError(409, 'CONFIRMATION_REQUIRED', 'x',
          data: {'recipientCount': 1200, 'threshold': 100},),);
      expect(f.kind, CommFailureKind.confirmationRequired);
      expect(f.recipientCount, 1200);
      expect(f.threshold, 100);
      expect(f.message, contains('1,200'));
    });

    test('409 QUOTA_EXCEEDED names each short channel', () {
      final f = CommFailure.from(apiError(409, 'QUOTA_EXCEEDED', 'x', data: {
        'shortChannels': [
          {'channel': 'SMS', 'remaining': 240, 'wouldUse': 412, 'shortBy': 172},
        ],
      },),);
      expect(f.kind, CommFailureKind.quotaExceeded);
      expect(f.shortChannels.single.shortBy, 172);
      expect(f.message, contains('SMS: only 240 left this month, you need 412.'));
    });

    test('409 CHANNEL_DISABLED explains the reason', () {
      final f = CommFailure.from(apiError(409, 'CHANNEL_DISABLED', 'x', data: {
        'channels': [
          {'channel': 'EMAIL', 'reason': 'disabled_tenant'},
        ],
      },),);
      expect(f.kind, CommFailureKind.channelDisabled);
      expect(f.message, contains('Email is switched off in your gym settings.'));
    });

    test('422 maps errors[] to root fields; 422 codes get their own kinds', () {
      final v = CommFailure.from(apiError(422, 'VALIDATION_ERROR', 'Request Validation Failed', errors: [
        {'field': 'title', 'code': 'VALIDATION_ERROR', 'message': 'Title is required.'},
        {'field': 'pickedMemberIds.2', 'code': 'VALIDATION_ERROR', 'message': 'Bad id'},
      ],),);
      expect(v.kind, CommFailureKind.validation);
      expect(v.fieldMessages, {'title': 'Title is required.', 'pickedMemberIds': 'Bad id'});
      expect(v.message, 'Title is required.');
      expect(CommFailure.from(apiError(422, 'AUDIENCE_EMPTY', 'x')).kind, CommFailureKind.audienceEmpty);
      expect(CommFailure.from(apiError(422, 'RECIPIENT_LIMIT_EXCEEDED', 'x')).kind, CommFailureKind.recipientLimit);
    });

    test('409 INVALID_STATE keeps the server wording, 5xx is generic', () {
      final s = CommFailure.from(apiError(409, 'INVALID_STATE', 'Only draft or scheduled campaigns can be edited.'));
      expect(s.kind, CommFailureKind.invalidState);
      expect(s.message, startsWith('Only draft or scheduled'));
      final e = CommFailure.from(apiError(500, 'INTERNAL', 'boom'));
      expect(e.message, isNot(contains('boom')));
    });

    test('ApiException now carries code and data', () {
      final e = apiError(409, 'QUOTA_EXCEEDED', 'm', data: {'a': 1});
      expect(e.code, 'QUOTA_EXCEEDED');
      expect(e.data, {'a': 1});
      expect(ApiException.fromResponseData('html', 502).code, isNull);
    });
  });
}
