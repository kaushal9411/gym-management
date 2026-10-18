import 'dart:async';

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
import 'package:gym_saas_mobile/features/classes/presentation/class_add_attendee_screen.dart';
import 'package:gym_saas_mobile/features/classes/presentation/class_detail_screen.dart';
import 'package:gym_saas_mobile/features/classes/presentation/class_form_screen.dart';
import 'package:gym_saas_mobile/features/classes/presentation/class_session_detail_screen.dart';
import 'package:gym_saas_mobile/features/classes/presentation/class_ui.dart';
import 'package:gym_saas_mobile/features/classes/presentation/classes_calendar_screen.dart';
import 'package:gym_saas_mobile/features/classes/presentation/classes_screen.dart';
import 'package:gym_saas_mobile/features/member/presentation/member_classes_screen.dart';
import 'package:gym_saas_mobile/models/branch_option.dart';
import 'package:gym_saas_mobile/models/class_session.dart';
import 'package:gym_saas_mobile/models/group_class.dart';
import 'package:gym_saas_mobile/models/gym_member.dart';
import 'package:gym_saas_mobile/models/member_booking.dart';
import 'package:gym_saas_mobile/models/paginated_result.dart';
import 'package:gym_saas_mobile/models/tenant_branding.dart';
import 'package:gym_saas_mobile/models/user_profile.dart';
import 'package:gym_saas_mobile/repositories/branch_repository.dart';
import 'package:gym_saas_mobile/repositories/class_session_repository.dart';
import 'package:gym_saas_mobile/repositories/group_class_repository.dart';
import 'package:gym_saas_mobile/repositories/member_portal_repository.dart';
import 'package:gym_saas_mobile/repositories/member_repository.dart';
import 'package:mocktail/mocktail.dart';

class _MockSession extends MockCubit<SessionState> implements SessionCubit {}

Map<String, dynamic> _rawClass({
  String id = 'c1',
  String name = 'Morning Yoga',
  bool isActive = true,
  String? deletedAt,
  int capacity = 15,
}) =>
    {
      'id': id,
      'name': name,
      'description': 'Wake up gently',
      'trainer': {'id': 't1', 'name': 'Asha Rao'},
      'branch': {'id': 'b1', 'name': 'Bandra'},
      'capacity': capacity,
      'durationMinutes': 60,
      'isActive': isActive,
      'schedule': [
        {'dayOfWeek': 'MONDAY', 'startTime': '07:00'},
      ],
      'createdAt': '2026-01-01T10:00:00.000Z',
      'updatedAt': '2026-01-01T10:00:00.000Z',
      'deletedAt': deletedAt,
    };

GroupClass _c([Map<String, dynamic>? raw]) =>
    GroupClass.fromJson(raw ?? _rawClass());

class _ClassRepo extends Fake implements GroupClassRepository {
  _ClassRepo(this.rows);

  final List<GroupClass> rows;
  final calls = <String>[];
  Map<String, dynamic>? created;
  Map<String, dynamic>? updated;
  List<ScheduleSlot>? savedSlots;

  @override
  Future<List<GroupClass>> listAll({
    bool includeDeleted = true,
    int maxPages = 10,
  }) async =>
      rows;

  @override
  Future<GroupClass> getById(String classId) async =>
      rows.firstWhere((c) => c.id == classId);

  @override
  Future<GroupClass> create({
    required String name,
    required String branchId,
    String? description,
    String? trainerId,
    required int capacity,
    required int durationMinutes,
    bool? isActive,
  }) async {
    created = {
      'name': name,
      'branchId': branchId,
      'description': description,
      'trainerId': trainerId,
      'capacity': capacity,
      'durationMinutes': durationMinutes,
      'isActive': isActive,
    };
    return _c(_rawClass(id: 'new', name: name));
  }

  @override
  Future<GroupClass> update(
    String classId, {
    String? name,
    String? description,
    String? trainerId,
    String? branchId,
    int? capacity,
    int? durationMinutes,
    bool? isActive,
  }) async {
    updated = {
      'name': name,
      'description': description,
      'trainerId': trainerId,
      'branchId': branchId,
      'capacity': capacity,
      'durationMinutes': durationMinutes,
      'isActive': isActive,
    };
    return _c(_rawClass(name: name ?? 'Morning Yoga'));
  }

