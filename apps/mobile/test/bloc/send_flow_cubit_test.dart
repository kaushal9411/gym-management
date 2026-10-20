import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:gym_saas_mobile/bloc/communications/send_flow_cubit.dart';
import 'package:gym_saas_mobile/bloc/communications/send_flow_state.dart';
import 'package:gym_saas_mobile/core/network/api_exception.dart';
import 'package:gym_saas_mobile/core/network/comm_failure.dart';
import 'package:gym_saas_mobile/models/comm_audience.dart';
import 'package:gym_saas_mobile/models/comm_campaign.dart';
import 'package:gym_saas_mobile/models/comm_channel.dart';
import 'package:gym_saas_mobile/models/comm_request.dart';
import 'package:gym_saas_mobile/repositories/communications_repository.dart';
import 'package:mocktail/mocktail.dart';

import '../fixtures/comm_fixtures.dart';

class _Repo extends Mock implements CommunicationsRepository {}

class _FakeRequest extends Fake implements CampaignRequest {}

ApiException _err(int status, String code, String msg,
        {Map<String, dynamic>? data, List<Map<String, dynamic>>? errors,}) =>
    CommFailure.from(
      ApiException.fromResponseData(
        {
          'message': msg,
          'errors': errors ??
              [
                {'code': code, 'message': msg},
              ],
          'data': data,
        },
        status,
      ),
    );

Future<void> _flush() async {
  for (var i = 0; i < 5; i++) {
    await Future<void>.delayed(Duration.zero);
  }
}

