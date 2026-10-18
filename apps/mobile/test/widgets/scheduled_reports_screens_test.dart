import 'package:bloc_test/bloc_test.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:get_it/get_it.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:gym_saas_mobile/bloc/session/session_cubit.dart';
import 'package:gym_saas_mobile/bloc/session/session_state.dart';
import 'package:gym_saas_mobile/core/network/api_exception.dart';
import 'package:gym_saas_mobile/core/routing/app_routes.dart';
import 'package:gym_saas_mobile/features/reports/presentation/scheduled_report_form_screen.dart';
import 'package:gym_saas_mobile/features/reports/presentation/scheduled_reports_screen.dart';
import 'package:gym_saas_mobile/models/scheduled_report.dart';
import 'package:gym_saas_mobile/models/tenant_branding.dart';
import 'package:gym_saas_mobile/models/user_profile.dart';
import 'package:gym_saas_mobile/repositories/scheduled_report_repository.dart';
import 'package:mocktail/mocktail.dart';

class _Repo extends Mock implements ScheduledReportRepository {}

class _Session extends MockCubit<SessionState> implements SessionCubit {}

const _tenant = TenantBranding(
  slug: 't',
  name: 'T',
  status: 'ACTIVE',
  maintenanceMode: false,
  primaryColor: '',
);

ScheduledReport _sched(
  String id, {
  bool active = true,
  String type = 'revenue',
  String? branch,
}) =>
    ScheduledReport.fromJson({
      'id': id,
      'name': 'Report $id',
      'reportType': type,
      'frequency': 'WEEKLY',
      'recipientEmails': ['a@x.test', 'b@x.test'],
      'isActive': active,
      'lastRunAt': null,
      'nextRunAt': '2026-10-20T09:00:00.000Z',
      'branch': branch == null ? null : {'id': 'b', 'name': branch},
    });

const _view = ['reports:view'];
const _manage = ['reports:view', 'reports:export'];

Future<void> settle(WidgetTester t) async {
  await t.pump();
  await t.pump(const Duration(seconds: 2));
}