  @override
  Future<void> setSchedule(String classId, List<ScheduleSlot> slots) async {
    savedSlots = slots;
    calls.add('schedule:$classId:${slots.length}');
  }

  @override
  Future<void> delete(String classId) async => calls.add('delete:$classId');

  @override
  Future<void> restore(String classId) async => calls.add('restore:$classId');
}

String _today() => dateKey(DateTime.now());

Map<String, dynamic> _rawSession({
  String id = 's1',
  String name = 'Morning Yoga',
  int capacity = 10,
  int booked = 3,
  String status = 'SCHEDULED',
}) =>
    {
      'id': id,
      'groupClass': {'id': 'c1', 'name': name},
      'branch': {'id': 'b1', 'name': 'Bandra'},
      'trainer': {'id': 't1', 'name': 'Asha Rao'},
      'sessionDate': _today(),
      'startTime': '23:00',
      'endTime': '23:59',
      'capacity': capacity,
      'bookedCount': booked,
      'status': status,
    };

Map<String, dynamic> _rawBooking(String id, String status, String name) => {
      'id': id,
      'member': {'id': 'm-$id', 'memberId': 'MEM-000$id', 'name': name},
      'status': status,
      'bookedByRole': 'STAFF',
      'bookedAt': '2026-10-18T10:00:00.000Z',
      'cancelledAt': null,
    };

class _SessionRepo extends Fake implements ClassSessionRepository {
  _SessionRepo({this.capacity = 10, this.booked = 3});

  final int capacity;
  final int booked;
  final calls = <String>[];
  final listRanges = <String>[];

  @override
  Future<List<ClassSession>> list({
    required DateTime dateFrom,
    required DateTime dateTo,
  }) async {
    listRanges.add('${dateKey(dateFrom)}..${dateKey(dateTo)}');
    return [
      ClassSession.fromJson(
        _rawSession(capacity: capacity, booked: booked),
      ),
    ];
  }

  @override
  Future<ClassSessionDetail> getById(String sessionId) async =>
      ClassSessionDetail.fromJson({
        ..._rawSession(capacity: capacity, booked: booked),
        'bookings': [
          _rawBooking('1', 'BOOKED', 'Riya Shah'),
          _rawBooking('2', 'CANCELLED', 'Gone Member'),
        ],
      });

  @override
  Future<void> book({
    required String sessionId,
    required String memberId,
  }) async =>
      calls.add('book:$sessionId:$memberId');

  @override
  Future<void> cancelBooking(String bookingId) async =>
      calls.add('cancel:$bookingId');

  @override
  Future<int> generate({int? daysAhead}) async {
    calls.add('generate');
    return 4;
  }
}

class _BranchRepo extends Fake implements BranchRepository {
  @override
  Future<List<BranchOption>> assignable() async => const [
        BranchOption(id: 'b1', name: 'Bandra'),
        BranchOption(id: 'b2', name: 'Andheri'),
      ];
}

class _MemberRepo extends Fake implements MemberRepository {
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
  }) async {
    final m = GymMember.fromJson({
      'id': 'mem-1',
      'memberId': 'MEM-0001',
      'firstName': 'Riya',
      'lastName': 'Shah',
      'name': 'Riya Shah',
      'status': 'ACTIVE',
      'branch': {'id': 'b1', 'name': 'Bandra'},
      'joiningDate': '2026-01-01T00:00:00.000Z',
      'createdAt': '2026-01-01T00:00:00.000Z',
    });
    return PaginatedResult(
      items: [m],
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
    );
  }
}

class _PortalRepo extends Fake implements MemberPortalRepository {
  final calls = <String>[];
  var booked = false;

  @override
  Future<List<ClassSession>> classes({
    required DateTime dateFrom,
    required DateTime dateTo,
  }) async =>
      [
        ClassSession.fromJson(_rawSession(id: 'p1', name: 'Evening Zumba')),
        ClassSession.fromJson(
          _rawSession(id: 'p2', name: 'Full Boxing', capacity: 5, booked: 5),
        ),
      ];

