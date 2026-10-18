import 'package:bloc_test/bloc_test.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:get_it/get_it.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:gym_saas_mobile/bloc/session/session_cubit.dart';
import 'package:gym_saas_mobile/bloc/session/session_state.dart';
import 'package:gym_saas_mobile/core/routing/app_routes.dart';
import 'package:gym_saas_mobile/features/manager/presentation/widgets/member_detail_anim.dart';
import 'package:gym_saas_mobile/features/measurements/presentation/measured_members_screen.dart';
import 'package:gym_saas_mobile/features/measurements/presentation/measurement_ui.dart';
import 'package:gym_saas_mobile/features/measurements/presentation/member_measurements_detail_screen.dart';
import 'package:gym_saas_mobile/features/measurements/presentation/new_measurement_screen.dart';
import 'package:gym_saas_mobile/features/member/presentation/member_measurements_screen.dart';
import 'package:gym_saas_mobile/models/body_measurement.dart';
import 'package:gym_saas_mobile/models/gym_member.dart';
import 'package:gym_saas_mobile/models/paginated_result.dart';
import 'package:gym_saas_mobile/models/tenant_branding.dart';
import 'package:gym_saas_mobile/models/user_profile.dart';
import 'package:gym_saas_mobile/repositories/body_measurement_repository.dart';
import 'package:gym_saas_mobile/repositories/member_portal_repository.dart';
import 'package:gym_saas_mobile/repositories/member_repository.dart';
import 'package:mocktail/mocktail.dart';

class _MockSession extends MockCubit<SessionState> implements SessionCubit {}

String _ago(int days) =>
    DateTime.now().toUtc().subtract(Duration(days: days)).toIso8601String();

Map<String, dynamic> _bmJson(
  String id,
  int daysAgo, {
  String? weight,
  String? fat,
  String? waist,
  String? height,
  String? notes,
}) =>
    {
      'id': id,
      'memberId': 'm1',
      'recordedAt': _ago(daysAgo),
      'weightKg': weight,
      'heightCm': height,
      'bodyFatPercent': fat,
      'chestCm': null,
      'waistCm': waist,
      'hipsCm': null,
      'bicepsCm': null,
      'thighsCm': null,
      'notes': notes,
      'recordedBy': {'id': 'u1', 'name': 'Coach Ravi'},
      'createdAt': _ago(daysAgo),
      'updatedAt': _ago(daysAgo),
    };

BodyMeasurement _bm(
  String id,
  int daysAgo, {
  String? weight,
  String? fat,
  String? waist,
  String? height,
  String? notes,
}) =>
    BodyMeasurement.fromJson(
      _bmJson(
        id,
        daysAgo,
        weight: weight,
        fat: fat,
        waist: waist,
        height: height,
        notes: notes,
      ),
    );

MeasuredMemberOption _row({
  String id = 'm1',
  String name = 'Asha Rao',
  String code = 'MEM-0001',
  String branchId = 'b1',
  String branch = 'Bandra',
  String? trainer = 'Ravi',
  int daysAgo = 2,
  int count = 3,
  String weight = '70.00',
}) =>
    MeasuredMemberOption.fromJson({
      'member': {
        'id': id,
        'name': name,
        'memberId': code,
        'profilePhotoUrl': null,
        'branch': {'id': branchId, 'name': branch},
        'trainer': trainer == null ? null : {'id': 't1', 'name': trainer},
      },
      'latest': _bmJson('l-$id', daysAgo, weight: weight),
      'count': count,
    });

GymMember _member({
  String id = 'm1',
  String name = 'Asha Rao',
  String code = 'MEM-0001',
}) =>
    GymMember.fromJson({
      'id': id,
      'memberId': code,
      'firstName': name.split(' ').first,
      'lastName': name.split(' ').last,
      'name': name,
      'profilePhotoUrl': null,
      'email': null,
      'phone': '9876543210',
      'status': 'ACTIVE',
      'branch': {'id': 'b1', 'name': 'Bandra'},
      'trainer': {'id': 't1', 'name': 'Ravi'},
      'currentMembership': null,
      'joiningDate': '2026-01-01T00:00:00.000Z',
      'createdAt': '2026-01-01T10:00:00.000Z',
      'outstandingAmount': '0',
      'deletedAt': null,
    });

class _MeasurementRepo extends Fake implements BodyMeasurementRepository {
  _MeasurementRepo({required this.members, required this.entries});

