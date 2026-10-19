import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:get_it/get_it.dart';
import 'package:gym_saas_mobile/core/network/api_exception.dart';
import 'package:gym_saas_mobile/features/member/presentation/member_workout_screen.dart';
import 'package:gym_saas_mobile/models/member_workout_assignment.dart';
import 'package:gym_saas_mobile/models/member_workout_tracking.dart';
import 'package:gym_saas_mobile/repositories/member_portal_repository.dart';

import '../fixtures/workout_fixtures.dart' as fixtures;

/// In-memory stand-in for the workout endpoints: keeps the Wednesday
/// (today) exercise statuses and rebuilds the payload on every write.
class _Repo extends Fake implements MemberPortalRepository {
  _Repo({this.withTracking = true, this.empty = false});

  final bool withTracking;
  final bool empty;
  final status = <String, String>{'c': 'PENDING', 'd': 'PENDING'};
  final calls = <String>[];
  WorkoutDetails? lastDetails;
  Object? failNext;
  int? lastEffort;

  Map<String, dynamic> _json() {
    final j = fixtures.assignmentJson();
    final t = fixtures.trackingJson();
    final days = (t['days'] as List).cast<Map<String, dynamic>>();
    final wed = days.firstWhere((d) => d['date'] == '2026-10-21');
    final ex = (wed['exercises'] as List).cast<Map<String, dynamic>>();
    for (final e in ex) {
      final s = status[e['exerciseId']]!;
      e['status'] = s;
      e['logId'] = s == 'PENDING' ? null : 'log-${e['exerciseId']}';
    }
    final done = status.values.where((s) => s == 'COMPLETED').length;
    final logged = status.values.where((s) => s != 'PENDING').length;
    wed['completedCount'] = done;
    wed['skippedCount'] = logged - done;
    wed['state'] = logged == 2 ? 'DONE' : (logged > 0 ? 'PARTIAL' : 'TODAY');
    if (withTracking) j['tracking'] = t;
    if (!withTracking) j.remove('tracking');
    return j;
  }

  MemberWorkoutAssignment _a() => MemberWorkoutAssignment.fromJson(_json());

  void _maybeFail() {
    if (failNext != null) {
      final e = failNext!;
      failNext = null;
      throw e;
    }
  }

  @override
  Future<MemberWorkoutAssignment?> workout() async => empty ? null : _a();

  @override
  Future<WorkoutWriteResult> logWorkout({
    required String exerciseId,
    required String date,
    required LogStatus status,
    WorkoutDetails? details,
  }) async {
    calls.add('log:$exerciseId:${status.apiValue}:$date');
    lastDetails = details;
    _maybeFail();
    this.status[exerciseId] = status.apiValue;
    return WorkoutWriteResult(workout: _a(), created: true);
  }

  @override
  Future<WorkoutWriteResult> deleteWorkoutLog(String id) async {
    calls.add('delete:$id');
    _maybeFail();
    status[id.replaceFirst('log-', '')] = 'PENDING';
    return WorkoutWriteResult(workout: _a());
  }

  @override
  Future<WorkoutWriteResult> completeWorkoutDay({
    required String date,
    int? durationMin,
    int? effort,
    String? notes,
  }) async {
    calls.add('complete:$date:$durationMin:$effort');
    lastEffort = effort;
    _maybeFail();
    var n = 0;
    for (final k in status.keys.toList()) {
      if (status[k] == 'PENDING') {
        status[k] = 'COMPLETED';
        n++;
      }
    }
    return WorkoutWriteResult(workout: _a(), completedNow: n);
  }

  @override
  Future<WorkoutWriteResult> resetWorkoutDay(String date) async {
    calls.add('reset:$date');
    status.updateAll((_, __) => 'PENDING');
    return WorkoutWriteResult(workout: _a());
  }

  @override
  Future<WorkoutHistory> workoutHistory({int days = 60}) async =>
      const WorkoutHistory(today: '2026-10-21', entries: [], sessions: {});
}

Future<void> settle(WidgetTester t) async {
  await t.pump();
  await t.pump(const Duration(seconds: 3));
}