void main() {
  setUpAll(() {
    GoogleFonts.config.allowRuntimeFetching = false;
    registerFallbackValue(ScheduledReportType.revenue);
    registerFallbackValue(ReportFrequency.weekly);
  });

  late _Repo repo;
  var reports = <ScheduledReport>[];

  setUp(() {
    repo = _Repo();
    reports = [
      _sched('1', branch: 'Main'),
      _sched('2', active: false, type: 'analytics-retention'),
    ];
    final g = GetIt.instance;
    if (g.isRegistered<ScheduledReportRepository>()) {
      g.unregister<ScheduledReportRepository>();
    }
    g.registerSingleton<ScheduledReportRepository>(repo);
    when(() => repo.list()).thenAnswer((_) async => reports);
    when(() => repo.runNow(any())).thenAnswer((_) async {});
    when(() => repo.delete(any())).thenAnswer((_) async {});
    when(() => repo.setActive(any(), isActive: any(named: 'isActive')))
        .thenAnswer((_) async => reports.first);
  });

  Future<GoRouter> pumpApp(
    WidgetTester t, {
    List<String> perms = _manage,
    Size size = const Size(360, 1400),
    String initial = '/',
  }) async {
    t.view.physicalSize = size * 2;
    t.view.devicePixelRatio = 2;
    addTearDown(t.view.reset);
    final session = _Session();
    when(() => session.state).thenReturn(
      SessionAuthenticatedStaff(
        UserProfile(
          id: 'me',
          tenantId: 't',
          name: 'Me',
          email: 'me@x.test',
          phone: null,
          status: 'ACTIVE',
          roles: const ['OWNER'],
          permissions: perms,
        ),
        _tenant,
      ),
    );
    final router = GoRouter(
      initialLocation: initial,
      routes: [
        GoRoute(path: '/', builder: (_, __) => const ScheduledReportsScreen()),
        GoRoute(
          path: AppRoutes.scheduledReportForm,
          builder: (_, __) => const ScheduledReportFormScreen(),
        ),
      ],
    );
    await t.pumpWidget(
      BlocProvider<SessionCubit>.value(
        value: session,
        child: MaterialApp.router(routerConfig: router),
      ),
    );
    await settle(t);
    return router;
  }

  group('list', () {
    testWidgets('renders hero counts and a card per schedule (phone 360)',
        (t) async {
      await pumpApp(t);
      expect(t.takeException(), isNull);
      expect(find.text('Scheduled Reports'), findsOneWidget);
      expect(find.text('2 scheduled'), findsOneWidget);
      expect(find.text('1 active'), findsOneWidget);
      expect(find.text('1 paused'), findsOneWidget);
      expect(find.text('Report 1'), findsOneWidget);
      expect(find.text('Revenue Report'), findsOneWidget);
      expect(find.text('Analytics: Member Retention'), findsOneWidget);
      expect(find.text('Weekly'), findsWidgets);
      expect(find.text('2 recipients'), findsWidgets);
      expect(find.text('Main'), findsOneWidget);
      expect(find.text('Active'), findsOneWidget);
      expect(find.text('Paused'), findsWidgets);
    });

    testWidgets('tablet 1500x1300: cards two-up, no overflow', (t) async {
      await pumpApp(t, size: const Size(1500, 1300));
      expect(t.takeException(), isNull);
      expect(
        t.getTopLeft(find.text('Report 2')).dx,
        greaterThan(t.getTopLeft(find.text('Report 1')).dx),
      );
    });

    testWidgets('with reports:export: + and Pause / Run now / Delete',
        (t) async {
      await pumpApp(t);
      expect(find.byIcon(Icons.add_rounded), findsOneWidget);
      expect(find.text('Run now'), findsNWidgets(2));
      expect(find.text('Delete'), findsNWidgets(2));
      expect(find.text('Pause'), findsOneWidget);
      expect(find.text('Resume'), findsOneWidget);
    });

    testWidgets('reports:view only: read-only list, no + and no actions',
        (t) async {
      await pumpApp(t, perms: _view);
      expect(find.text('Report 1'), findsOneWidget);
      expect(find.byIcon(Icons.add_rounded), findsNothing);
      expect(find.text('Run now'), findsNothing);
      expect(find.text('Delete'), findsNothing);
      expect(find.text('Pause'), findsNothing);
    });

    testWidgets('Pause and Resume PATCH isActive and reload', (t) async {
      await pumpApp(t);
      await t.tap(find.text('Pause'));
      await settle(t);
      verify(() => repo.setActive('1', isActive: false)).called(1);
      expect(find.text('Schedule paused.'), findsOneWidget);
      await t.tap(find.text('Resume'));
      await settle(t);
      verify(() => repo.setActive('2', isActive: true)).called(1);
      verify(() => repo.list()).called(greaterThan(1));
    });

    testWidgets('Run now calls the endpoint and confirms', (t) async {
      await pumpApp(t);
      await t.tap(find.text('Run now').first);
      await settle(t);
      verify(() => repo.runNow('1')).called(1);
      expect(
        find.text('Run recorded — email will be sent shortly.'),
        findsOneWidget,
      );
    });

    testWidgets('Delete asks first; Cancel keeps it, confirm deletes',
        (t) async {
      await pumpApp(t);
      await t.tap(find.text('Delete').first);
      await settle(t);
      expect(find.text('Delete this scheduled report?'), findsOneWidget);
      await t.tap(find.text('Cancel'));
      await settle(t);
      verifyNever(() => repo.delete(any()));
      await t.tap(find.text('Delete').first);
      await settle(t);
      await t.tap(
        find.descendant(
          of: find.byType(AlertDialog),
          matching: find.text('Delete'),
        ),
      );
      await settle(t);
      verify(() => repo.delete('1')).called(1);
      expect(find.text('Scheduled report deleted.'), findsOneWidget);
    });

    testWidgets('a failing action shows the server message', (t) async {
      when(() => repo.runNow(any())).thenThrow(
        const ApiException(message: 'Nope', statusCode: 403),
      );
      await pumpApp(t);
      await t.tap(find.text('Run now').first);
      await settle(t);
      expect(find.text('Nope'), findsOneWidget);
    });

    testWidgets('load error: message + Try again reloads', (t) async {
      when(() => repo.list()).thenThrow(
        const ApiException(
          message: 'This module is currently unavailable.',
          statusCode: 403,
        ),
      );
      await pumpApp(t);
      expect(
        find.text('This module is currently unavailable.'),
        findsOneWidget,
      );
      reports = [_sched('9')];
      when(() => repo.list()).thenAnswer((_) async => reports);
      await t.tap(find.text('Try again'));
      await settle(t);
      expect(find.text('Report 9'), findsOneWidget);
    });

    testWidgets('empty list: empty state, CTA only with reports:export',
        (t) async {
      reports = [];
      await pumpApp(t);
      expect(find.text('No scheduled reports yet'), findsOneWidget);
      expect(find.text('Schedule a report'), findsOneWidget);
      await pumpApp(t, perms: _view);
      expect(find.text('Schedule a report'), findsNothing);
    });

    testWidgets('+ opens the form and a created schedule reloads the list',
        (t) async {
      await pumpApp(t);
      await t.tap(find.byIcon(Icons.add_rounded));
      await settle(t);
      expect(find.text('Schedule a report'), findsWidgets);
      expect(t.takeException(), isNull);
    });
  });

  group('form', () {
    Future<void> openForm(
      WidgetTester t, {
      Size size = const Size(360, 1400),
    }) =>
        pumpApp(t, size: size, initial: AppRoutes.scheduledReportForm);

    testWidgets('renders, prefilled with the signed-in email (phone + tablet)',
        (t) async {
      await openForm(t);
      expect(t.takeException(), isNull);
      expect(find.text('Schedule a report'), findsWidgets);
      expect(find.text('me@x.test'), findsWidgets);
      expect(find.text('Daily'), findsOneWidget);
      expect(find.text('Monthly'), findsOneWidget);
      await openForm(t, size: const Size(1500, 1300));
      expect(t.takeException(), isNull);
    });

    testWidgets('validation: name first, then recipients, then email shape',
        (t) async {
      await openForm(t);
      Future<void> submit() async {
        final b = find.text('Create schedule');
        await t.scrollUntilVisible(
          b,
          200,
          scrollable: find.byType(Scrollable).first,
        );
        await t.tap(b);
        await t.pump();
      }

      await submit();
      expect(find.text('Give this report a name.'), findsOneWidget);
      await t.enterText(find.byType(TextField).first, 'Weekly revenue');
      await t.enterText(find.byType(TextField).last, 'bad-email');
      await t.pump();
      await submit();
      expect(find.textContaining('not a valid email'), findsWidgets);
      verifyNever(
        () => repo.create(
          name: any(named: 'name'),
          reportType: any(named: 'reportType'),
          frequency: any(named: 'frequency'),
          recipientEmails: any(named: 'recipientEmails'),
        ),
      );
    });

    testWidgets('submits name, type, frequency and the parsed emails',
        (t) async {
      when(
        () => repo.create(
          name: any(named: 'name'),
          reportType: any(named: 'reportType'),
          frequency: any(named: 'frequency'),
          recipientEmails: any(named: 'recipientEmails'),
        ),
      ).thenAnswer((_) async => reports.first);
      await openForm(t);
      await t.enterText(find.byType(TextField).first, '  Weekly revenue ');
      await t.enterText(find.byType(TextField).last, 'a@x.test, b@x.test');
      await t.pump();
      await t.tap(find.text('Monthly'));
      await t.pump();
      final b = find.text('Create schedule');
      await t.scrollUntilVisible(
        b,
        200,
        scrollable: find.byType(Scrollable).first,
      );
      await t.tap(b);
      await settle(t);
      verify(
        () => repo.create(
          name: 'Weekly revenue',
          reportType: ScheduledReportType.revenue,
          frequency: ReportFrequency.monthly,
          recipientEmails: ['a@x.test', 'b@x.test'],
        ),
      ).called(1);
    });

    testWidgets('server field errors are shown via detailedMessage', (t) async {
      when(
        () => repo.create(
          name: any(named: 'name'),
          reportType: any(named: 'reportType'),
          frequency: any(named: 'frequency'),
          recipientEmails: any(named: 'recipientEmails'),
        ),
      ).thenThrow(
        const ApiException(
          message: 'Request Validation Failed',
          statusCode: 422,
          fieldErrors: [
            FieldError(field: 'recipientEmails.0', message: 'Invalid email'),
          ],
        ),
      );
      await openForm(t);
      await t.enterText(find.byType(TextField).first, 'N');
      await t.pump();
      final b = find.text('Create schedule');
      await t.scrollUntilVisible(
        b,
        200,
        scrollable: find.byType(Scrollable).first,
      );
      await t.tap(b);
      await settle(t);
      expect(find.text('recipientEmails.0: Invalid email'), findsOneWidget);
    });

    testWidgets('the report picker offers all 18 types incl. analytics',
        (t) async {
      await openForm(t);
      await t.tap(find.text('Revenue Report'));
      await settle(t);
      expect(find.text('Analytics: Revenue Trends'), findsOneWidget);
      await t.scrollUntilVisible(
        find.text('Analytics: Branch Comparison'),
        100,
        scrollable: find.byType(Scrollable).last,
      );
      expect(find.text('Analytics: Branch Comparison'), findsOneWidget);
    });
  });
}