  @override
  Future<List<MemberBooking>> myBookings() async => [
        MemberBooking.fromJson({
          'id': 'bk1',
          'status': 'BOOKED',
          'bookedAt': '2026-10-18T10:00:00.000Z',
          'session': {
            'id': 'p1',
            'groupClass': {'id': 'c1', 'name': 'Evening Zumba'},
            'branch': {'id': 'b1', 'name': 'Bandra'},
            'sessionDate': _today(),
            'startTime': '23:00',
            'endTime': '23:59',
          },
        }),
      ];

  @override
  Future<void> bookClass(String sessionId) async =>
      calls.add('book:$sessionId');

  @override
  Future<void> cancelBooking(String bookingId) async =>
      calls.add('cancel:$bookingId');
}

const _tenant = TenantBranding(
  slug: 't',
  name: 'T',
  status: 'ACTIVE',
  maintenanceMode: false,
  primaryColor: '',
);

const _all = [
  'classes:view',
  'classes:create',
  'classes:update',
  'classes:delete',
  'classes:restore',
  'bookings:manage',
];

late _ClassRepo _classRepo;
late _SessionRepo _sessionRepo;
late _PortalRepo _portalRepo;

// Looping hero animations: pump fixed time instead of pumpAndSettle.
Future<void> settle(WidgetTester t) async {
  await t.pump();
  await t.pump(const Duration(seconds: 3));
}

Future<void> step(WidgetTester t) async {
  await t.pump();
  await t.pump(const Duration(milliseconds: 600));
}

Future<void> scrollTo(WidgetTester t, Finder f) async {
  await t.scrollUntilVisible(
    f,
    300,
    scrollable: find.byType(Scrollable).first,
  );
  await t.pump();
}

/// Scrolls [f] into view then nudges it away from the transparent app bar
/// that overlaps the top of the detail pages.
Future<void> scrollMid(WidgetTester t, Finder f) async {
  await scrollTo(t, f);
  final dy = t.getCenter(f.first).dy;
  if (dy < 200) {
    await t.drag(find.byType(Scrollable).first, const Offset(0, 260));
  } else if (dy > 650) {
    await t.drag(find.byType(Scrollable).first, const Offset(0, -260));
  }
  await t.pump();
}

