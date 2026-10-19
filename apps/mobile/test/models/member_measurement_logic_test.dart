import 'package:flutter_test/flutter_test.dart';
import 'package:gym_saas_mobile/features/member/presentation/member_measurement_logic.dart';
import 'package:gym_saas_mobile/models/body_measurement.dart';
import 'package:gym_saas_mobile/models/member_portal_profile.dart';

/// Entry on a plain calendar day (UTC midnight — how the app stores them).
BodyMeasurement _e(
  String day, {
  Object? weight,
  Object? waist,
  String source = 'MEMBER',
}) =>
    BodyMeasurement.fromJson({
      'id': 'e-$day-${weight ?? waist}',
      'memberId': 'm1',
      'recordedAt': '${day}T00:00:00.000Z',
      'weightKg': weight,
      'heightCm': null,
      'bodyFatPercent': null,
      'chestCm': null,
      'waistCm': waist,
      'hipsCm': null,
      'bicepsCm': null,
      'thighsCm': null,
      'notes': null,
      'recordedBy':
          source == 'STAFF' ? {'id': 'u1', 'name': 'Coach Ravi'} : null,
      'source': source,
      'createdAt': '${day}T10:00:00.000Z',
      'updatedAt': '${day}T10:00:00.000Z',
    });

final _now = DateTime(2026, 10, 19, 10);

