import 'package:bloc_test/bloc_test.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:get_it/get_it.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:gym_saas_mobile/bloc/session/session_cubit.dart';
import 'package:gym_saas_mobile/bloc/session/session_state.dart';
import 'package:gym_saas_mobile/features/attendance/presentation/attendance_history_screen.dart';
import 'package:gym_saas_mobile/features/attendance/presentation/attendance_today_screen.dart';
import 'package:gym_saas_mobile/features/receptionist/presentation/check_in_screen.dart';
import 'package:gym_saas_mobile/features/team/presentation/widgets/team_ui.dart';
import 'package:gym_saas_mobile/features/receptionist/presentation/checked_in_screen.dart';
import 'package:gym_saas_mobile/features/receptionist/presentation/search_members_screen.dart';
import 'package:gym_saas_mobile/models/attendance_summary.dart';
import 'package:gym_saas_mobile/models/branch_option.dart';
import 'package:gym_saas_mobile/models/gym_member.dart';
import 'package:gym_saas_mobile/models/paginated_result.dart';
import 'package:gym_saas_mobile/models/qr_validation_result.dart';
import 'package:gym_saas_mobile/models/staff_member.dart';
import 'package:gym_saas_mobile/models/tenant_branding.dart';
import 'package:gym_saas_mobile/models/user_profile.dart';
import 'package:gym_saas_mobile/repositories/attendance_repository.dart';
import 'package:gym_saas_mobile/repositories/branch_repository.dart';
import 'package:gym_saas_mobile/repositories/member_repository.dart';
import 'package:gym_saas_mobile/repositories/staff_repository.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:mocktail/mocktail.dart';

class _MockSession extends MockCubit<SessionState> implements SessionCubit {}

String _iso(DateTime d) => d.toUtc().toIso8601String();

Map<String, dynamic> _rec(
  String id,
  String name, {
  DateTime? checkIn,
  DateTime? checkOut,
  String method = 'QR_CODE',
}) {
  final inAt = checkIn ?? DateTime.now().subtract(const Duration(minutes: 40));
  return {
    'id': id,
    'member': {
      'id': 'm-$id',
      'memberId': 'MEM-$id',
      'name': name,
      'profilePhotoUrl': null,
    },
    'branch': {'id': 'b1', 'name': 'Bandra'},
    'checkInTime': _iso(inAt),
    'checkOutTime': checkOut == null ? null : _iso(checkOut),
    'attendanceDate': '2026-10-17',
    'method': method,
    'deviceName': null,
    'deviceId': null,
    'status': checkOut == null ? 'CHECKED_IN' : 'CHECKED_OUT',
    'notes': null,
    'checkedInBy': null,
    'checkedOutBy': null,
    'createdAt': _iso(inAt),
    'updatedAt': _iso(inAt),
    'deletedAt': null,
  };
}

class _AttRepo extends Fake implements AttendanceRepository {
  final calls = <String>[];
  String? lastSummaryBranch = 'unset';
  String? lastTodayBranch = 'unset';
  Map<String, Object?> lastList = {};
  QrValidationResult? qr;

  List<AttendanceRecord> records() {
    final now = DateTime.now();
    return [
      AttendanceRecord.fromJson(_rec('1', 'Asha Rao')),
      AttendanceRecord.fromJson(
        _rec(
          '2',
          'Vikram Shah',
          checkIn: now.subtract(const Duration(hours: 3)),
          checkOut: now.subtract(const Duration(hours: 2)),
          method: 'MANUAL',
        ),
      ),
    ];
  }

  @override
  Future<AttendanceSummary> summary({
    String? branchId,
    DateTime? dateFrom,
    DateTime? dateTo,
  }) async {
    lastSummaryBranch = branchId;
    return AttendanceSummary.fromJson({
      'totalCheckInsToday': 2,
      'totalCheckOutsToday': 1,
      'currentlyInside': 1,
      'peakCheckInHour': 18,
      'trend': [
        for (var i = 0; i < 30; i++)
          {
            'date': DateTime.now()
                .subtract(Duration(days: 29 - i))
                .toIso8601String()
                .substring(0, 10),
            'count': (i * 3) % 7,
          },
      ],
    });
  }

  @override
  Future<List<AttendanceRecord>> today({String? branchId}) async {
    lastTodayBranch = branchId;
    return records();
  }

