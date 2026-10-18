import 'dart:async';
import 'dart:typed_data';

import 'package:bloc_test/bloc_test.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:get_it/get_it.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:gym_saas_mobile/bloc/session/session_cubit.dart';
import 'package:gym_saas_mobile/bloc/session/session_state.dart';
import 'package:gym_saas_mobile/core/export/export_sink.dart';
import 'package:gym_saas_mobile/core/network/api_exception.dart';
import 'package:gym_saas_mobile/features/reports/presentation/analytics/analytics_logic.dart';
import 'package:gym_saas_mobile/features/reports/presentation/analytics_screen.dart';
import 'package:gym_saas_mobile/features/reports/presentation/attendance_report_screen.dart';
import 'package:gym_saas_mobile/features/reports/presentation/branch_performance_screen.dart';
import 'package:gym_saas_mobile/features/reports/presentation/churn_report_screen.dart';
import 'package:gym_saas_mobile/features/reports/presentation/expense_report_screen.dart';
import 'package:gym_saas_mobile/features/reports/presentation/expiring_memberships_screen.dart';
import 'package:gym_saas_mobile/features/reports/presentation/kit/kit.dart';
import 'package:gym_saas_mobile/features/reports/presentation/member_progress_report_screen.dart';
import 'package:gym_saas_mobile/features/reports/presentation/membership_report_screen.dart';
import 'package:gym_saas_mobile/features/reports/presentation/payment_report_screen.dart';
import 'package:gym_saas_mobile/features/reports/presentation/revenue_report_screen.dart';
import 'package:gym_saas_mobile/features/reports/presentation/staff_performance_screen.dart';
import 'package:gym_saas_mobile/features/reports/presentation/staff_report_screen.dart';
import 'package:gym_saas_mobile/features/team/presentation/widgets/team_ui.dart';
import 'package:gym_saas_mobile/models/active_vs_inactive_row.dart';
import 'package:gym_saas_mobile/models/attendance_report_row.dart';
import 'package:gym_saas_mobile/models/branch_comparison_row.dart';
import 'package:gym_saas_mobile/models/branch_option.dart';
import 'package:gym_saas_mobile/models/branch_performance_row.dart';
import 'package:gym_saas_mobile/models/expense_report_row.dart';
import 'package:gym_saas_mobile/models/expiring_membership_row.dart';
import 'package:gym_saas_mobile/models/member_progress_row.dart';
import 'package:gym_saas_mobile/models/member_payment.dart'
    show paymentStatusLabel;
import 'package:gym_saas_mobile/models/membership_plan.dart';
import 'package:gym_saas_mobile/models/membership_report_row.dart';
import 'package:gym_saas_mobile/models/paginated_result.dart';
import 'package:gym_saas_mobile/models/payment_report_row.dart';
import 'package:gym_saas_mobile/models/report_export.dart';
import 'package:gym_saas_mobile/models/report_summary.dart';
import 'package:gym_saas_mobile/models/revenue_report_row.dart';
import 'package:gym_saas_mobile/models/revenue_trend_point.dart';
import 'package:gym_saas_mobile/models/staff_report_row.dart';
import 'package:gym_saas_mobile/models/tenant_branding.dart';
import 'package:gym_saas_mobile/models/trainer_performance_row.dart';
import 'package:gym_saas_mobile/models/trend_point.dart';
import 'package:gym_saas_mobile/models/user_profile.dart';
import 'package:gym_saas_mobile/repositories/analytics_repository.dart';
import 'package:gym_saas_mobile/repositories/branch_repository.dart';
import 'package:gym_saas_mobile/repositories/membership_plan_repository.dart';
import 'package:gym_saas_mobile/repositories/reports_repository.dart';
import 'package:mocktail/mocktail.dart';

class _Reports extends Mock implements ReportsRepository {}

class _Analytics extends Mock implements AnalyticsRepository {}

class _Branches extends Mock implements BranchRepository {}

class _Plans extends Mock implements MembershipPlanRepository {}

class _Session extends MockCubit<SessionState> implements SessionCubit {}

/// Stands in for the share sheet / print dialog: records what it was given.
class _Sink implements ExportSink {
  final shared = <ReportExportFile>[];
  final printed = <ReportExportFile>[];
  String? jobName;
  Rect? origin;

  /// What the user "did": false = closed the share sheet / cancelled print.
  bool completes = true;

  @override
  Future<bool> share(ReportExportFile file, {Rect? origin}) async {
    shared.add(file);
    this.origin = origin;
    return completes;
  }