void main() {
  setUpAll(() => GoogleFonts.config.allowRuntimeFetching = false);

  setUp(() {
    final g = GetIt.instance;
    _classRepo = _ClassRepo([
      _c(),
      _c(_rawClass(id: 'c2', name: 'Evening Zumba', isActive: false)),
      _c(
        _rawClass(
          id: 'c3',
          name: 'Old Boxing',
          deletedAt: '2026-03-01T00:00:00.000Z',
        ),
      ),
    ]);
    _sessionRepo = _SessionRepo();
    _portalRepo = _PortalRepo();
    void reg<T extends Object>(T v) {
      if (g.isRegistered<T>()) g.unregister<T>();
      g.registerSingleton<T>(v);
    }

    reg<GroupClassRepository>(_classRepo);
    reg<ClassSessionRepository>(_sessionRepo);
    reg<BranchRepository>(_BranchRepo());
    reg<MemberRepository>(_MemberRepo());
    reg<MemberPortalRepository>(_portalRepo);
  });

  SessionCubit sessionWith(List<String> perms, {List<String>? roles}) {
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
          roles: roles ?? const ['OWNER'],
          permissions: perms,
        ),
        _tenant,
      ),
    );
    return session;
  }

  // Wider than a phone: flutter_test draws every glyph in the square Ahem
  // font (~2x wider than the real fonts).
  const phone = Size(560, 900);
  const tablet = Size(1500, 1300);

  void setSize(WidgetTester t, Size size) {
    t.view.physicalSize = size * 3;
    t.view.devicePixelRatio = 3;
    addTearDown(t.view.reset);
  }

  Future<void> pumpApp(
    WidgetTester t,
    Widget child, {
    List<String> perms = _all,
    Size size = phone,
  }) async {
    setSize(t, size);
    await t.pumpWidget(
      BlocProvider<SessionCubit>.value(
        value: sessionWith(perms),
        child: MaterialApp(home: child),
      ),
    );
  }

  /// Pushes [screen] on a router so `context.push` / `context.pop` work.
  Future<void> pumpRouted(
    WidgetTester t,
    Widget screen, {
    List<String> perms = _all,
    Size size = phone,
  }) async {
    final router = GoRouter(
      routes: [
        GoRoute(
          path: '/',
          builder: (_, __) => const Scaffold(body: Text('home')),
        ),
        GoRoute(path: '/x', builder: (_, __) => screen),
        GoRoute(
          path: AppRoutes.classSchedule,
          builder: (_, state) => Scaffold(
            body: Text('schedule:${(state.extra as GroupClass).name}'),
          ),
        ),
        GoRoute(
          path: AppRoutes.classSessionDetail,
          builder: (_, state) => Scaffold(body: Text('session:${state.extra}')),
        ),
        GoRoute(
          path: AppRoutes.classesCalendar,
          builder: (_, __) => const Scaffold(body: Text('calendar-route')),
        ),
        GoRoute(
          path: AppRoutes.classForm,
          builder: (_, state) => Scaffold(body: Text('form:${state.extra}')),
        ),
        GoRoute(
          path: AppRoutes.memberClassBooked,
          builder: (_, __) => const Scaffold(body: Text('booked-page')),
        ),
      ],
    );
    setSize(t, size);
    await t.pumpWidget(
      BlocProvider<SessionCubit>.value(
        value: sessionWith(perms),
        child: MaterialApp.router(routerConfig: router),
      ),
    );
    unawaited(router.push('/x'));
    await settle(t);
  }

  testWidgets('list: hero, KPIs, insights and cards render', (t) async {
    await pumpApp(t, const ClassesScreen());
    await settle(t);
    expect(find.text('Classes'), findsOneWidget);
    expect(find.text('Total classes'), findsOneWidget);
    expect(find.text('Total seats / week'), findsOneWidget);
    expect(find.text('Status mix'), findsOneWidget);
    expect(find.text('By branch'), findsOneWidget);
    expect(find.text('By trainer'), findsOneWidget);
    expect(find.byIcon(Icons.add_rounded), findsOneWidget);
    expect(find.byIcon(Icons.calendar_month_rounded), findsWidgets);
    await scrollTo(t, find.byKey(const ValueKey('class-c1')));
    expect(find.byKey(const ValueKey('class-c1')), findsOneWidget);
    expect(t.takeException(), isNull);
  });

  testWidgets('list: status chips filter; Inactive shows the inactive class',
      (t) async {
    await pumpApp(t, const ClassesScreen());
    await settle(t);
    await t.tap(find.text('Inactive · 1'));
    await step(t);
    await scrollTo(t, find.byKey(const ValueKey('class-c2')));
    expect(find.byKey(const ValueKey('class-c2')), findsOneWidget);
    expect(find.byKey(const ValueKey('class-c1')), findsNothing);
    expect(t.takeException(), isNull);
  });

  testWidgets('list: a deleted class opens a restore sheet and restores it',
      (t) async {
    await pumpApp(t, const ClassesScreen());
    await settle(t);
    await scrollTo(t, find.byKey(const ValueKey('class-c3')));
    await t.tap(find.byKey(const ValueKey('class-c3')));
    await step(t);
    expect(find.text('Restore class'), findsOneWidget);
    await t.tap(find.text('Restore class'));
    await step(t);
    await t.tap(find.widgetWithText(TextButton, 'Restore'));
    await step(t);
    expect(_classRepo.calls, ['restore:c3']);
    expect(t.takeException(), isNull);
  });

  testWidgets('list: card menu deletes after a confirmation', (t) async {
    await pumpApp(t, const ClassesScreen());
    await settle(t);
    final menu = find.descendant(
      of: find.byKey(const ValueKey('class-c1')),
      matching: find.byType(PopupMenuButton<String>),
    );
    await scrollTo(t, find.byKey(const ValueKey('class-c1')));
    await t.tap(menu);
    await step(t);
    expect(find.text('View / edit'), findsOneWidget);
    await t.tap(find.text('Delete'));
    await step(t);
    await t.tap(find.widgetWithText(TextButton, 'Delete'));
    await step(t);
    expect(_classRepo.calls, ['delete:c1']);
    expect(t.takeException(), isNull);
  });

  group('gating matrix (catalog)', () {
    testWidgets('view only: no New class, no menus, restore is explained',
        (t) async {
      await pumpApp(t, const ClassesScreen(), perms: const ['classes:view']);
      await settle(t);
      expect(find.byIcon(Icons.add_rounded), findsNothing);
      await scrollTo(t, find.byKey(const ValueKey('class-c3')));
      expect(find.byType(PopupMenuButton<String>), findsNothing);
      await t.tap(find.byKey(const ValueKey('class-c3')));
      await step(t);
      expect(
        find.text('You do not have permission to restore classes.'),
        findsOneWidget,
      );
      expect(find.text('Restore class'), findsNothing);
      expect(t.takeException(), isNull);
    });

    testWidgets('create only: New class shown, still no lifecycle menu',
        (t) async {
      await pumpApp(
        t,
        const ClassesScreen(),
        perms: const ['classes:view', 'classes:create'],
      );
      await settle(t);
      expect(find.byIcon(Icons.add_rounded), findsOneWidget);
      await scrollTo(t, find.byKey(const ValueKey('class-c1')));
      expect(find.byType(PopupMenuButton<String>), findsNothing);
    });

    testWidgets('delete only: live cards get Delete, deleted get no menu',
        (t) async {
      await pumpApp(
        t,
        const ClassesScreen(),
        perms: const ['classes:view', 'classes:delete'],
      );
      await settle(t);
      await scrollTo(t, find.byKey(const ValueKey('class-c1')));
      await t.tap(
        find.descendant(
          of: find.byKey(const ValueKey('class-c1')),
          matching: find.byType(PopupMenuButton<String>),
        ),
      );
      await step(t);
      expect(find.text('Delete'), findsOneWidget);
      expect(find.text('Restore'), findsNothing);
      await t.tapAt(const Offset(5, 5));
      await step(t);
      await scrollTo(t, find.byKey(const ValueKey('class-c3')));
      expect(
        find.descendant(
          of: find.byKey(const ValueKey('class-c3')),
          matching: find.byType(PopupMenuButton<String>),
        ),
        findsNothing,
      );
    });

    testWidgets('restore only: deleted cards get Restore', (t) async {
      await pumpApp(
        t,
        const ClassesScreen(),
        perms: const ['classes:view', 'classes:restore'],
      );
      await settle(t);
      await scrollTo(t, find.byKey(const ValueKey('class-c3')));
      await t.tap(
        find.descendant(
          of: find.byKey(const ValueKey('class-c3')),
          matching: find.byType(PopupMenuButton<String>),
        ),
      );
      await step(t);
      expect(find.text('Restore'), findsOneWidget);
      expect(find.text('Delete'), findsNothing);
    });
  });

  testWidgets('list: opens the calendar and the create form', (t) async {
    await pumpRouted(t, const ClassesScreen());
    await t.tap(find.byIcon(Icons.calendar_month_rounded).first);
    await step(t);
    expect(find.text('calendar-route'), findsOneWidget);
  });

  testWidgets('list: tablet layout renders two columns without overflow',
      (t) async {
    await pumpApp(t, const ClassesScreen(), size: tablet);
    await settle(t);
    await scrollTo(t, find.byKey(const ValueKey('class-c1')));
    // Name order: Evening Zumba (c2) | Morning Yoga (c1) share the first row.
    final a = t.getTopLeft(find.byKey(const ValueKey('class-c2')));
    final b = t.getTopLeft(find.byKey(const ValueKey('class-c1')));
    expect(a.dy, b.dy);
    expect(b.dx, greaterThan(a.dx));
    expect(t.takeException(), isNull);
  });

  testWidgets('detail: editing the name shows Save changes and sends the form',
      (t) async {
    await pumpApp(t, const ClassDetailScreen(classId: 'c1'));
    await settle(t);
    expect(find.text('Morning Yoga'), findsWidgets);
    expect(find.text('Class information'), findsOneWidget);
    expect(find.text('Save changes'), findsNothing);
    await t.enterText(find.byType(TextField).first, 'Sunrise Yoga');
    await step(t);
    expect(find.text('Save changes'), findsOneWidget);
    await t.tap(find.text('Save changes'));
    await step(t);
    expect(_classRepo.updated?['name'], 'Sunrise Yoga');
    expect(_classRepo.updated?['branchId'], 'b1');
    expect(_classRepo.updated?['trainerId'], 't1');
    expect(_classRepo.updated?['capacity'], 15);
    expect(_classRepo.updated?['durationMinutes'], 60);
    expect(_classRepo.updated?['isActive'], isTrue);
    expect(t.takeException(), isNull);
  });

  testWidgets('detail: validation blocks an empty name', (t) async {
    await pumpApp(t, const ClassDetailScreen(classId: 'c1'));
    await settle(t);
    await t.enterText(find.byType(TextField).first, '');
    await step(t);
    await t.tap(find.text('Save changes'));
    await step(t);
    expect(find.text('Class name is required'), findsOneWidget);
    expect(_classRepo.updated, isNull);
  });

  testWidgets('detail: add a slot, save the weekly schedule, regenerate',
      (t) async {
    await pumpApp(t, const ClassDetailScreen(classId: 'c1'));
    await settle(t);
    await scrollTo(t, find.text('Weekly schedule'));
    await scrollMid(t, find.byKey(const ValueKey('schedule-add')));
    // The class already has Monday 7:00 AM: adding it again is refused.
    await t.tap(find.byKey(const ValueKey('schedule-add')));
    await step(t);
    expect(find.textContaining('already in the schedule'), findsOneWidget);
    await t.tap(find.text('Tue'));
    await step(t);
    await t.tap(find.byKey(const ValueKey('schedule-add')));
    await step(t);
    await scrollMid(t, find.text('Save weekly schedule'));
    await t.tap(find.text('Save weekly schedule'));
    await step(t);
    expect(_classRepo.calls, ['schedule:c1:2']);
    expect(_classRepo.savedSlots!.map((s) => s.dayOfWeek).toSet(), {
      WeekDay.monday,
      WeekDay.tuesday,
    });

    await scrollMid(t, find.byKey(const ValueKey('regenerate')));
    await t.tap(find.byKey(const ValueKey('regenerate')));
    await step(t);
    expect(_sessionRepo.calls, ['generate']);
    expect(find.text('4 session(s) generated.'), findsOneWidget);
    expect(t.takeException(), isNull);
  });

  testWidgets('detail: day cards group slots; a new day gets its slot',
      (t) async {
    await pumpApp(t, const ClassDetailScreen(classId: 'c1'));
    await settle(t);
    await scrollMid(t, find.byKey(const ValueKey('schedule-add')));
    expect(find.byKey(const ValueKey('slot-0-07:00')), findsOneWidget);
    await t.tap(find.text('Wed'));
    await t.tap(find.byKey(const ValueKey('schedule-add')));
    await step(t);
    expect(find.byKey(const ValueKey('slot-2-07:00')), findsOneWidget);
    expect(
      find.byKey(const ValueKey('schedule-day-WEDNESDAY')),
      findsOneWidget,
    );
  });

  testWidgets('detail: Delete asks first, deletes and goes back', (t) async {
    await pumpRouted(t, const ClassDetailScreen(classId: 'c1'));
    expect(find.text('Delete'), findsOneWidget);
    await t.tap(find.text('Delete'));
    await step(t);
    await t.tap(find.widgetWithText(TextButton, 'Delete'));
    await step(t);
    expect(_classRepo.calls, ['delete:c1']);
    expect(find.text('home'), findsOneWidget);
  });

  group('gating matrix (detail)', () {
    testWidgets('view only: read-only form, no schedule edit, no actions',
        (t) async {
      await pumpApp(
        t,
        const ClassDetailScreen(classId: 'c1'),
        perms: const ['classes:view'],
      );
      await settle(t);
      await t.enterText(find.byType(TextField).first, 'Hacked');
      await step(t);
      expect(find.text('Save changes'), findsNothing);
      expect(find.text('Hacked'), findsNothing);
      await scrollTo(t, find.text('Weekly schedule'));
      expect(find.text('Save weekly schedule'), findsNothing);
      expect(find.text('Regenerate sessions now'), findsNothing);
      expect(find.byKey(const ValueKey('schedule-add')), findsNothing);
      expect(find.text('Delete'), findsNothing);
      expect(find.text('Restore'), findsNothing);
      expect(t.takeException(), isNull);
    });

    testWidgets('update only: edit + schedule yes, Delete no', (t) async {
      await pumpApp(
        t,
        const ClassDetailScreen(classId: 'c1'),
        perms: const ['classes:view', 'classes:update'],
      );
      await settle(t);
      expect(find.text('Delete'), findsNothing);
      await scrollMid(t, find.text('Save weekly schedule'));
      expect(find.text('Regenerate sessions now'), findsOneWidget);
    });
  });

  testWidgets('create: validates, then creates and lands on the schedule',
      (t) async {
    await pumpRouted(t, const ClassFormScreen());
    expect(find.text('Ready to create'), findsOneWidget);
    expect(find.text('67%'), findsOneWidget); // branch + capacity/duration set
    await t.tap(find.text('Create class'));
    await step(t);
    expect(find.text('Class name is required'), findsOneWidget);
    expect(_classRepo.created, isNull);

    await t.enterText(find.byType(TextField).first, 'Power Pilates');
    await step(t);
    expect(find.text('100%'), findsOneWidget);
    await t.tap(find.text('Create class'));
    await step(t);
    expect(_classRepo.created?['name'], 'Power Pilates');
    expect(_classRepo.created?['branchId'], 'b1');
    expect(_classRepo.created?['capacity'], 15);
    expect(_classRepo.created?['durationMinutes'], 60);
    expect(_classRepo.created?['isActive'], isTrue);
    expect(find.text('schedule:Power Pilates'), findsOneWidget);
  });

  testWidgets('calendar: standalone shows the session and regenerates',
      (t) async {
    await pumpApp(t, const ClassesCalendarScreen(standalone: true));
    await settle(t);
    expect(find.text('Class calendar'), findsOneWidget);
    expect(find.byKey(ValueKey('session-s1')), findsOneWidget);
    expect(find.text('3/10 booked'), findsWidgets);
    expect(find.byIcon(Icons.add_rounded), findsNothing);
    expect(find.byIcon(Icons.arrow_back_rounded), findsOneWidget);
    await t.tap(find.byIcon(Icons.refresh_rounded));
    await step(t);
    expect(_sessionRepo.calls, ['generate']);
    expect(find.text('4 session(s) generated.'), findsOneWidget);
  });

  testWidgets('calendar: week navigation reloads the next week', (t) async {
    await pumpApp(t, const ClassesCalendarScreen(standalone: true));
    await settle(t);
    expect(_sessionRepo.listRanges, hasLength(1));
    await t.tap(find.byTooltip('Next week'));
    await settle(t);
    expect(_sessionRepo.listRanges, hasLength(2));
    final first = _sessionRepo.listRanges[0].split('..').first;
    final second = _sessionRepo.listRanges[1].split('..').first;
    expect(
      parseDay(second).difference(parseDay(first)).inDays,
      7,
    );
    await t.tap(find.text('Today'));
    await settle(t);
    expect(_sessionRepo.listRanges.last.split('..').first, first);
  });

  group('gating matrix (calendar)', () {
    testWidgets('receptionist tab: + shown (as before), no regenerate',
        (t) async {
      await pumpApp(
        t,
        const ClassesCalendarScreen(),
        perms: const ['classes:view', 'bookings:manage'],
      );
      await settle(t);
      expect(find.byIcon(Icons.add_rounded), findsOneWidget);
      expect(find.byIcon(Icons.menu_rounded), findsOneWidget);
      expect(find.byIcon(Icons.refresh_rounded), findsNothing);
    });

    testWidgets('classes:update adds Regenerate', (t) async {
      await pumpApp(
        t,
        const ClassesCalendarScreen(),
        perms: const ['classes:view', 'classes:update'],
      );
      await settle(t);
      expect(find.byIcon(Icons.refresh_rounded), findsOneWidget);
    });
  });

  testWidgets('calendar: opening a session routes to its detail', (t) async {
    await pumpRouted(t, const ClassesCalendarScreen(standalone: true));
    await t.tap(find.byKey(ValueKey('session-s1')));
    await step(t);
    expect(find.text('session:s1'), findsOneWidget);
  });

  testWidgets('calendar: tablet shows the seven-column week grid', (t) async {
    await pumpApp(
      t,
      const ClassesCalendarScreen(standalone: true),
      size: tablet,
    );
    await settle(t);
    final todayKey = _today();
    expect(find.byKey(ValueKey('col-$todayKey')), findsOneWidget);
    expect(find.byKey(ValueKey('session-s1')), findsOneWidget);
    expect(find.byKey(ValueKey('day-$todayKey')), findsNothing);
    expect(t.takeException(), isNull);
  });

  // ── session detail + add attendee ─────────────────────────────────────────

  testWidgets('session: attendees show code + role; cancel needs a confirm',
      (t) async {
    await pumpApp(t, const ClassSessionDetailScreen(sessionId: 's1'));
    await settle(t);
    expect(find.text('Riya Shah'), findsOneWidget);
    expect(find.text('Gone Member'), findsNothing); // cancelled rows hidden
    expect(find.textContaining('MEM-0001'), findsOneWidget);
    expect(find.text('Book a member in'), findsOneWidget);
    await t.tap(find.byTooltip("Cancel Riya Shah's booking"));
    await step(t);
    await t.tap(find.widgetWithText(TextButton, 'Cancel booking'));
    await step(t);
    expect(_sessionRepo.calls, ['cancel:1']);
    expect(t.takeException(), isNull);
  });

  group('gating matrix (session)', () {
    testWidgets('without bookings:manage: read-only', (t) async {
      await pumpApp(
        t,
        const ClassSessionDetailScreen(sessionId: 's1'),
        perms: const ['classes:view'],
      );
      await settle(t);
      expect(find.text('Riya Shah'), findsOneWidget);
      expect(find.text('Book a member in'), findsNothing);
      expect(find.byTooltip("Cancel Riya Shah's booking"), findsNothing);
    });

    testWidgets('a full session cannot take another booking', (t) async {
      _sessionRepo = _SessionRepo(capacity: 3, booked: 3);
      GetIt.instance.unregister<ClassSessionRepository>();
      GetIt.instance.registerSingleton<ClassSessionRepository>(_sessionRepo);
      await pumpApp(t, const ClassSessionDetailScreen(sessionId: 's1'));
      await settle(t);
      expect(find.text('Book a member in'), findsNothing);
      expect(find.byTooltip("Cancel Riya Shah's booking"), findsOneWidget);
    });
  });

  testWidgets('add attendee: search, pick, confirm, book', (t) async {
    final session = ClassSession.fromJson(_rawSession());
    await pumpRouted(t, ClassAddAttendeeScreen(session: session));
    await t.enterText(find.byType(TextField), 'riya');
    await t.pump(const Duration(milliseconds: 500));
    await step(t);
    await t.tap(find.byKey(const ValueKey('member-mem-1')));
    await step(t);
    expect(find.text('Book Riya Shah in?'), findsOneWidget);
    await t.tap(find.widgetWithText(TextButton, 'Confirm booking'));
    await step(t);
    expect(_sessionRepo.calls, ['book:s1:mem-1']);
  });

  testWidgets('member: hero shows the next booking; book + cancel work',
      (t) async {
    await pumpRouted(t, const MemberClassesScreen());
    expect(find.text('Evening Zumba'), findsWidgets);
    expect(find.text('This week'), findsOneWidget);
    expect(find.text('Upcoming'), findsOneWidget);
    expect(find.text('Attended'), findsOneWidget);
    expect(find.textContaining('Starts in'), findsOneWidget);
    expect(find.text('Full'), findsWidgets);
    expect(find.text('Cancel booking'), findsOneWidget);
    expect(find.text('Book this class'), findsNothing); // full + booked

    await t.tap(find.text('Cancel booking'));
    await step(t);
    expect(find.text('Cancel this booking?'), findsOneWidget);
    await t.tap(find.text('Cancel booking').last);
    await step(t);
    expect(_portalRepo.calls, ['cancel:bk1']);
    expect(t.takeException(), isNull);
  });

  testWidgets('member: tablet layout renders without overflow', (t) async {
    await pumpRouted(t, const MemberClassesScreen(), size: tablet);
    expect(find.text('Evening Zumba'), findsWidgets);
    expect(find.text('My bookings'), findsOneWidget);
    expect(t.takeException(), isNull);
  });
}
