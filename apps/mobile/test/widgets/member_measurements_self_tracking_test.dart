import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:get_it/get_it.dart';
import 'package:gym_saas_mobile/core/network/api_exception.dart';
import 'package:gym_saas_mobile/features/member/presentation/member_measurements_screen.dart';
import 'package:gym_saas_mobile/models/body_measurement.dart';
import 'package:gym_saas_mobile/models/gym_member.dart';
import 'package:gym_saas_mobile/models/member_portal_profile.dart';
import 'package:gym_saas_mobile/features/team/presentation/widgets/team_ui.dart';
import 'package:gym_saas_mobile/repositories/member_portal_repository.dart';

/// UTC-midnight JSON for the calendar day [daysAgo] before today (how the
/// app and API store a plain date).
String _day(int daysAgo) {
  final n = DateTime.now();
  return DateTime.utc(n.year, n.month, n.day - daysAgo).toIso8601String();
}

BodyMeasurement _entry(
  String id,
  int daysAgo, {
  String? weight,
  String? waist,
  String? height,
  String? notes,
  bool staff = false,
}) =>
    BodyMeasurement.fromJson({
      'id': id,
      'memberId': 'm1',
      'recordedAt': _day(daysAgo),
      'weightKg': weight,
      'heightCm': height,
      'bodyFatPercent': null,
      'chestCm': null,
      'waistCm': waist,
      'hipsCm': null,
      'bicepsCm': null,
      'thighsCm': null,
      'notes': notes,
      'recordedBy': staff ? {'id': 'u1', 'name': 'Coach Ravi'} : null,
      'source': staff ? 'STAFF' : 'MEMBER',
      'createdAt': _day(daysAgo),
      'updatedAt': _day(daysAgo),
    });

/// In-memory stand-in for the member plane that applies the server's
/// "one member entry per day" rule, so the screen's reload shows the result.
class _Repo extends Fake implements MemberPortalRepository {
  _Repo(this.rows, {this.target});

  List<BodyMeasurement> rows;
  final double? target;
  final calls = <String>[];
  BodyMeasurementFormInput? lastInput;
  Object? failNext;
  int _seq = 0;

  @override
  Future<List<BodyMeasurement>> measurements() async {
    final sorted = [...rows]
      ..sort((a, b) => b.recordedAt.compareTo(a.recordedAt));
    return sorted;
  }

  @override
  Future<MemberPortalProfile> me() async => MemberPortalProfile(
        id: 'm1',
        memberId: 'MEM-0001',
        name: 'Asha Rao',
        email: null,
        phone: null,
        status: 'ACTIVE',
        branch: const MemberBranchSummary(id: 'b1', name: 'Main'),
        currentMembership: null,
        joiningDate: DateTime(2026, 1, 1),
        targetWeightKg: target,
      );

  BodyMeasurement _from(
    String id,
    BodyMeasurementFormInput i,
    BodyMeasurement? old,
  ) =>
      BodyMeasurement(
        id: id,
        memberId: 'm1',
        recordedAt: i.recordedAt ?? old!.recordedAt,
        weightKg: i.weightKg ?? old?.weightKg,
        heightCm: i.heightCm ?? old?.heightCm,
        bodyFatPercent: i.bodyFatPercent ?? old?.bodyFatPercent,
        chestCm: i.chestCm ?? old?.chestCm,
        waistCm: i.waistCm ?? old?.waistCm,
        hipsCm: i.hipsCm ?? old?.hipsCm,
        bicepsCm: i.bicepsCm ?? old?.bicepsCm,
        thighsCm: i.thighsCm ?? old?.thighsCm,
        notes: i.notes ?? old?.notes,
        recordedBy: null,
        source: MeasurementSource.member,
      );