  @override
  Future<bool> printPdf(
    ReportExportFile file, {
    required String jobName,
  }) async {
    printed.add(file);
    this.jobName = jobName;
    return completes;
  }
}

const _tenant = TenantBranding(
  slug: 't',
  name: 'T',
  status: 'ACTIVE',
  maintenanceMode: false,
  primaryColor: '',
);

UserProfile _user(List<String> perms) => UserProfile(
      id: 'u',
      tenantId: 't',
      name: 'U',
      email: 'u@x.test',
      phone: null,
      status: 'ACTIVE',
      roles: const ['OWNER'],
      permissions: perms,
    );

PaginatedResult<T> _paged<T>(List<T> items) => PaginatedResult(
      items: items,
      total: items.length,
      page: 1,
      limit: 20,
      totalPages: 1,
    );

ReportExportFile _file(ReportExportFormat f, [String name = 'report']) =>
    ReportExportFile(
      bytes: Uint8List.fromList([1, 2, 3]),
      filename: '$name-2026-10-18.${f.extension}',
      format: f,
    );

const _export = ['reports:export'];

void main() {
  setUpAll(() {
    GoogleFonts.config.allowRuntimeFetching = false;
    registerFallbackValue(const ReportSummaryFilters());
    registerFallbackValue(ReportExportFormat.pdf);
    registerFallbackValue(DateTime(2026));
  });

  late _Reports reports;
  late _Analytics analytics;
  late _Branches branches;
  late _Plans plans;
  late _Sink sink;

  setUp(() {
    reports = _Reports();
    analytics = _Analytics();
    branches = _Branches();
    plans = _Plans();
    sink = _Sink();
    final g = GetIt.instance;
    void reg<T extends Object>(T v) {
      if (g.isRegistered<T>()) g.unregister<T>();
      g.registerSingleton<T>(v);
    }

    reg<ReportsRepository>(reports);
    reg<AnalyticsRepository>(analytics);
    reg<BranchRepository>(branches);
    reg<MembershipPlanRepository>(plans);
    reg<ExportSink>(sink);

    when(() => reports.summary(any(), any())).thenAnswer(
      (_) async => ReportSummary.fromJson({
        'kpis': <Object>[],
        'breakdowns': <Object>[],
        'series': null,
      }),
    );
    when(() => reports.exportReport(any(), any(), any())).thenAnswer(
      (inv) async => _file(
        inv.positionalArguments[1] as ReportExportFormat,
        inv.positionalArguments[0] as String,
      ),
    );
    when(() => branches.assignable()).thenAnswer(
      (_) async => [const BranchOption(id: 'b1', name: 'Main Branch')],
    );
    when(
      () => plans.list(
        limit: any(named: 'limit'),
        sortBy: any(named: 'sortBy'),
        sortDir: any(named: 'sortDir'),
      ),
    ).thenAnswer(
      (_) async => PaginatedResult(
        items: [
          MembershipPlan.fromJson({
            'id': 'p1',
            'name': 'Gold',
            'price': '1000',
            'durationType': 'MONTHS',
            'durationValue': 1,
          }),
        ],
        total: 1,
        page: 1,
        limit: 100,
        totalPages: 1,
      ),
    );
    // Row lists: empty is enough, the header + export controls still render.
    when(
      () => reports.membership(
        branchId: any(named: 'branchId'),
        memberStatus: any(named: 'memberStatus'),
        planId: any(named: 'planId'),
        page: any(named: 'page'),
        limit: any(named: 'limit'),
      ),
    ).thenAnswer((_) async => _paged<MembershipReportRow>([]));
    when(
      () => reports.attendance(
        from: any(named: 'from'),
        to: any(named: 'to'),
        branchId: any(named: 'branchId'),
        page: any(named: 'page'),
        limit: any(named: 'limit'),
      ),
    ).thenAnswer((_) async => _paged<AttendanceReportRow>([]));
    when(() => reports.activeVsInactive(branchId: any(named: 'branchId')))
        .thenAnswer((_) async => <ActiveVsInactiveRow>[]);
    when(
      () => reports.expiringMemberships(
        branchId: any(named: 'branchId'),
        page: any(named: 'page'),
        limit: any(named: 'limit'),
      ),
    ).thenAnswer((_) async => _paged<ExpiringMembershipRow>([]));
    when(
      () => reports.memberProgress(
        branchId: any(named: 'branchId'),
        page: any(named: 'page'),
        limit: any(named: 'limit'),
      ),
    ).thenAnswer((_) async => _paged<MemberProgressRow>([]));
    when(
      () => reports.staff(
        branchId: any(named: 'branchId'),
        page: any(named: 'page'),
        limit: any(named: 'limit'),
      ),
    ).thenAnswer((_) async => _paged<StaffReportRow>([]));
    when(() => reports.trainerPerformance(branchId: any(named: 'branchId')))
        .thenAnswer((_) async => <TrainerPerformanceRow>[]);
    when(
      () => reports.revenue(
        from: any(named: 'from'),
        to: any(named: 'to'),
        branchId: any(named: 'branchId'),
        page: any(named: 'page'),
      ),
    ).thenAnswer(
      (_) async => (page: _paged<RevenueReportRow>([]), totalAmount: 0.0),
    );
    when(
      () => reports.expenses(
        from: any(named: 'from'),
        to: any(named: 'to'),
        branchId: any(named: 'branchId'),
        page: any(named: 'page'),
      ),
    ).thenAnswer(
      (_) async => (page: _paged<ExpenseReportRow>([]), totalAmount: 0.0),
    );
    when(
      () => reports.payments(
        from: any(named: 'from'),
        to: any(named: 'to'),
        branchId: any(named: 'branchId'),
        paymentStatus: any(named: 'paymentStatus'),
        page: any(named: 'page'),
      ),
    ).thenAnswer((_) async => _paged<PaymentReportRow>([]));
    when(() => reports.branchPerformance(branchId: any(named: 'branchId')))
        .thenAnswer((_) async => <BranchPerformanceRow>[]);
    when(
      () => analytics.branchComparison(
        from: any(named: 'from'),
        to: any(named: 'to'),
        branchId: any(named: 'branchId'),
      ),
    ).thenAnswer((_) async => <BranchComparisonRow>[]);
    for (final call in <Future<List<TrendPoint>> Function()>[
      () => analytics.attendanceTrends(
            from: any(named: 'from'),
            to: any(named: 'to'),
            branchId: any(named: 'branchId'),
          ),
      () => analytics.membershipGrowth(
            from: any(named: 'from'),
            to: any(named: 'to'),
            branchId: any(named: 'branchId'),
          ),
      () => analytics.newMemberGrowth(
            from: any(named: 'from'),
            to: any(named: 'to'),
            branchId: any(named: 'branchId'),
          ),
      () => analytics.retention(
            from: any(named: 'from'),
            to: any(named: 'to'),
            branchId: any(named: 'branchId'),
          ),
    ]) {
      when(call).thenAnswer((_) async => <TrendPoint>[]);
    }
    for (final call in <Future<List<RevenueTrendPoint>> Function()>[
      () => analytics.revenueTrends(
            from: any(named: 'from'),
            to: any(named: 'to'),
            branchId: any(named: 'branchId'),
          ),
      () => analytics.paymentCollection(
            from: any(named: 'from'),
            to: any(named: 'to'),
            branchId: any(named: 'branchId'),
          ),
    ]) {
      when(call).thenAnswer((_) async => <RevenueTrendPoint>[]);
    }
  });

  Future<void> settle(WidgetTester t) async {
    // Skeletons loop forever: fixed pumps, never pumpAndSettle.
    await t.pump();
    await t.pump(const Duration(seconds: 3));
  }

  Future<void> pump(
    WidgetTester t,
    Widget screen, {
    List<String> perms = _export,
    Size size = const Size(360, 3200),
  }) async {
    t.view.physicalSize = size * 2;
    t.view.devicePixelRatio = 2;
    addTearDown(t.view.reset);
    final session = _Session();
    when(() => session.state)
        .thenReturn(SessionAuthenticatedStaff(_user(perms), _tenant));
    await t.pumpWidget(
      BlocProvider<SessionCubit>.value(
        value: session,
        child: MaterialApp(home: screen),
      ),
    );
    await settle(t);
  }

  final hero = find.byKey(const Key('rpt-export-hero'));
  final listIcon = find.byKey(const Key('rpt-export-list'));

  Future<void> openSheet(WidgetTester t) async {
    await t.tap(hero);
    await t.pump();
    await t.pump(const Duration(milliseconds: 400));
  }

  Future<void> choose(WidgetTester t, String key) async {
    await t.tap(find.byKey(Key('rpt-export-$key')));
    await t.pump();
    await t.pump(const Duration(milliseconds: 500));
  }

  Widget scaffold({RptExportSpec? spec, Widget? resultsAction}) =>
      RptViewerScaffold<String>(
        title: 'Test Report',
        items: const ['one', 'two'],
        total: 2,
        itemBuilder: (context, item, i) => Text(item),
        exportSpec: spec,
        resultsAction: resultsAction,
      );

  RptExportSpec spec({
    bool enabled = true,
    ReportSummaryFilters? filters,
  }) =>
      RptExportSpec(
        reportType: 'revenue',
        title: 'Revenue Report',
        filters: () => filters ?? const ReportSummaryFilters(branchId: 'b1'),
        enabled: enabled,
      );

  group('permission gating (reports:export, like web)', () {
    testWidgets('hidden without reports:export, even with reports:view',
        (t) async {
      await pump(
        t,
        scaffold(spec: spec()),
        perms: const ['reports:view', 'analytics:view', 'finance:view'],
      );
      expect(hero, findsNothing);
      expect(listIcon, findsNothing);
      expect(find.text('Export'), findsNothing);
    });

    testWidgets('shown with reports:export: hero pill + list-header icon',
        (t) async {
      await pump(t, scaffold(spec: spec()));
      expect(hero, findsOneWidget);
      expect(find.text('Export'), findsOneWidget);
      expect(listIcon, findsOneWidget);
    });

    testWidgets('no spec, no export UI', (t) async {
      await pump(t, scaffold());
      expect(hero, findsNothing);
      expect(listIcon, findsNothing);
    });

    testWidgets('a member session never sees it', (t) async {
      t.view.physicalSize = const Size(720, 2000);
      t.view.devicePixelRatio = 2;
      addTearDown(t.view.reset);
      final session = _Session();
      when(() => session.state).thenReturn(const SessionUnauthenticated());
      await t.pumpWidget(
        BlocProvider<SessionCubit>.value(
          value: session,
          child: MaterialApp(home: scaffold(spec: spec())),
        ),
      );
      await settle(t);
      expect(hero, findsNothing);
      expect(listIcon, findsNothing);
    });

    testWidgets('the list icon sits next to an existing results action',
        (t) async {
      await pump(
        t,
        scaffold(
          spec: spec(),
          resultsAction: const Text('FILTER'),
        ),
      );
      expect(listIcon, findsOneWidget);
      expect(find.text('FILTER'), findsOneWidget);
    });

    testWidgets('disabled spec: tapping does nothing', (t) async {
      await pump(t, scaffold(spec: spec(enabled: false)));
      await t.tap(hero);
      await t.pump(const Duration(milliseconds: 400));
      expect(find.text('Export report'), findsNothing);
      await t.tap(listIcon);
      await t.pump(const Duration(milliseconds: 400));
      expect(find.text('Export report'), findsNothing);
    });
  });

  group('export sheet', () {
    testWidgets('lists PDF, Excel, CSV and Print', (t) async {
      await pump(t, scaffold(spec: spec()));
      await openSheet(t);
      expect(find.text('Export report'), findsOneWidget);
      expect(find.text('Revenue Report'), findsWidgets);
      for (final k in ['pdf', 'xlsx', 'csv', 'print']) {
        expect(find.byKey(Key('rpt-export-$k')), findsOneWidget);
      }
      expect(find.text('PDF'), findsOneWidget);
      expect(find.text('Excel'), findsOneWidget);
      expect(find.text('CSV'), findsOneWidget);
      expect(find.text('Print'), findsOneWidget);
      expect(find.textContaining(r'$'), findsNothing);
    });

    testWidgets('the list-header icon opens the same sheet', (t) async {
      await pump(t, scaffold(spec: spec()));
      await t.tap(listIcon);
      await t.pump();
      await t.pump(const Duration(milliseconds: 400));
      expect(find.text('Export report'), findsOneWidget);
      expect(find.byKey(const Key('rpt-export-xlsx')), findsOneWidget);
    });

    for (final f in ReportExportFormat.values) {
      testWidgets('${f.label}: downloads with the screen filters and shares',
          (t) async {
        await pump(t, scaffold(spec: spec()));
        await openSheet(t);
        await choose(t, f.name);
        verify(
          () => reports.exportReport(
            'revenue',
            f,
            const ReportSummaryFilters(branchId: 'b1'),
          ),
        ).called(1);
        expect(sink.shared, hasLength(1));
        expect(sink.shared.single.format, f);
        expect(sink.shared.single.filename, 'revenue-2026-10-18.${f.apiValue}');
        expect(sink.shared.single.mimeType, f.mimeType);
        expect(sink.printed, isEmpty);
        // The sheet closes and the host shows the confirmation.
        expect(find.text('Export report'), findsNothing);
        expect(find.text('${f.label} exported'), findsOneWidget);
      });
    }

    testWidgets('Print downloads the PDF and prints it with the report name',
        (t) async {
      await pump(t, scaffold(spec: spec()));
      await openSheet(t);
      await choose(t, 'print');
      verify(
        () => reports.exportReport(
          'revenue',
          ReportExportFormat.pdf,
          const ReportSummaryFilters(branchId: 'b1'),
        ),
      ).called(1);
      expect(sink.printed, hasLength(1));
      expect(sink.printed.single.format, ReportExportFormat.pdf);
      expect(sink.jobName, 'Revenue Report');
      expect(sink.shared, isEmpty);
      expect(find.text('Sent to the printer'), findsOneWidget);
      expect(find.text('Export report'), findsNothing);
    });

    testWidgets('closing the share sheet keeps the export sheet, no success',
        (t) async {
      sink.completes = false;
      await pump(t, scaffold(spec: spec()));
      await openSheet(t);
      await choose(t, 'csv');
      expect(sink.shared, hasLength(1));
      expect(find.text('Export report'), findsOneWidget);
      expect(find.text('CSV exported'), findsNothing);
    });

    testWidgets('filters are read when tapped, so they match the screen then',
        (t) async {
      var status = 'ACTIVE';
      final s = RptExportSpec(
        reportType: 'payments',
        title: 'Payment Report',
        filters: () => ReportSummaryFilters(paymentStatus: status),
      );
      await pump(t, scaffold(spec: s));
      status = 'REFUNDED';
      await openSheet(t);
      await choose(t, 'xlsx');
      verify(
        () => reports.exportReport(
          'payments',
          ReportExportFormat.xlsx,
          const ReportSummaryFilters(paymentStatus: 'REFUNDED'),
        ),
      ).called(1);
    });

    testWidgets('busy: spinner on the tapped row, others disabled, then reset',
        (t) async {
      final gate = Completer<ReportExportFile>();
      when(
        () => reports.exportReport(
          any(),
          ReportExportFormat.xlsx,
          any(),
        ),
      ).thenAnswer((_) => gate.future);
      await pump(t, scaffold(spec: spec()));
      await openSheet(t);
      await t.tap(find.byKey(const Key('rpt-export-xlsx')));
      await t.pump();
      final spinner = find.descendant(
        of: find.byKey(const Key('rpt-export-xlsx')),
        matching: find.byType(CircularProgressIndicator),
      );
      expect(spinner, findsOneWidget);
      expect(find.text('Preparing…'), findsOneWidget);
      // Other rows ignore taps while a download is running.
      await t.tap(find.byKey(const Key('rpt-export-pdf')));
      await t.tap(find.byKey(const Key('rpt-export-xlsx')));
      await t.pump();
      verify(() => reports.exportReport(any(), any(), any())).called(1);
      expect(sink.shared, isEmpty);

      gate.complete(_file(ReportExportFormat.xlsx, 'revenue'));
      await t.pump();
      await t.pump(const Duration(milliseconds: 500));
      expect(sink.shared, hasLength(1));
      expect(spinner, findsNothing);
      expect(find.text('Excel exported'), findsOneWidget);
    });

    testWidgets('server error: shows its message, resets busy, retry works',
        (t) async {
      when(() => reports.exportReport(any(), any(), any())).thenAnswer(
        (_) async => throw const ApiException(
          message: 'You do not have permission to perform this action.',
          statusCode: 403,
        ),
      );
      await pump(t, scaffold(spec: spec()));
      await openSheet(t);
      await choose(t, 'pdf');
      // Inline in the sheet and as a SnackBar on the host screen.
      expect(
        find.text('You do not have permission to perform this action.'),
        findsWidgets,
      );
      expect(find.byKey(const Key('rpt-export-error')), findsOneWidget);
      expect(find.byType(CircularProgressIndicator), findsNothing);
      expect(find.text('Export report'), findsOneWidget);
      expect(sink.shared, isEmpty);

      // Not stuck: the same row can be tapped again.
      await choose(t, 'pdf');
      verify(() => reports.exportReport(any(), any(), any())).called(2);
    });

    testWidgets('field errors are shown through detailedMessage', (t) async {
      when(() => reports.exportReport(any(), any(), any())).thenAnswer(
        (_) async => throw const ApiException(
          message: 'Request Validation Failed',
          statusCode: 422,
          fieldErrors: [FieldError(field: 'branchId', message: 'Invalid uuid')],
        ),
      );
      await pump(t, scaffold(spec: spec()));
      await openSheet(t);
      await choose(t, 'csv');
      expect(find.text('branchId: Invalid uuid'), findsWidgets);
    });

    testWidgets('an unexpected error still resets the sheet', (t) async {
      when(() => reports.exportReport(any(), any(), any()))
          .thenAnswer((_) async => throw StateError('boom'));
      await pump(t, scaffold(spec: spec()));
      await openSheet(t);
      await choose(t, 'csv');
      expect(
        find.text('Could not export this report. Please try again.'),
        findsWidgets,
      );
      expect(find.byType(CircularProgressIndicator), findsNothing);
    });

    testWidgets('a failing share sink also resets (no stuck spinner)',
        (t) async {
      final failing = _FailingSink();
      GetIt.instance
        ..unregister<ExportSink>()
        ..registerSingleton<ExportSink>(failing);
      await pump(t, scaffold(spec: spec()));
      await openSheet(t);
      await choose(t, 'xlsx');
      expect(find.byType(CircularProgressIndicator), findsNothing);
      expect(
        find.text('Could not export this report. Please try again.'),
        findsWidgets,
      );
    });

    testWidgets('phone 360x740: sheet fits, nothing overflows', (t) async {
      await pump(t, scaffold(spec: spec()), size: const Size(360, 740));
      await openSheet(t);
      expect(find.byKey(const Key('rpt-export-print')), findsOneWidget);
      expect(t.takeException(), isNull);
      final box = t.getRect(find.byType(TeamSheetScaffold));
      expect(box.width, 360);
      expect(box.bottom, lessThanOrEqualTo(740));
    });

    testWidgets('tablet 1500x1300: sheet capped at 640 dp', (t) async {
      await pump(t, scaffold(spec: spec()), size: const Size(1500, 1300));
      await openSheet(t);
      expect(
        t.getSize(find.byType(TeamSheetScaffold)).width,
        lessThanOrEqualTo(640),
      );
      expect(find.byKey(const Key('rpt-export-pdf')), findsOneWidget);
      expect(t.takeException(), isNull);
      await choose(t, 'csv');
      expect(sink.shared, hasLength(1));
    });
  });

  group('people reports (PeopleReportPage)', () {
    final screens = <String, ({Widget screen, String type})>{
      'membership': (
        screen: const MembershipReportScreen(),
        type: 'membership',
      ),
      'attendance': (
        screen: const AttendanceReportScreen(),
        type: 'attendance',
      ),
      'active vs inactive': (
        screen: const ChurnReportScreen(),
        type: 'active-vs-inactive',
      ),
      'expiring': (
        screen: const ExpiringMembershipsScreen(),
        type: 'expiring-memberships',
      ),
      'member progress': (
        screen: const MemberProgressReportScreen(),
        type: 'member-progress',
      ),
      'staff': (screen: const StaffReportScreen(), type: 'staff'),
      'trainer performance': (
        screen: const StaffPerformanceScreen(),
        type: 'trainer-performance',
      ),
    };

    for (final e in screens.entries) {
      testWidgets('${e.key}: hidden without, shown with reports:export',
          (t) async {
        await pump(t, e.value.screen, perms: const ['reports:view']);
        expect(hero, findsNothing);
        expect(listIcon, findsNothing);
      });

      testWidgets('${e.key}: exports "${e.value.type}"', (t) async {
        await pump(t, e.value.screen);
        expect(hero, findsOneWidget);
        expect(listIcon, findsOneWidget);
        await openSheet(t);
        await choose(t, 'csv');
        verify(
          () => reports.exportReport(
            e.value.type,
            ReportExportFormat.csv,
            any(),
          ),
        ).called(1);
        expect(sink.shared, hasLength(1));
      });
    }

    testWidgets('membership export carries the status + plan on screen',
        (t) async {
      await pump(
        t,
        const MembershipReportScreen(),
        perms: const ['reports:export', 'memberships:view'],
      );
      await t.tap(
        find.descendant(
          of: find.byType(RptFilterChips<String>),
          matching: find.text('Active'),
        ),
      );
      await settle(t);
      await openSheet(t);
      await choose(t, 'xlsx');
      final f = verify(
        () => reports.exportReport(
          'membership',
          ReportExportFormat.xlsx,
          captureAny(),
        ),
      ).captured.single as ReportSummaryFilters;
      expect(f.memberStatus, 'ACTIVE');
      expect(f.from, isNull, reason: 'point-in-time report: no dates');
      expect(f.to, isNull);
      expect(f.branchId, isNull);
    });

    testWidgets('attendance export carries the period shown', (t) async {
      await pump(t, const AttendanceReportScreen());
      await openSheet(t);
      await choose(t, 'pdf');
      final f = verify(
        () => reports.exportReport(
          'attendance',
          ReportExportFormat.pdf,
          captureAny(),
        ),
      ).captured.single as ReportSummaryFilters;
      expect(f.from, isNotNull);
      expect(f.to, isNotNull);
      expect(f.from!.isAfter(f.to!), isFalse);
    });

    testWidgets('360x740: nothing overflows with the export sheet open',
        (t) async {
      await pump(t, const MembershipReportScreen(), size: const Size(360, 740));
      await openSheet(t);
      expect(find.byKey(const Key('rpt-export-print')), findsOneWidget);
      expect(t.takeException(), isNull);
    });

    testWidgets('1500x1300 tablet: sheet capped, nothing overflows', (t) async {
      await pump(t, const StaffReportScreen(), size: const Size(1500, 1300));
      await openSheet(t);
      expect(
        t.getSize(find.byType(TeamSheetScaffold)).width,
        lessThanOrEqualTo(640),
      );
      expect(t.takeException(), isNull);
    });
  });

  group('finance reports', () {
    final screens = <String, ({Widget screen, String type})>{
      'revenue': (screen: const RevenueReportScreen(), type: 'revenue'),
      'expenses': (screen: const ExpenseReportScreen(), type: 'expenses'),
      'payments': (screen: const PaymentReportScreen(), type: 'payments'),
      'branch performance': (
        screen: const BranchPerformanceScreen(),
        type: 'branch-performance',
      ),
    };

    for (final e in screens.entries) {
      testWidgets('${e.key}: hidden without reports:export', (t) async {
        await pump(t, e.value.screen, perms: const ['reports:view']);
        expect(hero, findsNothing);
        expect(listIcon, findsNothing);
      });

      testWidgets('${e.key}: exports "${e.value.type}"', (t) async {
        await pump(t, e.value.screen);
        expect(hero, findsOneWidget);
        expect(listIcon, findsOneWidget);
        await openSheet(t);
        await choose(t, 'xlsx');
        verify(
          () => reports.exportReport(
            e.value.type,
            ReportExportFormat.xlsx,
            any(),
          ),
        ).called(1);
        expect(sink.shared, hasLength(1));
        expect(find.textContaining(r'$'), findsNothing);
      });

      testWidgets('${e.key}: 360x740 phone does not overflow', (t) async {
        await pump(t, e.value.screen, size: const Size(360, 740));
        expect(hero, findsOneWidget);
        await openSheet(t);
        expect(find.byKey(const Key('rpt-export-print')), findsOneWidget);
        expect(t.takeException(), isNull);
      });

      testWidgets('${e.key}: 1500x1300 tablet caps the sheet', (t) async {
        await pump(t, e.value.screen, size: const Size(1500, 1300));
        await openSheet(t);
        expect(
          t.getSize(find.byType(TeamSheetScaffold)).width,
          lessThanOrEqualTo(640),
        );
        expect(t.takeException(), isNull);
      });
    }

    testWidgets('revenue export carries the period (plain days) and branch',
        (t) async {
      await pump(t, const RevenueReportScreen());
      await openSheet(t);
      await choose(t, 'csv');
      final f = verify(
        () => reports.exportReport(
          'revenue',
          ReportExportFormat.csv,
          captureAny(),
        ),
      ).captured.single as ReportSummaryFilters;
      expect(f.from, isNotNull);
      expect(f.to, isNotNull);
      expect(f.from!.hour, 0, reason: 'a plain local day, not a timestamp');
      expect(f.branchId, isNull);
      expect(f.paymentStatus, isNull);
    });

    testWidgets('payments export carries the status filter', (t) async {
      await pump(t, const PaymentReportScreen());
      final refunded = find.descendant(
        of: find.byType(RptFilterChips<String>),
        matching: find.text(paymentStatusLabel('REFUNDED')),
      );
      await t.ensureVisible(refunded);
      await t.pump();
      await t.tap(refunded);
      await settle(t);
      await openSheet(t);
      await choose(t, 'pdf');
      final f = verify(
        () => reports.exportReport(
          'payments',
          ReportExportFormat.pdf,
          captureAny(),
        ),
      ).captured.single as ReportSummaryFilters;
      expect(f.paymentStatus, 'REFUNDED');
      expect(f.from, isNotNull);
    });

    testWidgets('branch performance export is branch-only (no dates)',
        (t) async {
      await pump(t, const BranchPerformanceScreen());
      await openSheet(t);
      await choose(t, 'csv');
      final f = verify(
        () => reports.exportReport(
          'branch-performance',
          ReportExportFormat.csv,
          captureAny(),
        ),
      ).captured.single as ReportSummaryFilters;
      expect(f.from, isNull);
      expect(f.to, isNull);
    });
  });

  group('analytics', () {
    testWidgets('a focused view exports analytics-<view> for range + branch',
        (t) async {
      await pump(
        t,
        const AnalyticsScreen(initialView: AnalyticsView.revenue),
        perms: const ['analytics:view', 'reports:export'],
      );
      expect(hero, findsOneWidget);
      await openSheet(t);
      await choose(t, 'xlsx');
      final f = verify(
        () => reports.exportReport(
          'analytics-revenue-trends',
          ReportExportFormat.xlsx,
          captureAny(),
        ),
      ).captured.single as ReportSummaryFilters;
      expect(f.from, isNotNull);
      expect(f.to, isNotNull);
      expect(f.branchId, isNull);
      expect(sink.shared, hasLength(1));
    });

    test('every analytics view maps to a server report type', () {
      expect(
        AnalyticsView.values.map((v) => v.exportType).toList(),
        [
          'analytics-revenue-trends',
          'analytics-attendance-trends',
          'analytics-membership-growth',
          'analytics-new-member-growth',
          'analytics-retention',
          'analytics-payment-collection',
          'analytics-branch-comparison',
        ],
      );
    });

    for (final v in AnalyticsView.values) {
      testWidgets('${v.title} exports ${v.exportType}', (t) async {
        await pump(
          t,
          AnalyticsScreen(initialView: v),
          perms: const ['analytics:view', 'reports:export'],
        );
        await openSheet(t);
        await choose(t, 'csv');
        verify(
          () =>
              reports.exportReport(v.exportType, ReportExportFormat.csv, any()),
        ).called(1);
      });
    }

    testWidgets('the Overview has no export (like web)', (t) async {
      await pump(
        t,
        const AnalyticsScreen(),
        perms: const ['analytics:view', 'reports:export'],
      );
      expect(hero, findsNothing);
    });

    testWidgets('hidden without reports:export', (t) async {
      await pump(
        t,
        const AnalyticsScreen(initialView: AnalyticsView.revenue),
        perms: const ['analytics:view'],
      );
      expect(hero, findsNothing);
    });

    testWidgets('no analytics:view: access message, no export', (t) async {
      await pump(
        t,
        const AnalyticsScreen(initialView: AnalyticsView.revenue),
        perms: const ['reports:export'],
      );
      expect(find.text("You don't have access to analytics."), findsOneWidget);
      expect(hero, findsNothing);
    });

    testWidgets('360x740 phone does not overflow', (t) async {
      await pump(
        t,
        const AnalyticsScreen(initialView: AnalyticsView.attendance),
        perms: const ['analytics:view', 'reports:export'],
        size: const Size(360, 740),
      );
      await openSheet(t);
      expect(find.byKey(const Key('rpt-export-print')), findsOneWidget);
      expect(t.takeException(), isNull);
    });

    testWidgets('1500x1300 tablet caps the sheet', (t) async {
      await pump(
        t,
        const AnalyticsScreen(initialView: AnalyticsView.attendance),
        perms: const ['analytics:view', 'reports:export'],
        size: const Size(1500, 1300),
      );
      await openSheet(t);
      expect(
        t.getSize(find.byType(TeamSheetScaffold)).width,
        lessThanOrEqualTo(640),
      );
      expect(t.takeException(), isNull);
    });
  });
}

class _FailingSink implements ExportSink {
  @override
  Future<bool> share(ReportExportFile file, {Rect? origin}) async =>
      throw StateError('no share target');

  @override
  Future<bool> printPdf(
    ReportExportFile file, {
    required String jobName,
  }) async =>
      throw StateError('no printer');
}