  @override
  Future<PaginatedResult<AttendanceRecord>> list({
    int page = 1,
    int limit = 20,
    String? search,
    String? branchId,
    String? status,
    String? method,
    DateTime? dateFrom,
    DateTime? dateTo,
    String sortBy = 'checkInTime',
    String sortDir = 'desc',
  }) async {
    lastList = {
      'page': page,
      'search': search,
      'branchId': branchId,
      'status': status,
      'method': method,
      'dateFrom': dateFrom,
      'sortDir': sortDir,
    };
    final items = records();
    return PaginatedResult(
      items: items,
      total: items.length,
      page: 1,
      limit: 20,
      totalPages: 1,
    );
  }

  @override
  Future<void> manualCheckOut({
    required String memberId,
    String? attendanceId,
  }) async =>
      calls.add('manualCheckOut:$memberId:$attendanceId');

  @override
  Future<void> manualCheckIn({
    required String memberId,
    String? branchId,
  }) async =>
      calls.add('manualCheckIn:$memberId');

  @override
  Future<void> checkIn({required String memberId, String? branchId}) async =>
      calls.add('checkIn:$memberId');

  @override
  Future<void> checkOut({String? memberId, String? attendanceId}) async =>
      calls.add('checkOut:$memberId');

  @override
  Future<QrValidationResult> validateQr(String qrCodeToken) async => qr!;

  @override
  Future<void> update(String id, Map<String, dynamic> body) async =>
      calls.add('update:$id');

  @override
  Future<void> delete(String id) async => calls.add('delete:$id');
}

class _BranchRepo extends Fake implements BranchRepository {
  @override
  Future<List<BranchOption>> assignable() async => const [
        BranchOption(id: 'b1', name: 'Bandra'),
        BranchOption(id: 'b2', name: 'Andheri'),
      ];
}

class _StaffRepo extends Fake implements StaffRepository {
  @override
  Future<StaffMember> getById(String staffId) async => StaffMember.fromJson({
        'id': staffId,
        'primaryBranch': {
          'branchId': 'b-own',
          'branchName': 'Own Branch',
          'isPrimary': true,
        },
      });
}

GymMember _member(String id, String name, String status, {bool plan = true}) =>
    GymMember.fromJson({
      'id': id,
      'memberId': 'MEM-$id',
      'firstName': name,
      'lastName': 'X',
      'name': '$name X',
      'status': status,
      'branch': {'id': 'b1', 'name': 'Bandra'},
      'joiningDate': '2026-01-01',
      'createdAt': '2026-01-01T00:00:00.000Z',
      'currentMembership': plan
          ? {
              'planId': 'p',
              'planName': 'Gold',
              'startDate': '2026-01-01',
              'endDate': DateTime.now()
                  .add(const Duration(days: 30))
                  .toIso8601String(),
              'status': 'ACTIVE',
            }
          : null,
    });

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
    final items = [
      _member('1', 'Karan', 'ACTIVE'),
      _member('2', 'Kiran', 'FROZEN'),
    ];
    return PaginatedResult(
      items: items,
      total: items.length,
      page: 1,
      limit: 20,
      totalPages: 1,
    );
  }
}

const _tenant = TenantBranding(
  slug: 't',
  name: 'T',
  status: 'ACTIVE',
  maintenanceMode: false,
  primaryColor: '',
  featureFlags: ['attendance'],
);

const _view = ['attendance:view'];
const _all = [
  'attendance:view',
  'attendance:checkin',
  'attendance:checkout',
  'attendance:update',
  'attendance:delete',
  'members:view',
];

late _AttRepo _att;