  List<MeasuredMemberOption> members;
  Map<String, List<BodyMeasurement>> entries;
  final calls = <String>[];
  BodyMeasurementFormInput? lastInput;

  @override
  Future<List<MeasuredMemberOption>> listMembers() async => members;

  @override
  Future<List<BodyMeasurement>> listForMember(String memberId) async =>
      entries[memberId] ?? const [];

  @override
  Future<BodyMeasurement> create(
    String memberId,
    BodyMeasurementFormInput input,
  ) async {
    calls.add('create:$memberId');
    lastInput = input;
    return _bm('new', 0, weight: '1');
  }

  @override
  Future<BodyMeasurement> update(
    String id,
    BodyMeasurementFormInput input,
  ) async {
    calls.add('update:$id');
    lastInput = input;
    return _bm(id, 0, weight: '1');
  }

  @override
  Future<void> delete(String id) async => calls.add('delete:$id');
}

class _MemberRepo extends Fake implements MemberRepository {
  @override
  Future<GymMember> getById(String memberId) async => _member(id: memberId);

  @override
  Future<PaginatedResult<GymMember>> list({
    int page = 1,
    int limit = 20,
    String? search,
    String? status,
    String? trainerId,
    String? branchId,
    String? sortBy,
    String? sortDir,
  }) async =>
      PaginatedResult(
        items: [_member()],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      );
}

class _PortalRepo extends Fake implements MemberPortalRepository {
  _PortalRepo(this.rows);

  List<BodyMeasurement> rows;

  @override
  Future<List<BodyMeasurement>> measurements() async => rows;
}

const _tenant = TenantBranding(
  slug: 't',
  name: 'T',
  status: 'ACTIVE',
  maintenanceMode: false,
  primaryColor: '',
);

const _all = [
  'measurements:view',
  'measurements:create',
  'measurements:update',
  'measurements:delete',
];

// Seed.ts TRAINER: view + create + update (no delete).
const _trainer = [
  'measurements:view',
  'measurements:create',
  'measurements:update',
];

const _viewOnly = ['measurements:view'];

late _MeasurementRepo _repo;

List<BodyMeasurement> _m1Entries() => [
      _bm('e1', 2, weight: '70.00', fat: '18.00', notes: 'Looking good'),
      _bm('e2', 20, weight: '71.50', fat: '19.00'),
      _bm('e3', 40, weight: '72.50', waist: '84.00'),
    ];