  @override
  Future<MeasurementLogResult> logMeasurement(
    BodyMeasurementFormInput input,
  ) async {
    calls.add('log');
    lastInput = input;
    if (failNext != null) {
      final e = failNext!;
      failNext = null;
      throw e;
    }
    final day = input.recordedAt!;
    final i = rows.indexWhere(
      (r) =>
          r.isMemberLogged &&
          r.recordedAt.year == day.year &&
          r.recordedAt.month == day.month &&
          r.recordedAt.day == day.day,
    );
    if (i >= 0) {
      rows[i] = _from(rows[i].id, input, rows[i]);
      return MeasurementLogResult(entry: rows[i], created: false);
    }
    final created = _from('new-${++_seq}', input, null);
    rows.add(created);
    return MeasurementLogResult(entry: created, created: true);
  }

  @override
  Future<BodyMeasurement> updateMeasurement(
    String id,
    BodyMeasurementFormInput input,
  ) async {
    calls.add('update:$id');
    lastInput = input;
    final i = rows.indexWhere((r) => r.id == id);
    rows[i] = _from(id, input, rows[i]);
    return rows[i];
  }

  @override
  Future<void> deleteMeasurement(String id) async {
    calls.add('delete:$id');
    if (failNext != null) {
      final e = failNext!;
      failNext = null;
      throw e;
    }
    rows.removeWhere((r) => r.id == id);
  }
}

Future<void> settle(WidgetTester t) async {
  await t.pump();
  await t.pump(const Duration(seconds: 3));
}

Future<void> step(WidgetTester t) async {
  await t.pump();
  await t.pump(const Duration(milliseconds: 600));
}