void main() {
  setUpAll(() => GoogleFonts.config.allowRuntimeFetching = false);

  setUp(() {
    final g = GetIt.instance;
    _att = _AttRepo();
    void reg<T extends Object>(T v) {
      if (g.isRegistered<T>()) g.unregister<T>();
      g.registerSingleton<T>(v);
    }

    reg<AttendanceRepository>(_att);
    reg<BranchRepository>(_BranchRepo());
    reg<StaffRepository>(_StaffRepo());
    reg<MemberRepository>(_MemberRepo());
  });

  Future<void> pumpApp(
    WidgetTester t,
    Widget child, {
    List<String> perms = _view,
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
          roles: const ['MANAGER'],
          permissions: perms,
        ),
        _tenant,
      ),
    );
    await t.pumpWidget(
      BlocProvider<SessionCubit>.value(
        value: session,
        child: MaterialApp(home: child),
      ),
    );
  }

  Future<void> settle(WidgetTester t) async {
    await t.pump();
    await t.pump(const Duration(seconds: 3));
  }

  Future<void> step(WidgetTester t) async {
    await t.pump();
    await t.pump(const Duration(milliseconds: 600));
  }

  Future<void> scrollTo(WidgetTester t, Finder f) => t.scrollUntilVisible(
        f,
        300,
        scrollable: find.byType(Scrollable).first,
      );

  group('today (pushed dashboard)', () {
    testWidgets('hero, KPIs, insight panels and visit cards render', (t) async {
      await pumpApp(t, const AttendanceTodayScreen());
      await settle(t);
      expect(find.text('Attendance'), findsOneWidget);
      expect(find.text('Today · All branches'), findsOneWidget);
      expect(find.text('1 inside now'), findsOneWidget);
      expect(find.text('Check-ins today'), findsOneWidget);
      expect(find.text('Peak check-in time'), findsOneWidget);
      expect(find.text('Attendance trend'), findsOneWidget);
      expect(find.text('This week vs last week'), findsOneWidget);
      await scrollTo(t, find.text("Today's activity"));
      await scrollTo(t, find.byKey(const ValueKey('visit-2')));
      expect(find.byKey(const ValueKey('visit-1')), findsOneWidget);
      expect(find.text('Asha Rao'), findsWidgets);
      expect(t.takeException(), isNull);
      // Pushed route: no branch scoping, 30-day trend requested.
      expect(_att.lastSummaryBranch, isNull);
      expect(_att.lastTodayBranch, isNull);
    });

    testWidgets(
        'History and Check in / out stay visible with only attendance:view '
        '(unchanged gating)', (t) async {
      await pumpApp(t, const AttendanceTodayScreen());
      await settle(t);
      expect(find.byIcon(Icons.history_rounded), findsOneWidget);
      expect(find.byIcon(Icons.qr_code_scanner_rounded), findsWidgets);
      expect(find.text('Check in / out a member'), findsOneWidget);
    });

    testWidgets('Check out is hidden without attendance:checkout', (t) async {
      await pumpApp(t, const AttendanceTodayScreen(), perms: _view);
      await settle(t);
      await scrollTo(t, find.byKey(const ValueKey('visit-1')));
      expect(find.text('Check out'), findsNothing);
    });

    testWidgets('quick Check out calls the API when permitted', (t) async {
      await pumpApp(
        t,
        const AttendanceTodayScreen(),
        perms: const ['attendance:view', 'attendance:checkout'],
      );
      await settle(t);
      await scrollTo(t, find.byKey(const ValueKey('visit-1')));
      await t.ensureVisible(find.text('Check out'));
      await t.tap(find.text('Check out'));
      await step(t);
      expect(_att.calls, ['manualCheckOut:m-1:1']);
    });

    testWidgets('detail sheet: Edit / Delete follow update / delete perms',
        (t) async {
      await pumpApp(t, const AttendanceTodayScreen(), perms: _view);
      await settle(t);
      await scrollTo(t, find.byKey(const ValueKey('visit-1')));
      await t.tap(find.byKey(const ValueKey('visit-1')));
      await step(t);
      expect(find.textContaining('Inside for'), findsOneWidget);
      expect(find.text('Edit'), findsNothing);
      expect(find.text('Delete'), findsNothing);
      expect(find.text('View member'), findsNothing);
      expect(find.text('Check out'), findsNothing);
    });

    testWidgets('detail sheet shows every action with full permissions',
        (t) async {
      await pumpApp(t, const AttendanceTodayScreen(), perms: _all);
      await settle(t);
      await scrollTo(t, find.byKey(const ValueKey('visit-1')));
      await t.tap(find.byKey(const ValueKey('visit-1')).first);
      await step(t);
      expect(find.text('Edit'), findsOneWidget);
      expect(find.text('Delete'), findsOneWidget);
      expect(find.text('View member'), findsOneWidget);
      expect(find.text('Check out'), findsWidgets);
      await t.tap(find.text('Edit'));
      await step(t);
      expect(find.text('Save changes'), findsOneWidget);
      expect(find.text('Check-out time'), findsOneWidget);
      expect(t.takeException(), isNull);
    });

    testWidgets('KPI tile opens its sheet; status chip filters the list',
        (t) async {
      await pumpApp(
        t,
        const AttendanceTodayScreen(),
        size: const Size(560, 2200),
      );
      await settle(t);
      await t.tap(find.text('Currently inside'));
      await step(t);
      expect(find.text('1 visit'), findsOneWidget);
      Navigator.of(t.element(find.byType(TeamSheetScaffold))).pop();
      await step(t);
      final chip = find.widgetWithText(TeamFilterChip, 'Checked out · 1');
      await t.tap(chip);
      await step(t);
      await scrollTo(t, find.byKey(const ValueKey('visit-2')));
      expect(find.byKey(const ValueKey('visit-1')), findsNothing);
      expect(find.byKey(const ValueKey('visit-2')), findsOneWidget);
      expect(t.takeException(), isNull);
    });

    testWidgets('branch picker re-queries with the chosen branch', (t) async {
      await pumpApp(t, const AttendanceTodayScreen());
      await settle(t);
      await t.tap(find.text('All branches').first);
      await step(t);
      await t.tap(find.text('Andheri'));
      await step(t);
      await settle(t);
      expect(_att.lastSummaryBranch, 'b2');
      expect(_att.lastTodayBranch, 'b2');
    });

    testWidgets('tablet: renders without overflow, two-up cards', (t) async {
      await pumpApp(
        t,
        const AttendanceTodayScreen(),
        perms: _all,
        size: const Size(1500, 1300),
      );
      await settle(t);
      await scrollTo(t, find.byKey(const ValueKey('visit-2')));
      final a = t.getTopLeft(find.byKey(const ValueKey('visit-1')));
      final b = t.getTopLeft(find.byKey(const ValueKey('visit-2')));
      expect(a.dy, b.dy);
      expect(t.takeException(), isNull);
    });
  });

  group('today (Manager tab)', () {
    testWidgets('is scoped to the own primary branch via /staff/:id',
        (t) async {
      await pumpApp(
        t,
        const Scaffold(body: AttendanceTodayScreen(asTab: true)),
      );
      await settle(t);
      expect(_att.lastSummaryBranch, 'b-own');
      expect(_att.lastTodayBranch, 'b-own');
      expect(find.text('Today · Own Branch'), findsOneWidget);
      // No branch picker on the tab.
      expect(find.text('All branches'), findsNothing);
      expect(t.takeException(), isNull);
    });

    testWidgets('History / Check in shortcuts follow flag + permissions',
        (t) async {
      await pumpApp(
        t,
        const Scaffold(body: AttendanceTodayScreen(asTab: true)),
      );
      await settle(t);
      // attendance:view + flag -> History; no attendance:checkin -> no scan.
      expect(find.byIcon(Icons.history_rounded), findsOneWidget);
      expect(find.byIcon(Icons.qr_code_scanner_rounded), findsNothing);
      expect(find.text('Check in / out a member'), findsNothing);
    });

    testWidgets('with attendance:checkin the Check in shortcut appears',
        (t) async {
      await pumpApp(
        t,
        const Scaffold(body: AttendanceTodayScreen(asTab: true)),
        perms: const ['attendance:view', 'attendance:checkin'],
      );
      await settle(t);
      expect(find.byIcon(Icons.qr_code_scanner_rounded), findsWidgets);
      expect(find.text('Check in / out a member'), findsOneWidget);
    });
  });

  group('history', () {
    testWidgets('hero, glance, filters and day-grouped cards render',
        (t) async {
      await pumpApp(t, const AttendanceHistoryScreen());
      await settle(t);
      expect(find.text('Attendance History'), findsOneWidget);
      expect(find.text('1 inside now'), findsOneWidget);
      expect(find.textContaining('2 visits'), findsWidgets);
      expect(find.text('Newest check-in first'), findsOneWidget);
      await scrollTo(t, find.byKey(const ValueKey('visit-1')));
      expect(find.byKey(const ValueKey('visit-1')), findsOneWidget);
      // Default query = last 30 days, tenant-wide, newest first.
      expect(_att.lastList['branchId'], isNull);
      expect(_att.lastList['status'], isNull);
      expect(_att.lastList['dateFrom'], isNotNull);
      expect(_att.lastList['sortDir'], 'desc');
      expect(t.takeException(), isNull);
    });

    testWidgets('status / method chips go to the API as UPPER_SNAKE enums',
        (t) async {
      await pumpApp(t, const AttendanceHistoryScreen());
      await settle(t);
      final inside = find.widgetWithText(TeamFilterChip, 'Inside');
      await t.ensureVisible(inside);
      await t.tap(inside);
      await step(t);
      expect(_att.lastList['status'], 'CHECKED_IN');
      final face = find.widgetWithText(TeamFilterChip, 'Face recognition');
      await t.ensureVisible(face);
      await t.tap(face);
      await step(t);
      expect(_att.lastList['method'], 'FACE_RECOGNITION');
      final all = find.widgetWithText(TeamFilterChip, 'All time');
      await t.ensureVisible(all);
      await t.tap(all);
      await step(t);
      expect(_att.lastList['dateFrom'], isNull);
      expect(t.takeException(), isNull);
    });

    testWidgets('detail: Edit / Delete only for update / delete holders',
        (t) async {
      await pumpApp(t, const AttendanceHistoryScreen(), perms: _view);
      await settle(t);
      await scrollTo(t, find.byKey(const ValueKey('visit-1')));
      await t.tap(find.byKey(const ValueKey('visit-1')));
      await step(t);
      expect(find.text('Edit'), findsNothing);
      expect(find.text('Delete'), findsNothing);
    });

    testWidgets('delete asks to confirm then calls the API', (t) async {
      await pumpApp(
        t,
        const AttendanceHistoryScreen(),
        perms: const ['attendance:view', 'attendance:delete'],
      );
      await settle(t);
      await scrollTo(t, find.byKey(const ValueKey('visit-1')));
      await t.tap(find.byKey(const ValueKey('visit-1')));
      await step(t);
      expect(find.text('Edit'), findsNothing);
      await t.tap(find.text('Delete'));
      await step(t);
      expect(find.text('Delete this visit?'), findsOneWidget);
      await t.tap(find.text('Delete').last);
      await step(t);
      expect(_att.calls, ['delete:1']);
    });

    testWidgets('tablet: renders without overflow', (t) async {
      await pumpApp(
        t,
        const AttendanceHistoryScreen(),
        perms: _all,
        size: const Size(1500, 1300),
      );
      await settle(t);
      expect(find.byKey(const ValueKey('visit-1')), findsOneWidget);
      expect(t.takeException(), isNull);
    });
  });

  group('check-in flow', () {
    testWidgets('search: cards show eligibility; check in / out call the API',
        (t) async {
      await pumpApp(t, const SearchMembersScreen());
      await t.pump();
      await t.enterText(find.byType(TextField), 'ka');
      await t.pump(const Duration(milliseconds: 500));
      await t.pump(const Duration(seconds: 2));
      expect(find.text('Karan X'), findsOneWidget);
      expect(find.text('Eligible'), findsOneWidget);
      expect(
        find.text('Member is frozen and cannot check in.'),
        findsOneWidget,
      );
      await t.tap(find.text('Check out').first);
      await step(t);
      expect(_att.calls, ['manualCheckOut:1:null']);
      expect(t.takeException(), isNull);
    });

    testWidgets('scan: valid member can be checked in', (t) async {
      _att.qr = QrValidationResult.fromJson({
        'valid': true,
        'reason': null,
        'alreadyCheckedIn': false,
        'member': {
          'id': 'm9',
          'memberId': 'MEM-9',
          'name': 'Scan Person',
          'status': 'ACTIVE',
        },
      });
      void Function(BarcodeCapture)? detect;
      await pumpApp(
        t,
        CheckInScreen(
          scannerBuilder: (context, onDetect) {
            detect = onDetect;
            return const SizedBox.expand();
          },
        ),
      );
      await settle(t);
      expect(find.text('Search manually'), findsOneWidget);
      detect!(
        const BarcodeCapture(
          barcodes: [Barcode(rawValue: 'fitcloud-member:t:tok')],
        ),
      );
      await step(t);
      expect(find.text('Scan Person'), findsOneWidget);
      expect(find.text('Eligible'), findsOneWidget);
      expect(find.text('Check in'), findsWidgets);
      expect(find.text('Check out'), findsNothing);
      expect(t.takeException(), isNull);
    });

    testWidgets('scan: member already inside gets a Check out', (t) async {
      _att.qr = QrValidationResult.fromJson({
        'valid': false,
        'reason': 'Member is already checked in.',
        'alreadyCheckedIn': true,
        'member': {
          'id': 'm9',
          'memberId': 'MEM-9',
          'name': 'Scan Person',
          'status': 'ACTIVE',
        },
      });
      void Function(BarcodeCapture)? detect;
      await pumpApp(
        t,
        CheckInScreen(
          scannerBuilder: (context, onDetect) {
            detect = onDetect;
            return const SizedBox.expand();
          },
        ),
      );
      await settle(t);
      detect!(
        const BarcodeCapture(
          barcodes: [Barcode(rawValue: 'fitcloud-member:t:tok')],
        ),
      );
      await step(t);
      await t.tap(find.text('Check out'));
      await step(t);
      expect(_att.calls, ['checkOut:m9']);
      expect(find.text('This session'), findsOneWidget);
      expect(t.takeException(), isNull);
    });

    testWidgets('checked-in confirmation renders', (t) async {
      await pumpApp(t, const CheckedInScreen(memberName: 'Asha Rao'));
      await settle(t);
      expect(find.text('Checked in'), findsOneWidget);
      expect(find.text('Asha Rao'), findsOneWidget);
      expect(find.text('Scan next'), findsOneWidget);
      expect(t.takeException(), isNull);
    });
  });
}