void main() {
  setUpAll(() {
    registerFallbackValue(_FakeRequest());
    registerFallbackValue(AudienceMode.filters);
    registerFallbackValue(AudienceFilter.empty);
  });

  late _Repo repo;
  late int keyCounter;
  final now = DateTime(2026, 10, 20, 12);

  setUp(() {
    repo = _Repo();
    keyCounter = 0;
    when(
      () => repo.previewAudience(
        mode: any(named: 'mode'),
        filter: any(named: 'filter'),
        pickedMemberIds: any(named: 'pickedMemberIds'),
        channels: any(named: 'channels'),
        title: any(named: 'title'),
        body: any(named: 'body'),
      ),
    ).thenAnswer((_) async => preview());
  });

  SendFlowCubit make({PickerMember? seed}) => SendFlowCubit(
        repo,
        seed: seed,
        debounce: Duration.zero,
        clock: () => now,
        keyFactory: () => 'key-${++keyCounter}',
      );

  /// A cubit with a valid message on the channels step's way to review.
  Future<SendFlowCubit> ready({Set<CommChannel>? channels}) async {
    final c = make();
    await _flush();
    c.setTexts(title: 'Hi {{firstName}}', body: 'Body');
    c.toggleChannel(CommChannel.inApp); // push only
    if (channels != null) {
      for (final ch in channels) {
        if (!c.state.channels.contains(ch)) c.toggleChannel(ch);
      }
    }
    c.goToStep(kStepReview);
    return c;
  }

  void stubCreate(Future<CommCampaign> Function() answer) {
    when(
      () => repo.createCampaign(
        any(),
        idempotencyKey: any(named: 'idempotencyKey'),
      ),
    ).thenAnswer((_) => answer());
  }

  test('starts by counting the default audience', () async {
    final c = make();
    expect(c.state.previewLoading, isTrue);
    await _flush();
    expect(c.state.preview!.total, 412);
    expect(c.state.previewLoading, isFalse);
    expect(c.state.channels, {CommChannel.push, CommChannel.inApp});
    await c.close();
  });

  test('a seeded member opens in pick mode with that member picked', () async {
    final c = make(seed: PickerMember.fromJson(pickerJson('1', 'Aarav K')));
    await _flush();
    expect(c.state.mode, AudienceMode.picked);
    expect(c.state.picked.keys, ['1']);
    final call = verify(
      () => repo.previewAudience(
        mode: AudienceMode.picked,
        filter: any(named: 'filter'),
        pickedMemberIds: ['1'],
        channels: any(named: 'channels'),
        title: any(named: 'title'),
        body: any(named: 'body'),
      ),
    );
    call.called(greaterThanOrEqualTo(1));
    await c.close();
  });

  group('live count', () {
    test('filter changes re-count; stale answers are dropped', () async {
      final slow = Completer<AudiencePreview>();
      var n = 0;
      when(
        () => repo.previewAudience(
          mode: any(named: 'mode'),
          filter: any(named: 'filter'),
          pickedMemberIds: any(named: 'pickedMemberIds'),
          channels: any(named: 'channels'),
          title: any(named: 'title'),
          body: any(named: 'body'),
        ),
      ).thenAnswer((_) {
        n++;
        if (n == 1) return Future.value(preview(total: 1)); // initial
        if (n == 2) return slow.future; // slow, will be superseded
        return Future.value(preview(total: 7));
      });
      final c = make();
      await _flush();
      c.setFilter(const AudienceFilter().toggleOverdue());
      await _flush();
      c.setFilter(const AudienceFilter().toggleBirthday());
      await _flush();
      expect(c.state.preview!.total, 7);
      slow.complete(preview(total: 999));
      await _flush();
      expect(c.state.preview!.total, 7, reason: 'late answer must not win');
      await c.close();
    });

    test('an identical filter does not re-count', () async {
      final c = make();
      await _flush();
      clearInteractions(repo);
      c.setFilter(AudienceFilter.empty);
      await _flush();
      verifyNever(
        () => repo.previewAudience(
          mode: any(named: 'mode'),
          filter: any(named: 'filter'),
          pickedMemberIds: any(named: 'pickedMemberIds'),
          channels: any(named: 'channels'),
          title: any(named: 'title'),
          body: any(named: 'body'),
        ),
      );
      await c.close();
    });

    test('a failed count shows the error and clears the stale preview',
        () async {
      var first = true;
      when(
        () => repo.previewAudience(
          mode: any(named: 'mode'),
          filter: any(named: 'filter'),
          pickedMemberIds: any(named: 'pickedMemberIds'),
          channels: any(named: 'channels'),
          title: any(named: 'title'),
          body: any(named: 'body'),
        ),
      ).thenAnswer((_) async {
        if (first) {
          first = false;
          return preview();
        }
        throw ApiException.network();
      });
      final c = make();
      await _flush();
      c.setFilter(const AudienceFilter().toggleOverdue());
      await _flush();
      expect(c.state.preview, isNull);
      expect(c.state.previewError, contains("Can't reach the server"));
      expect(c.state.previewLoading, isFalse);
      await c.close();
    });

    test('hand-pick mode: nothing picked means no request, picks do', () async {
      final c = make();
      await _flush();
      clearInteractions(repo);
      c.setMode(AudienceMode.picked);
      await _flush();
      expect(c.state.audienceCount, 0);
      expect(c.state.previewLoading, isFalse);
      verifyNever(
        () => repo.previewAudience(
          mode: AudienceMode.picked,
          filter: any(named: 'filter'),
          pickedMemberIds: any(named: 'pickedMemberIds'),
          channels: any(named: 'channels'),
          title: any(named: 'title'),
          body: any(named: 'body'),
        ),
      );
      c.pickMany([
        PickerMember.fromJson(pickerJson('1', 'A')),
        PickerMember.fromJson(pickerJson('2', 'B')),
      ]);
      await _flush();
      expect(c.state.picked.length, 2);
      expect(c.state.preview, isNotNull);
      c.removePicked('1');
      expect(c.state.pickedIds, ['2']);
      c.clearPicked();
      expect(c.state.picked, isEmpty);
      await c.close();
    });
  });

  group('step validation', () {
    test('Next is refused with inline errors until the step is valid', () async {
      final c = make();
      await _flush();
      expect(c.next(), isTrue);
      expect(c.state.step, kStepMessage);
      expect(c.next(), isFalse);
      expect(c.state.attempted, contains(kStepMessage));
      expect(c.errorsFor(kStepMessage).keys, containsAll(['title', 'body']));
      c.setTexts(title: 'Hi {{nope}}', body: 'Body');
      expect(c.next(), isFalse);
      expect(c.errorsFor(kStepMessage)['title'], contains('{{nope}}'));
      c.setTexts(title: 'Hi {{firstName}}');
      expect(c.next(), isTrue);
      expect(c.state.step, kStepChannels);
      await c.close();
    });

    test('channels step: over-limit SMS blocks, turning it off unblocks',
        () async {
      final c = make();
      await _flush();
      c.setTexts(title: 't', body: 'b');
      c.goToStep(kStepChannels);
      c.toggleChannel(CommChannel.sms);
      expect(c.next(), isFalse);
      expect(c.errorsFor(kStepChannels)['channels'], contains('Only 240 SMS left'));
      c.toggleChannel(CommChannel.sms);
      expect(c.next(), isTrue);
      expect(c.state.step, kStepReview);
      await c.close();
    });

    test('no channel at all is refused', () async {
      final c = make();
      await _flush();
      c.goToStep(kStepChannels);
      c.toggleChannel(CommChannel.push);
      c.toggleChannel(CommChannel.inApp);
      expect(c.next(), isFalse);
      expect(c.errorsFor(kStepChannels)['channels'], 'Choose at least one channel.');
      await c.close();
    });

    test('audience step cannot advance while counting or when empty', () async {
      final c = make();
      expect(c.canAdvance(kStepAudience), isFalse); // still counting
      await _flush();
      expect(c.canAdvance(kStepAudience), isTrue);
      c.setMode(AudienceMode.picked);
      expect(c.next(), isFalse);
      expect(c.errorsFor(kStepAudience)['audience'], 'Pick at least one member.');
      await c.close();
    });

    test('Back goes one step and never below the first', () async {
      final c = make();
      await _flush();
      c.goToStep(kStepChannels);
      c.back();
      expect(c.state.step, kStepMessage);
      c.back();
      c.back();
      expect(c.state.step, kStepAudience);
      await c.close();
    });
  });

  group('submit', () {
    test('success sends one request with the flow data and an Idempotency-Key',
        () async {
      stubCreate(() async => CommCampaign.fromJson(campaignJson(status: 'SENDING')));
      final c = await ready();
      c.setConfirmed(true);
      await c.submit();
      final req = verify(
        () => repo.createCampaign(
          captureAny(),
          idempotencyKey: captureAny(named: 'idempotencyKey'),
        ),
      ).captured;
      final body = (req[0] as CampaignRequest).toJson();
      expect(body['title'], 'Hi {{firstName}}');
      expect(body['channels'], ['PUSH']);
      expect(body['confirmLargeSend'], true);
      expect(body['sendMode'], 'NOW');
      expect(req[1], 'key-1');
      expect(c.state.sent!.status, CampaignStatus.sending);
      expect(c.state.submitting, isFalse);
      await c.close();
    });

    test('double tap sends once', () async {
      final gate = Completer<CommCampaign>();
      stubCreate(() => gate.future);
      final c = await ready();
      c.setConfirmed(true);
      final a = c.submit();
      final b = c.submit();
      expect(c.state.submitting, isTrue);
      gate.complete(campaign(status: 'SENDING'));
      await Future.wait([a, b]);
      verify(() => repo.createCampaign(any(), idempotencyKey: any(named: 'idempotencyKey'))).called(1);
      expect(c.state.submitting, isFalse);
      await c.close();
    });

    test('large send without the confirm box does not call the API', () async {
      stubCreate(() async => campaign());
      final c = await ready();
      await c.submit();
      verifyNever(() => repo.createCampaign(any(), idempotencyKey: any(named: 'idempotencyKey')));
      expect(c.state.step, kStepReview);
      expect(c.state.attempted, contains(kStepReview));
      expect(c.errorsFor(kStepReview)['confirm'], isNotNull);
      await c.close();
    });

    test('scheduling sends scheduledAt as UTC and validates the window', () async {
      stubCreate(() async => campaign(status: 'SCHEDULED'));
      final c = await ready();
      c.setConfirmed(true);
      c.setSchedule(now.subtract(const Duration(hours: 1)));
      await c.submit();
      verifyNever(() => repo.createCampaign(any(), idempotencyKey: any(named: 'idempotencyKey')));
      expect(c.errorsFor(kStepReview)['schedule'], isNotNull);
      final at = now.add(const Duration(days: 1));
      c.setSchedule(at);
      c.setConfirmed(true);
      await c.submit();
      final body = (verify(() => repo.createCampaign(captureAny(), idempotencyKey: any(named: 'idempotencyKey'))).captured.single as CampaignRequest).toJson();
      expect(body['sendMode'], 'SCHEDULE');
      expect(body['scheduledAt'], at.toUtc().toIso8601String());
      await c.close();
    });

    test('network failure keeps the key so a retry cannot double send', () async {
      var calls = 0;
      stubCreate(() async {
        calls++;
        if (calls == 1) throw ApiException.network();
        return campaign(status: 'SENDING');
      });
      final c = await ready();
      c.setConfirmed(true);
      await c.submit();
      expect(c.state.bannerKind, CommFailureKind.network);
      expect(c.state.submitting, isFalse);
      expect(c.state.sent, isNull);
      await c.submit();
      final keys = verify(() => repo.createCampaign(any(), idempotencyKey: captureAny(named: 'idempotencyKey'))).captured;
      expect(keys, ['key-1', 'key-1']);
      expect(c.state.sent, isNotNull);
      await c.close();
    });

    test('editing after a failure gets a fresh key', () async {
      var calls = 0;
      stubCreate(() async {
        calls++;
        if (calls == 1) throw ApiException.network();
        return campaign();
      });
      final c = await ready();
      c.setConfirmed(true);
      await c.submit();
      c.setTexts(body: 'Different');
      c.setConfirmed(true);
      await c.submit();
      final keys = verify(() => repo.createCampaign(any(), idempotencyKey: captureAny(named: 'idempotencyKey'))).captured;
      expect(keys, ['key-1', 'key-2']);
      await c.close();
    });

    test('CONFIRMATION_REQUIRED shows the confirm step again', () async {
      stubCreate(() async => throw _err(409, 'CONFIRMATION_REQUIRED', 'x', data: {'recipientCount': 450, 'threshold': 100}));
      final c = await ready();
      c.setConfirmed(true);
      await c.submit();
      expect(c.state.bannerKind, CommFailureKind.confirmationRequired);
      expect(c.state.banner, contains('450'));
      expect(c.state.forceConfirm, isTrue);
      expect(c.state.confirmed, isFalse);
      expect(c.state.step, kStepReview);
      expect(c.state.submitting, isFalse);
      await c.close();
    });

    test('QUOTA_EXCEEDED jumps to Channels and names the shortfall', () async {
      stubCreate(() async => throw _err(409, 'QUOTA_EXCEEDED', 'x', data: {
            'shortChannels': [
              {'channel': 'PUSH', 'remaining': 10, 'wouldUse': 390, 'shortBy': 380},
            ],
          },),);
      final c = await ready();
      c.setConfirmed(true);
      await c.submit();
      expect(c.state.step, kStepChannels);
      expect(c.state.banner, contains('only 10 left'));
      await _flush();
      await c.close();
    });

    test('CHANNEL_DISABLED jumps to Channels', () async {
      stubCreate(() async => throw _err(409, 'CHANNEL_DISABLED', 'x', data: {
            'channels': [
              {'channel': 'PUSH', 'reason': 'disabled_platform'},
            ],
          },),);
      final c = await ready();
      c.setConfirmed(true);
      await c.submit();
      expect(c.state.step, kStepChannels);
      expect(c.state.banner, contains('not included in your plan'));
      await c.close();
    });

    test('422 field errors go back to the step that owns the field', () async {
      stubCreate(() async => throw _err(422, 'VALIDATION_ERROR', 'Request Validation Failed', errors: [
            {'field': 'body', 'code': 'VALIDATION_ERROR', 'message': 'Message can be at most 2000 characters.'},
          ],),);
      final c = await ready();
      c.setConfirmed(true);
      await c.submit();
      expect(c.state.step, kStepMessage);
      expect(c.state.fieldErrors['body'], contains('2000'));
      expect(c.errorsFor(kStepMessage)['body'], isNotNull);
      expect(c.state.attempted, contains(kStepMessage));
      await c.close();
    });

    test('AUDIENCE_EMPTY goes back to the audience; 429/403 stay with a banner', () async {
      stubCreate(() async => throw _err(422, 'AUDIENCE_EMPTY', 'x'));
      var c = await ready();
      c.setConfirmed(true);
      await c.submit();
      expect(c.state.step, kStepAudience);
      expect(c.state.banner, contains('Nobody matches'));
      await c.close();

      stubCreate(() async => throw _err(429, 'RATE_LIMITED', 'You can send up to 10 campaigns per hour. Try again a little later.'));
      c = await ready();
      c.setConfirmed(true);
      await c.submit();
      expect(c.state.step, kStepReview);
      expect(c.state.banner, contains('10 campaigns per hour'));
      await c.close();

      stubCreate(() async => throw _err(403, 'FORBIDDEN', 'x'));
      c = await ready();
      c.setConfirmed(true);
      await c.submit();
      expect(c.state.bannerKind, CommFailureKind.forbidden);
      expect(c.state.submitting, isFalse);
      await c.close();
    });

    test('an unexpected exception still resets the loading flag', () async {
      stubCreate(() async => throw StateError('boom'));
      final c = await ready();
      c.setConfirmed(true);
      await c.submit();
      expect(c.state.submitting, isFalse);
      expect(c.state.banner, contains('Something went wrong'));
      await c.close();
    });
  });

  test('isDirty guards a half-written message', () async {
    final c = make();
    await _flush();
    expect(c.state.isDirty, isFalse);
    c.setTexts(title: 'x');
    expect(c.state.isDirty, isTrue);
    await c.close();
  });
}
