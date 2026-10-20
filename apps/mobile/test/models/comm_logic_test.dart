import 'package:flutter_test/flutter_test.dart';
import 'package:gym_saas_mobile/bloc/communications/send_flow_state.dart';
import 'package:gym_saas_mobile/features/communications/comm_logic.dart';
import 'package:gym_saas_mobile/models/comm_audience.dart';
import 'package:gym_saas_mobile/models/comm_campaign.dart';
import 'package:gym_saas_mobile/models/comm_channel.dart';

import '../fixtures/comm_fixtures.dart';

void main() {
  group('placeholders', () {
    test('known placeholders pass, whitespace tolerated', () {
      expect(placeholderIssues('Hi {{firstName}}, {{ planName }} ends {{endDate}}'), isEmpty);
      expect(unknownPlaceholders('{{firstName}}'), isEmpty);
    });

    test('unknown names are named', () {
      final issues = placeholderIssues('Hi {{nickname}} and {{foo}}');
      expect(issues.length, 2);
      expect(issues.first, contains('{{nickname}}'));
      expect(issues.first, contains('{{firstName}}'));
      expect(unknownPlaceholders('{{foo}} {{foo}} {{bar}}'), ['foo', 'bar']);
    });

    test('half-written braces are flagged', () {
      expect(placeholderIssues('Hello {{firstName'), isNotEmpty);
      expect(placeholderIssues('Hello firstName}}'), isNotEmpty);
      expect(placeholderIssues('{{}}'), isNotEmpty);
    });

    test('rendering fills known tokens only', () {
      expect(
        renderPlaceholders('Hi {{firstName}} {{zzz}}', {'firstName': 'Aarav'}),
        'Hi Aarav {{zzz}}',
      );
    });
  });

  group('text rules', () {
    test('title', () {
      expect(validateTitle('   '), 'Add a title.');
      expect(validateTitle('Hello'), isNull);
      expect(validateTitle('a' * 200), isNull);
      expect(validateTitle('a' * 201), contains('200'));
      expect(validateTitle('Hi {{who}}'), contains('Unknown placeholder'));
    });

    test('body', () {
      expect(validateBody(''), 'Write the message.');
      expect(validateBody('a' * 2000), isNull);
      expect(validateBody('a' * 2001), contains('2000'));
      expect(validateBody('x {{nope}}'), contains('{{nope}}'));
    });

    test('SMS: title + newline + body, sample-filled, max 1000', () {
      expect(validateSmsLength('Hi', 'short'), isNull);
      expect(validateSmsLength('t', 'a' * 1000), contains('1000'));
      expect(validateSmsLength('t', 'a' * 990), isNull);
    });
  });

  group('schedule', () {
    final now = DateTime(2026, 10, 20, 12);

    test('needs a value', () => expect(validateSchedule(null, now), isNotNull));
    test('at least a minute ahead', () {
      expect(validateSchedule(now.add(const Duration(seconds: 30)), now), isNotNull);
      expect(validateSchedule(now.subtract(const Duration(hours: 1)), now), isNotNull);
      expect(validateSchedule(now.add(const Duration(minutes: 2)), now), isNull);
    });
    test('at most 90 days ahead', () {
      expect(validateSchedule(now.add(const Duration(days: 90)), now), isNull);
      expect(validateSchedule(now.add(const Duration(days: 91)), now), contains('90'));
    });
  });

  group('channel helpers', () {
    final p = preview();

    test('block reasons: over limit and switched off', () {
      expect(channelBlockReason(p, CommChannel.sms),
          'Only 240 SMS left this month, you need 380.',);
      expect(channelBlockReason(p, CommChannel.whatsapp),
          'WhatsApp is not included in your plan.',);
      expect(channelBlockReason(p, CommChannel.email), isNull);
      expect(channelBlockReason(p, CommChannel.push), isNull);
    });

    test('uses line and audience description', () {
      expect(usesLine(p, [CommChannel.push, CommChannel.inApp]), '390 push · 412 in-app');
      expect(
        describeAudience(mode: AudienceMode.filters, filter: AudienceFilter.empty, pickedCount: 0),
        'All active members',
      );
      expect(
        describeAudience(
          mode: AudienceMode.filters,
          filter: const AudienceFilter().withStatus('EXPIRING').togglePlan('p1').toggleOverdue(),
          pickedCount: 0,
          names: {'p1': 'Monthly'},
        ),
        'Expiring in 7 days · Monthly · Overdue invoice',
      );
      expect(
        describeAudience(mode: AudienceMode.picked, filter: AudienceFilter.empty, pickedCount: 1),
        '1 picked member',
      );
    });
  });

  group('campaign wording', () {
    final now = DateTime(2026, 10, 20, 12);

    test('pill text and tone', () {
      final partial = CommCampaign.fromJson(campaignJson(status: 'PARTIAL'));
      expect(campaignPillText(partial), '2 failed');
      expect(campaignTone(partial), CommTone.warn);
      expect(campaignPillText(CommCampaign.fromJson(campaignJson(status: 'SENT'))), 'Sent');
      expect(campaignTone(CommCampaign.fromJson(campaignJson(status: 'SENDING'))), CommTone.run);
      expect(campaignTone(CommCampaign.fromJson(campaignJson(status: 'FAILED'))), CommTone.bad);
    });

    test('subtitle uses relative days', () {
      final c = CommCampaign.fromJson(campaignJson(recipients: 412));
      expect(campaignSubtitle(c, now: DateTime.utc(2026, 10, 15, 12)), '412 members · today');
      expect(campaignSubtitle(c, now: now), '412 members · 15 Oct');
      expect(commDay(DateTime(2026, 10, 19, 9), now: now), 'yesterday');
      expect(commDay(DateTime(2025, 3, 2), now: now), '2 Mar 2025');
      expect(commDateTime(DateTime(2026, 10, 15, 8), now: now), '15 Oct, 8:00 am');
    });

    test('poll cadence slows down', () {
      expect(campaignPollInterval(const Duration(seconds: 10)), const Duration(seconds: 3));
      expect(campaignPollInterval(const Duration(minutes: 3)), const Duration(seconds: 15));
    });
  });

  group('validateSendStep', () {
    final now = DateTime(2026, 10, 20, 12);
    SendFlowState base() => SendFlowState(preview: preview());

    test('audience: picked mode needs a member; empty and over-max previews', () {
      expect(
        validateSendStep(const SendFlowState(mode: AudienceMode.picked), kStepAudience, now)['audience'],
        'Pick at least one member.',
      );
      expect(validateSendStep(base(), kStepAudience, now), isEmpty);
      expect(
        validateSendStep(SendFlowState(preview: preview(total: 0)), kStepAudience, now)['audience'],
        contains('No members match'),
      );
      expect(
        validateSendStep(
          SendFlowState(preview: AudiencePreview.fromJson(previewJson(exceedsMax: true))),
          kStepAudience,
          now,
        )['audience'],
        contains('5,000'),
      );
    });

    test('message: title and body, server field errors surface too', () {
      var s = base();
      expect(validateSendStep(s, kStepMessage, now).keys, containsAll(['title', 'body']));
      s = s.copyWith(title: 'Hi', body: 'Body');
      expect(validateSendStep(s, kStepMessage, now), isEmpty);
      s = s.copyWith(fieldErrors: {'title': 'Server says no'});
      expect(validateSendStep(s, kStepMessage, now)['title'], 'Server says no');
      s = s.copyWith(title: 'Hi {{x}}', fieldErrors: const {});
      expect(validateSendStep(s, kStepMessage, now)['title'], contains('{{x}}'));
    });

    test('channels: at least one, blocked ones, SMS length, nobody reachable', () {
      var s = base().copyWith(title: 't', body: 'b', channels: <CommChannel>{});
      expect(validateSendStep(s, kStepChannels, now)['channels'], 'Choose at least one channel.');
      s = s.copyWith(channels: {CommChannel.push, CommChannel.email});
      expect(validateSendStep(s, kStepChannels, now), isEmpty);
      s = s.copyWith(channels: {CommChannel.sms});
      expect(validateSendStep(s, kStepChannels, now)['channels'], contains('Only 240 SMS left'));
      s = s.copyWith(channels: {CommChannel.whatsapp});
      expect(validateSendStep(s, kStepChannels, now)['channels'], contains('not included'));
      s = base().copyWith(channels: {CommChannel.push}, serverBlocked: {CommChannel.push: 'Push is off.'});
      expect(validateSendStep(s, kStepChannels, now)['channels'], 'Push is off.');
      final nobody = AudiencePreview.fromJson(previewJson(channels: [
        channelAudienceJson('PUSH', contactable: 0, willReceive: 0),
      ],),);
      s = SendFlowState(preview: nobody, channels: {CommChannel.push});
      expect(validateSendStep(s, kStepChannels, now)['reach'], contains('Nobody'));
    });

    test('review: schedule window and the large-send confirm box', () {
      var s = base();
      expect(validateSendStep(s, kStepReview, now)['confirm'], contains('Tick the box'));
      s = s.copyWith(confirmed: true);
      expect(validateSendStep(s, kStepReview, now), isEmpty);
      s = s.copyWith(scheduledAt: now.subtract(const Duration(minutes: 5)));
      expect(validateSendStep(s, kStepReview, now)['schedule'], isNotNull);
      s = s.copyWith(scheduledAt: now.add(const Duration(days: 2)));
      expect(validateSendStep(s, kStepReview, now), isEmpty);
      // Small send: no confirm needed.
      final small = SendFlowState(preview: preview(total: 40, largeSend: false));
      expect(validateSendStep(small, kStepReview, now), isEmpty);
      // Server demanded confirmation although the preview said small.
      expect(
        validateSendStep(small.copyWith(forceConfirm: true), kStepReview, now)['confirm'],
        isNotNull,
      );
    });

    test('field names map to the step that fixes them', () {
      expect(stepForField('title'), kStepMessage);
      expect(stepForField('pickedMemberIds'), kStepAudience);
      expect(stepForField('channels'), kStepChannels);
      expect(stepForField('scheduledAt'), kStepReview);
      expect(stepForField('mystery'), -1);
    });
  });
}
