import 'package:flutter_test/flutter_test.dart';
import 'package:gym_saas_mobile/features/member/presentation/member_workout_logic.dart';
import 'package:gym_saas_mobile/models/member_workout_assignment.dart';
import 'package:gym_saas_mobile/models/member_workout_tracking.dart';

import '../fixtures/workout_fixtures.dart';

void main() {
  group('MemberWorkoutAssignment / WorkoutTracking parsing', () {
    test('legacy payload without tracking still parses', () {
      final j = assignmentJson()..remove('tracking');
      final a = MemberWorkoutAssignment.fromJson(j);
      expect(a.tracking, isNull);
      expect(a.planName, 'Plan');
    });

    test('parses days, week, consistency and string decimals', () {
      final t = MemberWorkoutAssignment.fromJson(assignmentJson()).tracking!;
      expect(t.today, '2026-10-21');
      expect(t.days, hasLength(7));
      expect(t.todayDay!.state, DayState.today);
      expect(t.dayOf('2026-10-19')!.state, DayState.done);
      expect(t.dayOf('2026-10-19')!.session!.effort, 4);
      expect(t.dayOf('2026-10-20')!.isRest, isTrue);
      expect(t.week.completionPercent, 20);
      expect(t.nextDay!.isToday, isTrue);
      expect(t.consistency.first.percent, isNull);
      expect(t.consistency.last.isCurrent, isTrue);
      expect(t.last30.volumeKg, 1600.0); // string decimal
      expect(t.last30.avgEffort, 4.0);
      expect(t.personalBests.single.weightKg, 65.5);
      expect(t.insights.map((i) => i.tone), [
        InsightTone.warn,
        InsightTone.good,
        InsightTone.tip,
      ]);
    });

    test('exercise status, targets and logged labels', () {
      final t = MemberWorkoutAssignment.fromJson(assignmentJson()).tracking!;
      final mon = t.dayOf('2026-10-19')!;
      expect(mon.exercises[0].isDone, isTrue);
      expect(mon.exercises[1].isSkipped, isTrue);
      final c = t.dayOf('2026-10-21')!.exercises.first;
      expect(c.isPending, isTrue);
      expect(c.targetLabel, '4 x 8 · rest 90s');
      expect(c.loggedLabel, isNull);
      const e = TrackingExercise(
        exerciseId: 'x',
        name: 'X',
        status: LogStatus.completed,
        setsDone: 4,
        repsDone: 8,
        weightKg: 62.5,
        durationMin: 12,
      );
      expect(e.loggedLabel, '4 x 8 @ 62.5 kg 12 min');
      expect(describeLogged(setsDone: 3), '3 sets');
      expect(describeLogged(weightKg: 60), '@ 60 kg');
    });

    test('weekOf / lastSeven select the right days', () {
      final t = MemberWorkoutAssignment.fromJson(assignmentJson()).tracking!;
      expect(t.weekOf('2026-10-19'), hasLength(7));
      expect(t.weekOf('2026-10-12'), isEmpty);
      expect(t.lastSeven.map((d) => d.date), [
        '2026-10-19',
        '2026-10-20',
        '2026-10-21',
      ]);
    });

    test('write result parses workout / entry / completedNow', () {
      final r = WorkoutWriteResult.fromJson({
        'workout': assignmentJson(),
        'entry': {
          'id': 'l1',
          'date': '2026-10-21',
          'exerciseId': 'c',
          'exerciseName': 'Ex c',
          'status': 'COMPLETED',
          'weightKg': '60.00',
        },
        'completedNow': 2,
      }, created: true,);
      expect(r.created, isTrue);
      expect(r.completedNow, 2);
      expect(r.entry!.weightKg, 60.0);
      expect(r.workout!.tracking, isNotNull);
      expect(WorkoutWriteResult.fromJson({'workout': null}).workout, isNull);
    });

    test('history groups entries by day, newest first', () {
      final h = WorkoutHistory.fromJson({
        'today': '2026-10-21',
        'entries': [
          for (final (d, id) in [
            ('2026-10-19', 'a'),
            ('2026-10-21', 'c'),
            ('2026-10-19', 'b'),
          ])
            {
              'id': 'l$id',
              'date': d,
              'exerciseId': id,
              'exerciseName': 'Ex $id',
              'status': 'SKIPPED',
            },
        ],
        'sessions': [
          {'date': '2026-10-19', 'durationMin': 30, 'effort': 2, 'notes': null},
        ],
      });
      expect(h.byDay.map((e) => e.$1), ['2026-10-21', '2026-10-19']);
      expect(h.byDay.last.$2, hasLength(2));
      expect(h.sessions['2026-10-19']!.durationMin, 30);
    });
  });

  group('day helpers', () {
    test('dates', () {
      expect(shortDay('2026-10-19'), '19 Oct');
      expect(weekdayShort('2026-10-19'), 'Mon');
      expect(weekStartOf('2026-10-25'), '2026-10-19');
      expect(weekStartOf('2026-10-19'), '2026-10-19');
      expect(addDaysKey('2026-12-31', 1), '2027-01-01');
      expect(dayKey(parseDayKey('2026-03-05')), '2026-03-05');
    });
  });

  group('validateWorkoutDetails', () {
    DetailsValidation v({
      String sets = '',
      String reps = '',
      String weight = '',
      String duration = '',
      String notes = '',
    }) =>
        validateWorkoutDetails(
          sets: sets,
          reps: reps,
          weight: weight,
          duration: duration,
          notes: notes,
        );

    test('blank is valid and means not logged', () {
      final r = v();
      expect(r.isValid, isTrue);
      expect(r.details!.setsDone, isNull);
      expect(r.details!.notes, isNull);
    });

    test('parses values, comma decimals and trims the note', () {
      final d = v(
        sets: '4',
        reps: '10',
        weight: '42,5',
        duration: '12',
        notes: ' hi ',
      ).details!;
      expect([d.setsDone, d.repsDone, d.weightKg, d.durationMin, d.notes],
          [4, 10, 42.5, 12, 'hi'],);
    });

    test('bounds mirror the API', () {
      expect(v(sets: '0').errors['sets'], isNotNull);
      expect(v(sets: '101').errors['sets'], isNotNull);
      expect(v(reps: '1001').errors['reps'], isNotNull);
      expect(v(reps: 'x').errors['reps'], isNotNull);
      expect(v(weight: '0').errors['weight'], isNotNull);
      expect(v(weight: '1001').errors['weight'], isNotNull);
      expect(v(duration: '601').errors['duration'], isNotNull);
      expect(v(notes: 'x' * 501).errors['notes'], isNotNull);
      expect(
        v(sets: '100', reps: '1000', weight: '1000', duration: '600').isValid,
        isTrue,
      );
    });

    test('finish duration', () {
      expect(validateDurationMinutes('').error, isNull);
      expect(validateDurationMinutes('45').minutes, 45);
      expect(validateDurationMinutes('0').error, isNotNull);
      expect(validateDurationMinutes('601').error, isNotNull);
      expect(validateDurationMinutes('4.5').error, isNotNull);
    });
  });

  test('lockedReason', () {
    final t = MemberWorkoutAssignment.fromJson(assignmentJson()).tracking!;
    expect(lockedReason(t.dayOf('2026-10-21')!, 14), isNull);
    expect(lockedReason(t.dayOf('2026-10-23')!, 14), contains('on the day'));
  });
}
