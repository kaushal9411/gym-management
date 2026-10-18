import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gym_saas_mobile/bloc/leads/lead_analytics_cubit.dart';
import 'package:gym_saas_mobile/bloc/leads/lead_detail_cubit.dart';
import 'package:gym_saas_mobile/bloc/leads/lead_follow_ups_cubit.dart';
import 'package:gym_saas_mobile/core/network/api_exception.dart';
import 'package:gym_saas_mobile/models/lead.dart';
import 'package:gym_saas_mobile/models/lead_analytics.dart';
import 'package:gym_saas_mobile/repositories/lead_repository.dart';
import 'package:mocktail/mocktail.dart';

class FakeLeadRepository extends Mock implements LeadRepository {}

Lead lead({
  String id = 'l1',
  LeadStatus status = LeadStatus.newLead,
  List<LeadActivity> acts = const [],
}) =>
    Lead(
      id: id,
      name: 'ZZ Lead',
      phone: '9000099001',
      source: LeadSource.walkIn,
      status: status,
      activities: acts,
    );

void main() {
  setUpAll(() {
    registerFallbackValue(LeadStatus.newLead);
    registerFallbackValue(LeadActivityType.note);
  });

  group('LeadDetailCubit', () {
    late FakeLeadRepository repo;
    setUp(() => repo = FakeLeadRepository());

    blocTest<LeadDetailCubit, LeadDetailState>(
      'load success',
      build: () {
        when(() => repo.getById('l1')).thenAnswer((_) async => lead());
        return LeadDetailCubit(repo, 'l1');
      },
      act: (c) => c.load(),
      expect: () => [isA<LeadDetailLoading>(), isA<LeadDetailLoaded>()],
    );

    blocTest<LeadDetailCubit, LeadDetailState>(
      'load failure -> error state',
      build: () {
        when(() => repo.getById('l1'))
            .thenThrow(const ApiException(message: 'boom', statusCode: 500));
        return LeadDetailCubit(repo, 'l1');
      },
      act: (c) => c.load(),
      expect: () => [
        isA<LeadDetailLoading>(),
        isA<LeadDetailError>().having((e) => e.message, 'message', 'boom'),
      ],
    );

    test('changeStatus shows the server response, busy in between', () async {
      when(() => repo.getById('l1')).thenAnswer((_) async => lead());
      when(
        () => repo.changeStatus(
          'l1',
          status: any(named: 'status'),
          lostReason: any(named: 'lostReason'),
          lostNote: any(named: 'lostNote'),
          note: any(named: 'note'),
        ),
      ).thenAnswer((_) async => lead(status: LeadStatus.contacted));
      final c = LeadDetailCubit(repo, 'l1');
      await c.load();
      final states = <LeadDetailState>[];
      final sub = c.stream.listen(states.add);
      final err = await c.changeStatus(LeadStatus.contacted);
      await Future<void>.delayed(Duration.zero);
      await sub.cancel();
      expect(err, isNull);
      expect((states.first as LeadDetailLoaded).busy, isTrue);
      expect(c.lead!.status, LeadStatus.contacted);
      expect((c.state as LeadDetailLoaded).busy, isFalse);
    });

    test('failed mutation returns message and keeps the old lead', () async {
      when(() => repo.getById('l1')).thenAnswer((_) async => lead());
      when(
        () => repo.addActivity(
          'l1',
          type: any(named: 'type'),
          note: any(named: 'note'),
          outcome: any(named: 'outcome'),
          nextFollowUpAt: any(named: 'nextFollowUpAt'),
        ),
      ).thenThrow(const ApiException(message: 'nope', statusCode: 422));
      final c = LeadDetailCubit(repo, 'l1');
      await c.load();
      final err = await c.addActivity(LeadActivityType.note, note: 'x');
      expect(err, 'nope');
      expect(c.lead!.activities, isEmpty);
      expect((c.state as LeadDetailLoaded).busy, isFalse);
    });

    test('convert returns the member and the converted lead', () async {
      when(() => repo.getById('l1')).thenAnswer((_) async => lead());
      when(() => repo.convert('l1', any())).thenAnswer(
        (_) async => LeadConvertResult(
          lead: lead(status: LeadStatus.converted),
          member: const ConvertedMember(
            id: 'm1',
            memberId: 'MEM-7',
            name: 'ZZ Lead',
          ),
        ),
      );
      final c = LeadDetailCubit(repo, 'l1');
      await c.load();
      final r = await c.convert({'branchId': 'b1'});
      expect(r.error, isNull);
      expect(r.member?.memberId, 'MEM-7');
      expect(c.lead!.status, LeadStatus.converted);
    });

    test('convert error is surfaced', () async {
      when(() => repo.getById('l1')).thenAnswer((_) async => lead());
      when(() => repo.convert('l1', any()))
          .thenThrow(const ApiException(message: 'Branch required'));
      final c = LeadDetailCubit(repo, 'l1');
      await c.load();
      final r = await c.convert({});
      expect(r.member, isNull);
      expect(r.error, 'Branch required');
      expect(c.lead!.status, LeadStatus.newLead);
    });

    test('refresh swaps in the new lead without a loading flash', () async {
      var calls = 0;
      when(() => repo.getById('l1')).thenAnswer(
        (_) async => lead(
          status: calls++ == 0 ? LeadStatus.newLead : LeadStatus.contacted,
        ),
      );
      final c = LeadDetailCubit(repo, 'l1');
      await c.load();
      final states = <LeadDetailState>[];
      final sub = c.stream.listen(states.add);
      await c.refresh();
      await Future<void>.delayed(Duration.zero);
      await sub.cancel();
      expect(states.whereType<LeadDetailLoading>(), isEmpty);
      expect(c.lead!.status, LeadStatus.contacted);
    });

    test('an unexpected exception during a mutation resets busy', () async {
      when(() => repo.getById('l1')).thenAnswer((_) async => lead());
      when(
        () => repo.assign('l1', any()),
      ).thenThrow(StateError('type error after a successful POST'));
      final c = LeadDetailCubit(repo, 'l1');
      await c.load();
      final err = await c.assign('u1');
      expect(err, isNotNull);
      expect((c.state as LeadDetailLoaded).busy, isFalse);
    });

    test('delete success / failure', () async {
      when(() => repo.getById('l1')).thenAnswer((_) async => lead());
      when(() => repo.delete('l1')).thenAnswer((_) async {});
      final c = LeadDetailCubit(repo, 'l1');
      await c.load();
      expect(await c.delete(), isNull);
      when(() => repo.delete('l1'))
          .thenThrow(const ApiException(message: 'forbidden', statusCode: 403));
      expect(await c.delete(), 'forbidden');
    });
  });

  group('LeadAnalyticsCubit', () {
    blocTest<LeadAnalyticsCubit, LeadAnalyticsState>(
      'loads for the requested range',
      build: () => LeadAnalyticsCubit((r, from, to) async {
        expect(r, '7d');
        expect(from, isNull);
        return LeadAnalytics.fromJson({});
      }),
      act: (c) => c.load(LeadRange.days7),
      expect: () => [
        isA<LeadAnalyticsLoading>(),
        isA<LeadAnalyticsLoaded>()
            .having((s) => s.range, 'range', LeadRange.days7),
      ],
    );

    blocTest<LeadAnalyticsCubit, LeadAnalyticsState>(
      'custom range forwards the date window and keeps it on reload',
      build: () {
        final seen = <String>[];
        return LeadAnalyticsCubit((r, from, to) async {
          seen.add('$r|$from|$to');
          if (seen.length == 2) {
            expect(seen.last, 'custom|2026-09-01|2026-09-30');
          }
          return LeadAnalytics.fromJson({});
        });
      },
      act: (c) async {
        await c.load(LeadRange.custom, false, '2026-09-01', '2026-09-30');
        await c.load(null, true);
      },
      expect: () => [
        isA<LeadAnalyticsLoading>(),
        isA<LeadAnalyticsLoaded>()
            .having((s) => s.from, 'from', '2026-09-01')
            .having((s) => s.to, 'to', '2026-09-30'),
        isA<LeadAnalyticsLoaded>()
            .having((s) => s.range, 'range', LeadRange.custom),
      ],
    );

    blocTest<LeadAnalyticsCubit, LeadAnalyticsState>(
      'a non-ApiException failure becomes an error state, not a crash',
      build: () => LeadAnalyticsCubit((r, from, to) async {
        throw StateError('boom');
      }),
      act: (c) => c.load(),
      expect: () => [isA<LeadAnalyticsLoading>(), isA<LeadAnalyticsError>()],
    );

    blocTest<LeadAnalyticsCubit, LeadAnalyticsState>(
      'error then retry succeeds',
      build: () {
        var n = 0;
        return LeadAnalyticsCubit((r, from, to) async {
          if (n++ == 0) throw const ApiException(message: 'down');
          return LeadAnalytics.fromJson({});
        });
      },
      act: (c) async {
        await c.load();
        await c.load();
      },
      expect: () => [
        isA<LeadAnalyticsLoading>(),
        isA<LeadAnalyticsError>(),
        isA<LeadAnalyticsLoading>(),
        isA<LeadAnalyticsLoaded>(),
      ],
    );
  });

  group('LeadFollowUpsCubit', () {
    blocTest<LeadFollowUpsCubit, LeadFollowUpsState>(
      'passes scope + bucket',
      build: () => LeadFollowUpsCubit((scope, bucket) async {
        expect(scope, 'all');
        expect(bucket, 'overdue');
        return LeadFollowUps(items: [lead()], overdue: 1, due: 1);
      }),
      act: (c) => c.load(bucket: 'overdue', mineOnly: false),
      expect: () => [
        isA<LeadFollowUpsLoading>(),
        isA<LeadFollowUpsLoaded>()
            .having((s) => s.data.items.length, 'items', 1),
      ],
    );
  });
}