void main() {
  setUpAll(() => GoogleFonts.config.allowRuntimeFetching = false);

  setUp(() {
    final g = GetIt.instance;
    _repo = _MeasurementRepo(
      members: [
        _row(),
        _row(
          id: 'm2',
          name: 'Bilal Khan',
          code: 'MEM-0002',
          branchId: 'b2',
          branch: 'Andheri',
          trainer: null,
          daysAgo: 45,
          count: 1,
          weight: '82.00',
        ),
      ],
      entries: {'m1': _m1Entries()},
    );
    if (g.isRegistered<BodyMeasurementRepository>()) {
      g.unregister<BodyMeasurementRepository>();
    }
    g.registerSingleton<BodyMeasurementRepository>(_repo);
    if (g.isRegistered<MemberRepository>()) g.unregister<MemberRepository>();
    g.registerSingleton<MemberRepository>(_MemberRepo());
  });

  Future<void> pumpApp(
    WidgetTester t,
    Widget child, {
    List<String> perms = _all,
    Size size = const Size(560, 900),
  }) async {
    t.view.physicalSize = size * 3;
    t.view.devicePixelRatio = 3;
    addTearDown(t.view.reset);
    final session = _MockSession();
    when(() => session.state).thenReturn(
      SessionAuthenticatedStaff(
        UserProfile(
          id: 'me',
          tenantId: 't',
          name: 'Me',
          email: 'me@x.test',
          phone: null,
          status: 'ACTIVE',
          roles: const ['TRAINER'],
          permissions: perms,
        ),
        _tenant,
      ),
    );
    final router = GoRouter(
      routes: [
        GoRoute(path: '/', builder: (_, __) => child),
        GoRoute(
          path: AppRoutes.newMeasurement,
          builder: (_, __) => const NewMeasurementScreen(),
        ),
        GoRoute(
          path: AppRoutes.memberMeasurementsDetail,
          builder: (_, s) =>
              MemberMeasurementsDetailScreen(memberId: s.extra! as String),
        ),
      ],
    );
    addTearDown(router.dispose);
    await t.pumpWidget(
      BlocProvider<SessionCubit>.value(
        value: session,
        child: MaterialApp.router(routerConfig: router),
      ),
    );
  }

  // Looping hero animations: pump fixed time instead of pumpAndSettle.
  Future<void> settle(WidgetTester t) async {
    await t.pump();
    await t.pump(const Duration(seconds: 3));
  }

  Future<void> step(WidgetTester t) async {
    await t.pump();
    await t.pump(const Duration(milliseconds: 600));
  }

  // Lazily-built lists: scroll until the item exists, then bring it fully
  // on screen so taps land.
  Future<void> scrollTo(WidgetTester t, Finder f) async {
    await t.scrollUntilVisible(
      f,
      300,
      scrollable: find.byType(Scrollable).first,
    );
    await Scrollable.ensureVisible(t.element(f.first), alignment: 0.5);
    await t.pump();
  }

  Finder field(String key) => find.descendant(
        of: find.byKey(ValueKey(key)),
        matching: find.byType(TextField),
      );

  group('MeasurementAccess (gating matrix)', () {
    UserProfile user(List<String> perms) => UserProfile(
          id: 'u',
          tenantId: 't',
          name: 'U',
          email: 'u@x.test',
          phone: null,
          status: 'ACTIVE',
          roles: const ['TRAINER'],
          permissions: perms,
        );

    test('each action is keyed to exactly its own permission', () {
      final none = MeasurementAccess(user(const []));
      expect(
        [none.canView, none.canCreate, none.canUpdate, none.canDelete],
        [false, false, false, false],
      );
      final view = MeasurementAccess(user(_viewOnly));
      expect(
        [view.canView, view.canCreate, view.canUpdate, view.canDelete],
        [true, false, false, false],
      );
      final trainer = MeasurementAccess(user(_trainer));
      expect(
        [
          trainer.canView,
          trainer.canCreate,
          trainer.canUpdate,
          trainer.canDelete,
        ],
        [true, true, true, false],
      );
      final all = MeasurementAccess(user(_all));
      expect(
        [all.canView, all.canCreate, all.canUpdate, all.canDelete],
        [true, true, true, true],
      );
      expect(const MeasurementAccess(null).canView, isFalse);
    });
  });

  group('list', () {
    testWidgets('hero, KPIs, insight panels and cards render', (t) async {
      await pumpApp(t, const MeasuredMembersScreen());
      await settle(t);
      expect(find.text('Body Measurements'), findsOneWidget);
      expect(find.text('2 members'), findsOneWidget);
      expect(find.text('Members tracked'), findsOneWidget);
      expect(find.text('Total entries logged'), findsOneWidget);
      expect(find.text('Measured this week'), findsOneWidget);
      expect(find.text('Avg entries / member'), findsOneWidget);
      // 4 entries over 2 members.
      expect(find.text('2'), findsWidgets);
      expect(find.text('By branch'), findsOneWidget);
      expect(find.text('By trainer'), findsOneWidget);
      expect(find.text('Not measured in 30+ days'), findsOneWidget);
      await scrollTo(t, find.byKey(const ValueKey('measured-m2')));
      expect(find.byKey(const ValueKey('measured-m1')), findsOneWidget);
      expect(find.byKey(const ValueKey('measured-m2')), findsOneWidget);
      expect(find.text('View / edit'), findsWidgets);
      expect(t.takeException(), isNull);
    });

    testWidgets('search narrows the cards (name or member ID)', (t) async {
      await pumpApp(t, const MeasuredMembersScreen());
      await settle(t);
      await scrollTo(t, find.byType(TextField).first);
      await t.enterText(find.byType(TextField).first, 'mem-0002');
      await t.pump(const Duration(milliseconds: 500));
      await t.pump(const Duration(milliseconds: 600));
      await scrollTo(t, find.byKey(const ValueKey('measured-m2')));
      expect(find.byKey(const ValueKey('measured-m1')), findsNothing);
      expect(find.byKey(const ValueKey('measured-m2')), findsOneWidget);

      await t.enterText(find.byType(TextField).first, 'zzz');
      await t.pump(const Duration(milliseconds: 500));
      await step(t);
      expect(find.text('No members match this search.'), findsOneWidget);
      expect(t.takeException(), isNull);
    });

    testWidgets('cards / compact toggle and branch filter', (t) async {
      await pumpApp(t, const MeasuredMembersScreen());
      await settle(t);
      await scrollTo(t, find.byIcon(Icons.view_list_rounded));
      await t.tap(find.byIcon(Icons.view_list_rounded));
      await step(t);
      expect(find.byKey(const ValueKey('measured-m1')), findsOneWidget);

      await t.tap(find.text('All branches'));
      await step(t);
      await t.tap(find.text('Andheri').last);
      await step(t);
      expect(find.byKey(const ValueKey('measured-m1')), findsNothing);
      expect(find.byKey(const ValueKey('measured-m2')), findsOneWidget);
      expect(find.text('1 member'), findsOneWidget);
      expect(t.takeException(), isNull);
    });

    testWidgets('KPI tile opens a member sheet; a row opens the detail',
        (t) async {
      await pumpApp(t, const MeasuredMembersScreen());
      await settle(t);
      await t.tap(find.text('Measured this week'));
      await step(t);
      // Only Asha was measured this week.
      expect(find.text('1 member'), findsWidgets);
      await t.tap(find.text('Asha Rao').last);
      await settle(t);
      expect(find.text('Weight & body fat trend'), findsOneWidget);
      expect(t.takeException(), isNull);
    });

    testWidgets('a card opens that member\'s measurements', (t) async {
      await pumpApp(t, const MeasuredMembersScreen());
      await settle(t);
      await scrollTo(t, find.byKey(const ValueKey('measured-m1')));
      await t.tap(find.byKey(const ValueKey('measured-m1')));
      await settle(t);
      expect(find.text('Body measurements'), findsOneWidget);
      expect(t.takeException(), isNull);
    });

    testWidgets('+ is shown only with measurements:create', (t) async {
      await pumpApp(t, const MeasuredMembersScreen());
      await settle(t);
      expect(find.byIcon(Icons.add_rounded), findsOneWidget);
      await t.tap(find.byIcon(Icons.add_rounded));
      await settle(t);
      expect(find.text('Record a measurement'), findsOneWidget);

      await pumpApp(t, const MeasuredMembersScreen(), perms: _viewOnly);
      await settle(t);
      expect(find.byIcon(Icons.add_rounded), findsNothing);
      expect(t.takeException(), isNull);
    });

    testWidgets('empty list: copy depends on measurements:create', (t) async {
      _repo.members = [];
      await pumpApp(t, const MeasuredMembersScreen());
      await settle(t);
      expect(find.text('No measurements recorded yet'), findsOneWidget);
      expect(
        find.text("Record a member's first measurement to see it here."),
        findsOneWidget,
      );
      expect(find.byIcon(Icons.add_rounded), findsOneWidget);

      await pumpApp(t, const MeasuredMembersScreen(), perms: _viewOnly);
      await settle(t);
      expect(
        find.text("A trainer, manager, or owner hasn't logged any yet."),
        findsOneWidget,
      );
      expect(find.byIcon(Icons.add_rounded), findsNothing);
      expect(t.takeException(), isNull);
    });
  });

  group('member page', () {
    testWidgets('hero, trend, latest entry and Record are shown', (t) async {
      await pumpApp(t, const MemberMeasurementsDetailScreen(memberId: 'm1'));
      await settle(t);
      expect(find.text('Asha Rao'), findsOneWidget);
      expect(find.text('70 kg'), findsWidgets);
      expect(find.text('18% body fat'), findsOneWidget);
      expect(find.text('3 entries'), findsWidgets);
      expect(find.text('Ravi'), findsOneWidget);
      expect(find.text('Weight & body fat trend'), findsOneWidget);
      expect(find.text('Latest'), findsOneWidget);
      expect(find.text('Looking good'), findsOneWidget);
      expect(find.text('Record measurement'), findsOneWidget);
      expect(find.text('History (2)'), findsOneWidget);
      expect(t.takeException(), isNull);
    });

    testWidgets('gating: owner/manager see Edit, Delete and Record', (t) async {
      await pumpApp(t, const MemberMeasurementsDetailScreen(memberId: 'm1'));
      await settle(t);
      await scrollTo(t, find.text('Record measurement'));
      expect(find.byTooltip('Edit'), findsOneWidget);
      expect(find.byTooltip('Delete'), findsOneWidget);
      expect(find.text('Record measurement'), findsOneWidget);
    });

    testWidgets('gating: trainer can record + edit but not delete', (t) async {
      await pumpApp(
        t,
        const MemberMeasurementsDetailScreen(memberId: 'm1'),
        perms: _trainer,
      );
      await settle(t);
      await scrollTo(t, find.text('Record measurement'));
      expect(find.byTooltip('Edit'), findsOneWidget);
      expect(find.byTooltip('Delete'), findsNothing);
      expect(find.text('Record measurement'), findsOneWidget);
    });

    testWidgets('gating: view-only sees the history but no actions', (t) async {
      await pumpApp(
        t,
        const MemberMeasurementsDetailScreen(memberId: 'm1'),
        perms: _viewOnly,
      );
      await settle(t);
      await scrollTo(t, find.text('History (2)'));
      expect(find.byTooltip('Edit'), findsNothing);
      expect(find.byTooltip('Delete'), findsNothing);
      expect(find.text('Record measurement'), findsNothing);
      expect(find.text('History (2)'), findsOneWidget);
      expect(find.text('Weight & body fat trend'), findsOneWidget);
    });

    testWidgets('history expands and each older entry has Edit / Delete',
        (t) async {
      await pumpApp(t, const MemberMeasurementsDetailScreen(memberId: 'm1'));
      await settle(t);
      await scrollTo(t, find.text('History (2)'));
      await t.tap(find.text('History (2)'));
      await step(t);
      await scrollTo(t, find.byKey(const ValueKey('entry-e3')));
      expect(find.byKey(const ValueKey('entry-e2')), findsOneWidget);
      expect(find.byKey(const ValueKey('entry-e3')), findsOneWidget);
      expect(find.byTooltip('Edit'), findsNWidgets(3));
      expect(t.takeException(), isNull);
    });

    testWidgets('record: comma decimals are sent as numbers', (t) async {
      await pumpApp(t, const MemberMeasurementsDetailScreen(memberId: 'm1'));
      await settle(t);
      await scrollTo(t, find.text('Record measurement'));
      await t.tap(find.text('Record measurement'));
      await step(t);
      await scrollTo(t, field('mf-weight'));
      await t.enterText(field('mf-weight'), '78,5');
      await t.enterText(field('mf-bodyFat'), '0');
      await scrollTo(t, find.text('Save measurement'));
      await t.tap(find.text('Save measurement'));
      await step(t);
      expect(_repo.calls, ['create:m1']);
      expect(_repo.lastInput!.weightKg, 78.5);
      expect(_repo.lastInput!.bodyFatPercent, 0);
      expect(_repo.lastInput!.recordedAt, isNotNull);
      expect(find.text('Measurement recorded.'), findsOneWidget);
      expect(t.takeException(), isNull);
    });

    testWidgets('record: an out-of-range value is rejected client-side',
        (t) async {
      await pumpApp(t, const MemberMeasurementsDetailScreen(memberId: 'm1'));
      await settle(t);
      await scrollTo(t, find.text('Record measurement'));
      await t.tap(find.text('Record measurement'));
      await step(t);
      await scrollTo(t, field('mf-weight'));
      await t.enterText(field('mf-weight'), '600');
      await scrollTo(t, find.text('Save measurement'));
      await t.tap(find.text('Save measurement'));
      await step(t);
      expect(find.text('Weight cannot be more than 500 kg.'), findsOneWidget);
      expect(_repo.calls, isEmpty);
    });

    testWidgets('edit: pre-filled form saves through PATCH', (t) async {
      await pumpApp(t, const MemberMeasurementsDetailScreen(memberId: 'm1'));
      await settle(t);
      await scrollTo(t, find.byTooltip('Edit'));
      await t.tap(find.byTooltip('Edit'));
      await step(t);
      expect(
        t.widget<TextField>(field('mf-weight')).controller!.text,
        '70',
      );
      await t.enterText(field('mf-weight'), '69.5');
      await scrollTo(t, find.text('Save'));
      await t.tap(find.text('Save'));
      await step(t);
      expect(_repo.calls, ['update:e1']);
      expect(_repo.lastInput!.weightKg, 69.5);
      expect(find.text('Measurement updated.'), findsOneWidget);
      expect(t.takeException(), isNull);
    });

    testWidgets('delete asks first, then calls DELETE', (t) async {
      await pumpApp(t, const MemberMeasurementsDetailScreen(memberId: 'm1'));
      await settle(t);
      await scrollTo(t, find.byTooltip('Delete'));
      await t.tap(find.byTooltip('Delete'));
      await step(t);
      expect(find.text('Delete this measurement?'), findsOneWidget);
      expect(_repo.calls, isEmpty);
      await t.tap(find.text('Cancel'));
      await step(t);
      expect(_repo.calls, isEmpty);

      await t.tap(find.byTooltip('Delete'));
      await step(t);
      await t.tap(find.text('Delete').last);
      await step(t);
      expect(_repo.calls, ['delete:e1']);
      expect(find.text('Measurement deleted.'), findsOneWidget);
    });

    testWidgets('no entries: empty trend and entries messages', (t) async {
      _repo.entries = {'m1': []};
      await pumpApp(t, const MemberMeasurementsDetailScreen(memberId: 'm1'));
      await settle(t);
      expect(find.text('No measurements recorded yet.'), findsWidgets);
      expect(find.text('Record measurement'), findsOneWidget);
      expect(t.takeException(), isNull);
    });

    testWidgets('one entry: trend asks for a second', (t) async {
      _repo.entries = {
        'm1': [_bm('e1', 1, weight: '70')],
      };
      await pumpApp(t, const MemberMeasurementsDetailScreen(memberId: 'm1'));
      await settle(t);
      expect(
        find.text('Record at least two entries with weight to see a trend.'),
        findsOneWidget,
      );
    });
  });

  group('record a measurement', () {
    testWidgets('Save is disabled until a member is picked', (t) async {
      await pumpApp(t, const NewMeasurementScreen());
      await settle(t);
      expect(find.text('Record a measurement'), findsOneWidget);
      await t.tap(find.text('Save measurement'));
      await step(t);
      expect(_repo.calls, isEmpty);
    });

    testWidgets('search, pick, fill, save -> opens the member page', (t) async {
      await pumpApp(t, const NewMeasurementScreen());
      await settle(t);
      await t.enterText(find.byType(TextField).first, 'asha');
      await t.pump(const Duration(milliseconds: 500));
      await step(t);
      await t.tap(find.text('MEM-0001 · Bandra'));
      await step(t);
      expect(find.byTooltip('Change member'), findsOneWidget);

      await scrollTo(t, field('mf-weight'));
      await t.enterText(field('mf-weight'), '80');
      await t.tap(find.text('Save measurement'));
      await settle(t);
      expect(_repo.calls, ['create:m1']);
      expect(_repo.lastInput!.weightKg, 80);
      expect(find.text('Weight & body fat trend'), findsOneWidget);
      expect(t.takeException(), isNull);
    });

    testWidgets('a bad value shows an inline error and does not save',
        (t) async {
      await pumpApp(t, const NewMeasurementScreen());
      await settle(t);
      await t.enterText(find.byType(TextField).first, 'asha');
      await t.pump(const Duration(milliseconds: 500));
      await step(t);
      await t.tap(find.text('MEM-0001 · Bandra'));
      await step(t);
      await scrollTo(t, field('mf-height'));
      await t.enterText(field('mf-height'), '350');
      await t.tap(find.text('Save measurement'));
      await step(t);
      expect(find.text('Height cannot be more than 300 cm.'), findsOneWidget);
      expect(_repo.calls, isEmpty);
    });
  });

  group('member plane (read-only)', () {
    setUp(() {
      final g = GetIt.instance;
      if (g.isRegistered<MemberPortalRepository>()) {
        g.unregister<MemberPortalRepository>();
      }
    });

    Future<void> pumpMember(
      WidgetTester t,
      List<BodyMeasurement> rows, {
      Size size = const Size(560, 900),
    }) async {
      GetIt.instance
          .registerSingleton<MemberPortalRepository>(_PortalRepo(rows));
      t.view.physicalSize = size * 3;
      t.view.devicePixelRatio = 3;
      addTearDown(t.view.reset);
      await t.pumpWidget(const MaterialApp(home: MemberMeasurementsScreen()));
    }

    final rows = [
      _bm('a', 60, weight: '75.00', fat: '22.00', height: '175', waist: '90'),
      _bm('b', 30, weight: '73.00', fat: '20.00', waist: '88'),
      _bm('c', 2, weight: '71.50', fat: '19.00', waist: '86', notes: 'Great'),
    ];

    testWidgets('hero, tiles, trends, comparison and history', (t) async {
      await pumpMember(t, rows);
      await settle(t);
      expect(find.text('71.5 kg'), findsWidgets);
      expect(find.text('BMI (computed)'), findsWidgets);
      expect(find.text('Trends'), findsOneWidget);
      expect(find.text('1M'), findsOneWidget);
      await scrollTo(t, find.text('First vs latest'));
      expect(find.text('First vs latest'), findsOneWidget);
      await scrollTo(t, find.text('History'));
      expect(t.takeException(), isNull);
    });

    testWidgets('range chips re-plot without errors', (t) async {
      await pumpMember(t, rows);
      await settle(t);
      await scrollTo(t, find.text('1M'));
      for (final r in ['1M', '3M', '6M', 'All']) {
        await t.tap(find.text(r));
        await step(t);
      }
      expect(t.takeException(), isNull);
    });

    testWidgets('history rows expand to every value', (t) async {
      await pumpMember(t, rows);
      await settle(t);
      await scrollTo(t, find.text('History'));
      await t.drag(find.byType(Scrollable).first, const Offset(0, -400));
      await step(t);
      final latest = find.text('Latest');
      await scrollTo(t, latest);
      await t.tap(latest);
      await step(t);
      expect(find.text('Great'), findsOneWidget);
      expect(find.text('Logged by Coach Ravi'), findsOneWidget);
    });

    testWidgets('no measurements -> friendly empty state', (t) async {
      await pumpMember(t, const []);
      await settle(t);
      expect(find.text('No check-ins yet'), findsOneWidget);
      expect(find.text('No measurements yet'), findsOneWidget);
    });
  });

  group('tablet (wide) layouts', () {
    const tablet = Size(1500, 1300);

    testWidgets('list: content capped + centred, hero full-bleed, 2-up cards',
        (t) async {
      await pumpApp(t, const MeasuredMembersScreen(), size: tablet);
      await settle(t);
      expect(t.getSize(find.byType(MeshHeroBackground).first).width, 1500);
      expect(t.getTopLeft(find.text('Body Measurements')).dx, greaterThan(110));
      final kpi = t.getTopLeft(find.text('Members tracked'));
      expect(kpi.dx, greaterThan(110));
      await scrollTo(t, find.byKey(const ValueKey('measured-m2')));
      final a = t.getTopLeft(find.byKey(const ValueKey('measured-m1')));
      final b = t.getTopLeft(find.byKey(const ValueKey('measured-m2')));
      expect(b.dx, greaterThan(a.dx + 200));
      expect((b.dy - a.dy).abs(), lessThan(5));
      expect(t.takeException(), isNull);
    });

    testWidgets('member page, record page and member plane render', (t) async {
      for (final w in <Widget>[
        const MemberMeasurementsDetailScreen(memberId: 'm1'),
        const NewMeasurementScreen(),
      ]) {
        await pumpApp(t, w, size: tablet);
        await settle(t);
        expect(t.takeException(), isNull, reason: w.runtimeType.toString());
      }
      if (GetIt.instance.isRegistered<MemberPortalRepository>()) {
        GetIt.instance.unregister<MemberPortalRepository>();
      }
      GetIt.instance.registerSingleton<MemberPortalRepository>(
        _PortalRepo([
          _bm('a', 60, weight: '75', height: '175'),
          _bm('b', 2, weight: '71.5'),
        ]),
      );
      t.view.physicalSize = tablet * 3;
      t.view.devicePixelRatio = 3;
      addTearDown(t.view.reset);
      await t.pumpWidget(const MaterialApp(home: MemberMeasurementsScreen()));
      await settle(t);
      expect(t.takeException(), isNull);
    });

    testWidgets('record form: fields sit three per row on a tablet', (t) async {
      await pumpApp(t, const NewMeasurementScreen(), size: tablet);
      await settle(t);
      await scrollTo(t, field('mf-weight'));
      final w = t.getTopLeft(field('mf-weight'));
      final h = t.getTopLeft(field('mf-height'));
      final f = t.getTopLeft(field('mf-bodyFat'));
      expect((w.dy - h.dy).abs(), lessThan(5));
      expect(h.dx, greaterThan(w.dx + 150));
      expect((f.dy - w.dy).abs(), lessThan(5));
      expect(t.takeException(), isNull);
    });
  });
}