void main() {
  setUp(() {
    final g = GetIt.instance;
    if (g.isRegistered<MemberPortalRepository>()) {
      g.unregister<MemberPortalRepository>();
    }
  });

  Future<void> pumpScreen(
    WidgetTester t,
    _Repo r, {
    Size size = const Size(360, 740),
  }) async {
    GetIt.instance.registerSingleton<MemberPortalRepository>(r);
    t.view.physicalSize = size * 2;
    t.view.devicePixelRatio = 2;
    addTearDown(t.view.reset);
    await t.pumpWidget(
      const MaterialApp(home: Scaffold(body: MemberWorkoutScreen())),
    );
    await settle(t);
  }

  Future<void> tapKey(WidgetTester t, String key) async {
    final f = find.byKey(ValueKey(key));
    await t.scrollUntilVisible(
      f,
      200,
      scrollable: find.byType(Scrollable).first,
    );
    await t.pump();
    await t.tap(f);
    await settle(t);
  }

  testWidgets('shows today, the day cards, progress and advice (360x740)',
      (t) async {
    await pumpScreen(t, _Repo());
    expect(find.byKey(const ValueKey('workout-hero-title')), findsOneWidget);
    expect(find.text('Legs day'), findsOneWidget);
    expect(find.byKey(const ValueKey('ex-c')), findsOneWidget);
    expect(find.byKey(const ValueKey('ex-d')), findsOneWidget);
    expect(find.text('Today · Wednesday'), findsOneWidget);
    await t.scrollUntilVisible(
      find.byKey(const ValueKey('insight-0')),
      300,
      scrollable: find.byType(Scrollable).first,
    );
    expect(find.text('T1'), findsOneWidget);
    expect(find.text('How to get better results'), findsOneWidget);
    expect(t.takeException(), isNull);
  });

  testWidgets('Done and Skip log the exercise for the selected day', (t) async {
    final r = _Repo();
    await pumpScreen(t, r);
    await tapKey(t, 'done-c');
    expect(r.calls, ['log:c:COMPLETED:2026-10-21']);
    expect(find.byKey(const ValueKey('undo-c')), findsOneWidget);
    expect(find.byKey(const ValueKey('done-c')), findsNothing);

    await tapKey(t, 'skip-d');
    expect(r.calls.last, 'log:d:SKIPPED:2026-10-21');
    expect(find.byKey(const ValueKey('edit-d')),
        findsNothing,); // skipped: no details
    expect(t.takeException(), isNull);
  });

  testWidgets('Undo removes the entry via the log id', (t) async {
    final r = _Repo();
    await pumpScreen(t, r);
    await tapKey(t, 'done-c');
    await tapKey(t, 'undo-c');
    expect(r.calls.last, 'delete:log-c');
    expect(find.byKey(const ValueKey('done-c')), findsOneWidget);
  });

  testWidgets('details sheet validates then saves as done', (t) async {
    final r = _Repo();
    await pumpScreen(t, r);
    await tapKey(t, 'details-c');
    // plan targets prefill sets / reps
    await t.enterText(find.byKey(const ValueKey('wd-sets')), '500');
    await t.tap(find.byKey(const ValueKey('wd-save')));
    await settle(t);
    expect(find.text('Sets can be at most 100.'), findsOneWidget);
    expect(r.calls, isEmpty);

    await t.enterText(find.byKey(const ValueKey('wd-sets')), '4');
    await t.enterText(find.byKey(const ValueKey('wd-weight')), '42,5');
    await t.tap(find.byKey(const ValueKey('wd-save')));
    await settle(t);
    expect(r.calls.single, 'log:c:COMPLETED:2026-10-21');
    expect(r.lastDetails!.setsDone, 4);
    expect(r.lastDetails!.weightKg, 42.5);
    expect(find.byKey(const ValueKey('wd-save')), findsNothing);
  });

  testWidgets('Finish workout completes the rest with duration and effort',
      (t) async {
    final r = _Repo();
    await pumpScreen(t, r);
    await tapKey(t, 'finish-workout');
    expect(find.text('Finish workout'), findsWidgets);
    await t.enterText(find.byKey(const ValueKey('fw-minutes')), '45');
    await t.tap(find.byKey(const ValueKey('effort-4')));
    await t.pump();
    await t.tap(find.byKey(const ValueKey('fw-save')));
    await settle(t);
    expect(r.calls.single, 'complete:2026-10-21:45:4');
    expect(find.byKey(const ValueKey('fw-save')), findsNothing);
    expect(
      find.text('Workout complete - 2 exercises marked done'),
      findsOneWidget,
    );
  });

  testWidgets('a failing write shows the API message and keeps the state',
      (t) async {
    final r = _Repo()
      ..failNext = const ApiException(message: 'Nope, not today.');
    await pumpScreen(t, r);
    await tapKey(t, 'done-c');
    expect(find.text('Nope, not today.'), findsOneWidget);
    expect(find.byKey(const ValueKey('done-c')), findsOneWidget);
  });

  testWidgets('a future day is locked; picking it shows the reason', (t) async {
    await pumpScreen(t, _Repo());
    await t.scrollUntilVisible(
      find.byKey(const ValueKey('day-2026-10-23')),
      -200,
      scrollable: find.byType(Scrollable).first,
    );
    await t.tap(find.byKey(const ValueKey('day-2026-10-23')));
    await settle(t);
    expect(find.text('You can log this on the day.'), findsOneWidget);
    expect(find.byKey(const ValueKey('done-e')), findsNothing);
    expect(find.byKey(const ValueKey('finish-workout')), findsNothing);
  });

  testWidgets('a rest day shows the rest note', (t) async {
    await pumpScreen(t, _Repo());
    await t.scrollUntilVisible(
      find.byKey(const ValueKey('day-2026-10-20')),
      -200,
      scrollable: find.byType(Scrollable).first,
    );
    await t.tap(find.byKey(const ValueKey('day-2026-10-20')));
    await settle(t);
    expect(find.textContaining('Rest day - nothing scheduled'), findsOneWidget);
  });

  testWidgets('no plan -> empty state; missing tracking -> retry view',
      (t) async {
    await pumpScreen(t, _Repo(empty: true));
    expect(find.text('No workout plan yet'), findsOneWidget);
  });

  testWidgets('missing tracking block -> retry view', (t) async {
    await pumpScreen(t, _Repo(withTracking: false));
    expect(find.textContaining('not available'), findsOneWidget);
  });

  testWidgets('tablet 1500x1300 renders without overflow', (t) async {
    await pumpScreen(t, _Repo(), size: const Size(1500, 1300));
    expect(find.byKey(const ValueKey('ex-c')), findsOneWidget);
    expect(t.takeException(), isNull);
  });

  testWidgets('details sheet is capped at 640 on a tablet', (t) async {
    await pumpScreen(t, _Repo(), size: const Size(1500, 1300));
    await tapKey(t, 'details-c');
    final w = t.getSize(find.byKey(const ValueKey('wd-save'))).width;
    expect(w, lessThanOrEqualTo(640));
  });
}