void main() {
  group('BodyMeasurement source / id / decimal strings', () {
    test('parses MEMBER source, id and string decimals', () {
      final m = _e('2026-10-19', weight: '71.50');
      expect(m.source, MeasurementSource.member);
      expect(m.isMemberLogged, isTrue);
      expect(m.recordedBy, isNull);
      expect(m.id, isNotEmpty);
      expect(m.weightKg, 71.5);
    });

    test('STAFF source and a missing source (older API) read as staff', () {
      expect(
        _e('2026-10-19', weight: 70, source: 'STAFF').isMemberLogged,
        isFalse,
      );
      final json = {
        'id': 'x',
        'memberId': 'm',
        'recordedAt': '2026-10-19T00:00:00.000Z',
        'weightKg': '70',
        'recordedBy': null,
      };
      expect(BodyMeasurement.fromJson(json).source, MeasurementSource.staff);
      expect(
        BodyMeasurement.fromJson({...json, 'source': 'member'}).source,
        MeasurementSource.member,
      );
    });

    test('numeric (non-string) decimals are tolerated too', () {
      expect(_e('2026-10-19', weight: 71.5).weightKg, 71.5);
    });
  });

  group('MemberWeightStats', () {
    test('one weight per calendar day (mean) and a trailing 7-day average', () {
      final s = MemberWeightStats(
        [
          _e('2026-10-10', weight: 80),
          _e('2026-10-12', weight: 79),
          _e('2026-10-12', weight: 77, source: 'STAFF'),
          _e('2026-10-19', weight: 76),
        ],
        now: _now,
      );
      expect(s.days.map((d) => d.kg), [80, 78, 76]);
      // 10-10: [80]; 10-12: [80,78]; 10-19: only 10-13..10-19 -> [76].
      expect(s.movingAverage, [80, 79, 76]);
      expect(s.currentKg, 76);
      expect(s.startKg, 80);
    });

    test('moving average smooths a noisy week', () {
      final s = MemberWeightStats(
        [
          _e('2026-10-13', weight: 70),
          _e('2026-10-14', weight: 72),
          _e('2026-10-15', weight: 71),
        ],
        now: _now,
      );
      expect(s.movingAverage[2], closeTo(71, 0.0001));
    });

    test('this week vs last week (rolling 7-day windows)', () {
      final s = MemberWeightStats(
        [
          // last week: 10-06..10-12
          _e('2026-10-07', weight: 80),
          _e('2026-10-10', weight: 79),
          // this week: 10-13..10-19
          _e('2026-10-14', weight: 78),
          _e('2026-10-19', weight: 77),
        ],
        now: _now,
      );
      expect(s.thisWeekAvg, 77.5);
      expect(s.lastWeekAvg, 79.5);
      expect(s.weekDelta, -2);
    });

    test('no delta without data in both windows', () {
      final s = MemberWeightStats([_e('2026-10-19', weight: 70)], now: _now);
      expect(s.weekDelta, isNull);
      expect(s.thisWeekAvg, 70);
      expect(s.lastWeekAvg, isNull);
    });

    test('days logged this week counts any check-in, not just weight', () {
      final s = MemberWeightStats(
        [
          _e('2026-10-19', weight: 70),
          _e('2026-10-17', waist: 80),
          _e('2026-10-10', weight: 71), // outside the window
        ],
        now: _now,
      );
      expect(s.daysLoggedThisWeek, 2);
      expect(s.lastSevenDays, [false, false, false, false, true, false, true]);
      expect(s.loggedToday, isTrue);
    });

    test('streak: consecutive days, still alive while today is open', () {
      MemberWeightStats of(List<String> days) => MemberWeightStats(
            [for (final d in days) _e(d, weight: 70)],
            now: _now,
          );
      expect(of(['2026-10-19', '2026-10-18', '2026-10-17']).streak, 3);
      // Today not logged yet: the run up to yesterday still counts.
      expect(of(['2026-10-18', '2026-10-17']).streak, 2);
      // A gap breaks it.
      expect(of(['2026-10-19', '2026-10-17']).streak, 1);
      expect(of(['2026-10-15']).streak, 0);
      expect(of(const []).streak, 0);
    });

    test('no goal without a target; losing-weight goal progress', () {
      final entries = [
        _e('2026-09-01', weight: 80),
        _e('2026-10-19', weight: 76),
      ];
      expect(MemberWeightStats(entries, now: _now).goal, isNull);
      final g = MemberWeightStats(entries, now: _now, targetKg: 70).goal!;
      expect(g.isLoss, isTrue);
      expect(g.ratio, closeTo(0.4, 0.0001));
      expect(g.remaining, 6);
      expect(g.reached, isFalse);
    });

    test('gain goal, reached goal and wrong-direction progress', () {
      final gain = MemberWeightStats(
        [_e('2026-09-01', weight: 60), _e('2026-10-19', weight: 63)],
        now: _now,
        targetKg: 66,
      ).goal!;
      expect(gain.isLoss, isFalse);
      expect(gain.ratio, closeTo(0.5, 0.0001));
      expect(gain.remaining, 3);

      final done = MemberWeightStats(
        [_e('2026-09-01', weight: 80), _e('2026-10-19', weight: 69.5)],
        now: _now,
        targetKg: 70,
      ).goal!;
      expect(done.reached, isTrue);
      expect(done.ratio, 1);
      expect(done.remaining, 0);

      final wrong = MemberWeightStats(
        [_e('2026-09-01', weight: 80), _e('2026-10-19', weight: 82)],
        now: _now,
        targetKg: 70,
      ).goal!;
      expect(wrong.ratio, 0);
    });
  });

  group('MemberPortalProfile.targetWeightKg', () {
    Map<String, dynamic> profile(Object? history) => {
          'id': 'm1',
          'memberId': 'MEM-0001',
          'name': 'Asha Rao',
          'status': 'ACTIVE',
          'branch': {'id': 'b1', 'name': 'Main'},
          'joiningDate': '2026-01-01T00:00:00.000Z',
          if (history != null) 'membershipHistory': history,
        };

    test('takes the newest membership that has a target (string decimal)', () {
      final p = MemberPortalProfile.fromJson(
        profile([
          {'id': 'a', 'targetWeight': null},
          {'id': 'b', 'targetWeight': '68.50'},
          {'id': 'c', 'targetWeight': '60.00'},
        ]),
      );
      expect(p.targetWeightKg, 68.5);
    });

    test('null when no history, no target, or a zero target', () {
      expect(
        MemberPortalProfile.fromJson(profile(null)).targetWeightKg,
        isNull,
      );
      expect(
        MemberPortalProfile.fromJson(
          profile([
            {'id': 'a', 'targetWeight': '0.00'},
          ]),
        ).targetWeightKg,
        isNull,
      );
    });
  });
}