void main() {
  late _Repo repo;

  setUp(() {
    final g = GetIt.instance;
    if (g.isRegistered<MemberPortalRepository>()) {
      g.unregister<MemberPortalRepository>();
    }
  });

  Future<void> pumpScreen(
    WidgetTester t,
    _Repo r, {
    Size size = const Size(560, 900),
  }) async {
    repo = r;
    GetIt.instance.registerSingleton<MemberPortalRepository>(r);
    t.view.physicalSize = size * 3;
    t.view.devicePixelRatio = 3;
    addTearDown(t.view.reset);
    await t.pumpWidget(const MaterialApp(home: MemberMeasurementsScreen()));
    await settle(t);
  }

  Future<void> tapKey(WidgetTester t, String key) async {
    final f = find.byKey(ValueKey(key));
    await Scrollable.ensureVisible(t.element(f), alignment: 0.5);
    await t.pump();
    await t.tap(f);
    await step(t);
  }

  Future<void> openRow(WidgetTester t, String id) async {
    final row = find.byKey(ValueKey('history-$id'));
    await t.scrollUntilVisible(
      row,
      300,
      scrollable: find.byType(Scrollable).first,
    );
    await t.pump();
    await t.tap(
      find.descendant(of: row, matching: find.byType(InkWell)).first,
    );
    await step(t);
  }

  Finder weightField() => find.byKey(const ValueKey('qw-weight'));

  String weightText(WidgetTester t) =>
      t.widget<TextField>(weightField()).controller!.text;

  group('quick weight log', () {
    testWidgets(
        'prefills the last weight; steppers move it by 0.1; saves '
        'today as a new entry', (t) async {
      await pumpScreen(t, _Repo([_entry('a', 2, weight: '71.50')]));
      await tapKey(t, 'log-weight');
      expect(find.text('Log weight'), findsWidgets);
      expect(weightText(t), '71.5');

      await t.tap(find.byKey(const ValueKey('qw-plus')));
      await t.pump();
      expect(weightText(t), '71.6');
      await t.tap(find.byKey(const ValueKey('qw-minus')));
      await t.tap(find.byKey(const ValueKey('qw-minus')));
      await t.pump();
      expect(weightText(t), '71.4');

      await t.tap(find.byKey(const ValueKey('qw-save')));
      await settle(t);
      expect(repo.calls, ['log']);
      expect(repo.lastInput!.weightKg, 71.4);
      final n = DateTime.now();
      expect(
        repo.lastInput!.recordedAt,
        DateTime.utc(n.year, n.month, n.day),
      );
      // Only the weight is sent in a quick log.
      expect(repo.lastInput!.waistCm, isNull);
      expect(find.text('Weight saved.'), findsOneWidget);
      // Sheet closed, list reloaded with the new entry.
      expect(find.byKey(const ValueKey('qw-save')), findsNothing);
      expect(repo.rows.length, 2);
      expect(t.takeException(), isNull);
    });

    testWidgets('logging again on the same day updates that entry', (t) async {
      await pumpScreen(
        t,
        _Repo([
          _entry('today', 0, weight: '72.00'),
          _entry('old', 5, weight: '73'),
        ]),
      );
      await tapKey(t, 'log-weight');
      // Today's own entry is what the field shows, and the sheet says so.
      expect(weightText(t), '72');
      expect(find.text('Update weight'), findsOneWidget);
      expect(find.byKey(const ValueKey('qw-updating')), findsOneWidget);

      await t.enterText(weightField(), '71,8'); // comma decimal accepted
      await t.tap(find.byKey(const ValueKey('qw-save')));
      await settle(t);
      expect(repo.lastInput!.weightKg, 71.8);
      expect(find.text('Weight updated for that day.'), findsOneWidget);
      // Still exactly one entry for today.
      expect(repo.rows.where((r) => r.id == 'today').length, 1);
      expect(repo.rows.length, 2);
    });

    testWidgets('shows clear field errors and does not call the API',
        (t) async {
      await pumpScreen(t, _Repo([_entry('a', 2, weight: '71.50')]));
      await tapKey(t, 'log-weight');

      await t.enterText(weightField(), '');
      await t.tap(find.byKey(const ValueKey('qw-save')));
      await step(t);
      expect(find.text('Enter your weight.'), findsOneWidget);

      await t.enterText(weightField(), '900');
      await t.tap(find.byKey(const ValueKey('qw-save')));
      await step(t);
      expect(find.text('Weight cannot be more than 500 kg.'), findsOneWidget);

      await t.enterText(weightField(), '0');
      await t.tap(find.byKey(const ValueKey('qw-save')));
      await step(t);
      expect(find.text('Weight must be greater than 0.'), findsOneWidget);
      expect(repo.calls, isEmpty);
    });

    testWidgets('an API error stays in the sheet and the button recovers',
        (t) async {
      final r = _Repo([_entry('a', 2, weight: '71.50')])
        ..failNext = ApiException(
          message: 'You can’t log a measurement for a future date.',
          statusCode: 422,
        );
      await pumpScreen(t, r);
      await tapKey(t, 'log-weight');
      await t.tap(find.byKey(const ValueKey('qw-save')));
      await settle(t);
      expect(
        find.text('You can’t log a measurement for a future date.'),
        findsOneWidget,
      );
      expect(find.byKey(const ValueKey('qw-save')), findsOneWidget);
      // Retry works (loading flag was reset).
      await t.tap(find.byKey(const ValueKey('qw-save')));
      await settle(t);
      expect(find.byKey(const ValueKey('qw-save')), findsNothing);
      expect(find.text('Weight saved.'), findsOneWidget);
    });

    testWidgets('a non-API failure shows a friendly message and recovers',
        (t) async {
      final r = _Repo([_entry('a', 2, weight: '71.50')])
        ..failNext = StateError('boom');
      await pumpScreen(t, r);
      await tapKey(t, 'log-weight');
      await t.tap(find.byKey(const ValueKey('qw-save')));
      await settle(t);
      expect(
        find.text('Could not save your weight. Try again.'),
        findsOneWidget,
      );
      expect(find.text('Bad state: boom'), findsNothing);
      await t.tap(find.byKey(const ValueKey('qw-save')));
      await settle(t);
      expect(find.text('Weight saved.'), findsOneWidget);
    });

    testWidgets('empty state offers logging, not "ask your trainer"',
        (t) async {
      await pumpScreen(t, _Repo([]));
      expect(find.text('No check-ins yet'), findsOneWidget);
      expect(find.text('No measurements yet'), findsOneWidget);
      expect(find.textContaining('Ask your trainer'), findsNothing);
      expect(find.byKey(const ValueKey('log-weight')), findsOneWidget);
      expect(find.byKey(const ValueKey('full-checkin')), findsOneWidget);
      // First ever weight: no prefill, empty field.
      await tapKey(t, 'log-weight');
      expect(weightText(t), '');
      await t.enterText(weightField(), '80');
      await t.tap(find.byKey(const ValueKey('qw-save')));
      await settle(t);
      expect(repo.rows.single.weightKg, 80);
      expect(find.text('No check-ins yet'), findsNothing);
    });
  });

  group('full check-in', () {
    Finder sheetScroll() => find
        .descendant(
          of: find.byType(BottomSheet),
          matching: find.byType(Scrollable),
        )
        .first;

    Future<void> enter(WidgetTester t, String key, String text) async {
      final f = find.descendant(
        of: find.byKey(ValueKey(key)),
        matching: find.byType(TextField),
      );
      await t.scrollUntilVisible(f, 200, scrollable: sheetScroll());
      await t.pump();
      await t.enterText(f, text);
    }

    testWidgets('validates bounds, then saves the full set', (t) async {
      await pumpScreen(t, _Repo([_entry('a', 3, weight: '71.50')]));
      await tapKey(t, 'full-checkin');
      expect(find.text('Full check-in'), findsWidgets);

      await enter(t, 'mf-height', '350');
      await tapKey(t, 'ci-save');
      expect(find.text('Height cannot be more than 300 cm.'), findsOneWidget);
      expect(repo.calls, isEmpty);

      await enter(t, 'mf-height', '175');
      await enter(t, 'mf-weight', '70,5');
      await enter(t, 'mf-waist', '82');
      await enter(t, 'mf-notes', 'Morning, fasted');
      await tapKey(t, 'ci-save');
      await settle(t);
      expect(repo.calls, ['log']);
      final i = repo.lastInput!;
      expect(i.weightKg, 70.5);
      expect(i.heightCm, 175);
      expect(i.waistCm, 82);
      expect(i.notes, 'Morning, fasted');
      expect(find.text('Check-in saved.'), findsOneWidget);
      expect(repo.rows.length, 2);
    });

    testWidgets('requires at least one value', (t) async {
      await pumpScreen(t, _Repo([_entry('a', 3, weight: '71.50')]));
      await tapKey(t, 'full-checkin');
      await tapKey(t, 'ci-save');
      expect(find.text('Enter at least one measurement.'), findsOneWidget);
      expect(repo.calls, isEmpty);
    });

    testWidgets("today's own entry is prefilled and saving updates it",
        (t) async {
      await pumpScreen(
        t,
        _Repo([_entry('today', 0, weight: '72.00', waist: '84')]),
      );
      await tapKey(t, 'full-checkin');
      final waist = find.descendant(
        of: find.byKey(const ValueKey('mf-waist')),
        matching: find.byType(TextField),
      );
      await t.scrollUntilVisible(waist, 200, scrollable: sheetScroll());
      expect(t.widget<TextField>(waist).controller!.text, '84');
      await enter(t, 'mf-waist', '83');
      await tapKey(t, 'ci-save');
      await settle(t);
      expect(find.text('Check-in updated for that day.'), findsOneWidget);
      expect(repo.rows.single.waistCm, 83);
    });
  });

  group('own entries vs staff entries', () {
    testWidgets(
        'own entries show the tag and Edit / Delete; staff entries '
        'show neither', (t) async {
      await pumpScreen(
        t,
        _Repo([
          _entry('mine', 1, weight: '71.50'),
          _entry('staff', 9, weight: '74.00', staff: true),
        ]),
      );
      expect(find.text('Logged by you'), findsOneWidget);
      expect(find.text('Recorded by Coach Ravi'), findsOneWidget);

      await openRow(t, 'mine');
      expect(find.byKey(const ValueKey('edit-mine')), findsOneWidget);
      expect(find.byKey(const ValueKey('delete-mine')), findsOneWidget);

      await openRow(t, 'staff');
      expect(find.byKey(const ValueKey('edit-staff')), findsNothing);
      expect(find.byKey(const ValueKey('delete-staff')), findsNothing);
      expect(
        find.text('Recorded by your gym — only they can change it.'),
        findsOneWidget,
      );
    });

    testWidgets('edit: opens prefilled and PATCHes the entry', (t) async {
      await pumpScreen(
        t,
        _Repo([
          _entry('mine', 1, weight: '71.50', waist: '85'),
          _entry('b', 6, weight: '73'),
        ]),
      );
      await openRow(t, 'mine');
      await tapKey(t, 'edit-mine');
      expect(find.text('Edit check-in'), findsOneWidget);
      final weight = find.descendant(
        of: find.byKey(const ValueKey('mf-weight')),
        matching: find.byType(TextField),
      );
      expect(t.widget<TextField>(weight).controller!.text, '71.5');

      await t.enterText(weight, '70.9');
      await tapKey(t, 'ci-save');
      await settle(t);
      expect(repo.calls, ['update:mine']);
      expect(repo.lastInput!.weightKg, 70.9);
      expect(find.text('Entry updated.'), findsOneWidget);
      expect(repo.rows.firstWhere((r) => r.id == 'mine').weightKg, 70.9);
    });

    testWidgets('delete: confirms first, then removes only that entry',
        (t) async {
      await pumpScreen(
        t,
        _Repo([
          _entry('mine', 1, weight: '71.50'),
          _entry('b', 6, weight: '73'),
        ]),
      );
      await openRow(t, 'mine');
      await tapKey(t, 'delete-mine');
      expect(find.text('Delete this entry?'), findsOneWidget);

      // Cancel keeps it.
      await t.tap(find.text('Cancel'));
      await step(t);
      expect(repo.calls, isEmpty);

      await tapKey(t, 'delete-mine');
      await t.tap(find.text('Delete').last);
      await settle(t);
      expect(repo.calls, ['delete:mine']);
      expect(repo.rows.map((r) => r.id), ['b']);
      expect(find.text('Entry deleted.'), findsOneWidget);
      expect(find.byKey(const ValueKey('history-mine')), findsNothing);
    });

    testWidgets('a failed delete keeps the entry and shows the reason',
        (t) async {
      final r = _Repo([
        _entry('mine', 1, weight: '71.50'),
        _entry('b', 6, weight: '73'),
      ])
        ..failNext = ApiException(message: 'Measurement entry not found.');
      await pumpScreen(t, r);
      await openRow(t, 'mine');
      await tapKey(t, 'delete-mine');
      await t.tap(find.text('Delete').last);
      await settle(t);
      expect(find.text('Measurement entry not found.'), findsOneWidget);
      expect(find.byKey(const ValueKey('history-mine')), findsOneWidget);
      // Buttons are usable again.
      expect(find.byKey(const ValueKey('delete-mine')), findsOneWidget);
    });
  });

  group('daily / weekly tracking UI', () {
    testWidgets('week stats, streak, delta and the 7-day-average chart',
        (t) async {
      await pumpScreen(
        t,
        _Repo([
          _entry('a', 0, weight: '70.00'),
          _entry('b', 1, weight: '70.50'),
          _entry('c', 2, weight: '71.00'),
          _entry('d', 8, weight: '73.00'),
          _entry('e', 10, weight: '73.50'),
        ]),
      );
      expect(find.text('Daily tracking'), findsOneWidget);
      expect(find.text('3/7 days'), findsOneWidget);
      expect(find.text('3 days'), findsOneWidget);
      expect(find.text('70.5 kg'), findsWidgets); // weekly average
      expect(find.byKey(const ValueKey('week-delta')), findsOneWidget);
      expect(find.textContaining('kg vs last week'), findsOneWidget);
      // The last three day dots are filled.
      expect(find.byKey(const ValueKey('day-dot-6-on')), findsOneWidget);
      expect(find.byKey(const ValueKey('day-dot-0-off')), findsOneWidget);

      await t.scrollUntilVisible(
        find.text('Weight (kg)'),
        300,
        scrollable: find.byType(Scrollable).first,
      );
      await step(t);
      expect(find.text('7-day average (kg)'), findsOneWidget);
      expect(find.text('Weight (kg)'), findsOneWidget);
      expect(t.takeException(), isNull);
    });

    testWidgets('goal card appears only when the API provides a target',
        (t) async {
      final rows = [
        _entry('a', 40, weight: '80.00'),
        _entry('b', 0, weight: '76.00'),
      ];
      await pumpScreen(t, _Repo(rows, target: 70));
      expect(find.byKey(const ValueKey('goal-card')), findsOneWidget);
      expect(find.text('Goal 70 kg'), findsOneWidget);
      expect(find.text('6 kg to go'), findsOneWidget);
      expect(find.text('Started at 80 kg'), findsOneWidget);
      expect(find.text('40%'), findsOneWidget);
    });

    testWidgets('no target -> no goal card', (t) async {
      await pumpScreen(
        t,
        _Repo([_entry('a', 40, weight: '80'), _entry('b', 0, weight: '76')]),
      );
      expect(find.byKey(const ValueKey('goal-card')), findsNothing);
      expect(find.text('Daily tracking'), findsOneWidget);
    });

    testWidgets('reached goal is celebrated', (t) async {
      await pumpScreen(
        t,
        _Repo(
          [_entry('a', 40, weight: '80'), _entry('b', 0, weight: '69.5')],
          target: 70,
        ),
      );
      expect(find.text('Goal reached — great work!'), findsOneWidget);
    });
  });

  group('layout', () {
    final rows = [
      _entry('a', 60, weight: '80.00', height: '175', waist: '90'),
      _entry('b', 30, weight: '78.00', waist: '88'),
      _entry('c', 1, weight: '76.50', waist: '86', notes: 'Great'),
      _entry('s', 20, weight: '79.00', staff: true),
    ];

    testWidgets('tablet (1500x1300): renders with the goal card, no overflow',
        (t) async {
      await pumpScreen(
        t,
        _Repo([...rows], target: 70),
        size: const Size(1500, 1300),
      );
      expect(find.byKey(const ValueKey('goal-card')), findsOneWidget);
      expect(t.takeException(), isNull);
    });

    testWidgets('tablet: quick-log and check-in sheets are capped to 640',
        (t) async {
      await pumpScreen(t, _Repo([...rows]), size: const Size(1500, 1300));
      await tapKey(t, 'log-weight');
      final w = t.getSize(find.byType(TeamSheetScaffold)).width;
      expect(w, lessThanOrEqualTo(640));
      expect(t.takeException(), isNull);
    });

    testWidgets(
        '360x740: page, quick-log sheet and check-in sheet do not '
        'overflow', (t) async {
      await pumpScreen(
        t,
        _Repo([...rows], target: 70),
        size: const Size(360, 740),
      );
      expect(t.takeException(), isNull);

      await tapKey(t, 'log-weight');
      expect(t.takeException(), isNull);
      await t.tap(find.byKey(const ValueKey('qw-plus')));
      await t.pump();
      Navigator.of(t.element(find.byType(BottomSheet).first)).pop();
      await settle(t);

      await tapKey(t, 'full-checkin');
      expect(t.takeException(), isNull);
      Navigator.of(t.element(find.byType(BottomSheet).first)).pop();
      await settle(t);
      expect(t.takeException(), isNull);
    });

    testWidgets('360x740: empty state with both actions fits', (t) async {
      await pumpScreen(t, _Repo([]), size: const Size(360, 740));
      expect(find.byKey(const ValueKey('log-weight')), findsOneWidget);
      expect(find.byKey(const ValueKey('full-checkin')), findsOneWidget);
      expect(t.takeException(), isNull);
    });
  });
}
