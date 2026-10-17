import 'package:flutter_test/flutter_test.dart';
import 'package:gym_saas_mobile/bloc/dashboard/owner_dashboard_cubit.dart';
import 'package:gym_saas_mobile/core/network/api_exception.dart';
import 'package:gym_saas_mobile/models/branch_option.dart';
import 'package:gym_saas_mobile/models/member_invoice.dart';
import 'package:gym_saas_mobile/models/paginated_result.dart';
import 'package:gym_saas_mobile/models/platform_announcement.dart';
import 'package:gym_saas_mobile/repositories/analytics_repository.dart';
import 'package:gym_saas_mobile/repositories/announcement_repository.dart';
import 'package:gym_saas_mobile/repositories/billing_repository.dart';
import 'package:gym_saas_mobile/repositories/branch_repository.dart';
import 'package:gym_saas_mobile/repositories/dashboard_repository.dart';
import 'package:gym_saas_mobile/repositories/invoice_repository.dart';
import 'package:gym_saas_mobile/repositories/reports_repository.dart';
import 'package:mocktail/mocktail.dart';

class _Dashboard extends Mock implements DashboardRepository {}

class _Branches extends Mock implements BranchRepository {}

class _Analytics extends Mock implements AnalyticsRepository {}

class _Reports extends Mock implements ReportsRepository {}

class _Invoices extends Mock implements InvoiceRepository {}

class _Announcements extends Mock implements AnnouncementRepository {}

class _Billing extends Mock implements BillingRepository {}

const _moduleOff = ApiException(
  message: 'This module is currently unavailable.',
  statusCode: 403,
);

void main() {
  late _Dashboard dashboard;
  late _Branches branches;
  late _Analytics analytics;
  late _Reports reports;
  late _Invoices invoices;
  late _Announcements announcements;
  late _Billing billing;

  OwnerDashboardCubit build(DashboardAccess access) => OwnerDashboardCubit(
        dashboard,
        branches,
        analytics,
        reports,
        invoices,
        announcements,
        billing,
        access,
      );

  setUp(() {
    dashboard = _Dashboard();
    branches = _Branches();
    analytics = _Analytics();
    reports = _Reports();
    invoices = _Invoices();
    announcements = _Announcements();
    billing = _Billing();
    when(() => branches.assignable()).thenAnswer((_) async => <BranchOption>[]);
    when(() => announcements.listActivePlatform())
        .thenAnswer((_) async => <PlatformAnnouncement>[]);
    when(() => billing.currentSubscription()).thenAnswer((_) async => null);
  });

  test(
    'when every section the viewer may see is blocked, the server reason '
    'is shown instead of an empty page',
    () async {
      // Every reports/analytics call answers 403, like the live API does for
      // a tenant whose plan excludes those modules.
      when(() => dashboard.kpis(branchId: any(named: 'branchId')))
          .thenAnswer((_) async => throw _moduleOff);
      when(() => dashboard.recentActivities(branchId: any(named: 'branchId')))
          .thenAnswer((_) async => throw _moduleOff);
      when(
        () => analytics.revenueTrends(
          from: any(named: 'from'),
          to: any(named: 'to'),
          branchId: any(named: 'branchId'),
        ),
      ).thenAnswer((_) async => throw _moduleOff);
      when(
        () => analytics.attendanceTrends(
          from: any(named: 'from'),
          to: any(named: 'to'),
          branchId: any(named: 'branchId'),
        ),
      ).thenAnswer((_) async => throw _moduleOff);
      when(
        () => analytics.newMemberGrowth(
          from: any(named: 'from'),
          to: any(named: 'to'),
          branchId: any(named: 'branchId'),
        ),
      ).thenAnswer((_) async => throw _moduleOff);

      when(
        () => reports.expiringMemberships(
          branchId: any(named: 'branchId'),
          limit: any(named: 'limit'),
        ),
      ).thenAnswer((_) async => throw _moduleOff);
      when(
        () => analytics.paymentCollection(
          from: any(named: 'from'),
          to: any(named: 'to'),
          branchId: any(named: 'branchId'),
        ),
      ).thenAnswer((_) async => throw _moduleOff);
      when(() => reports.trainerPerformance(branchId: any(named: 'branchId')))
          .thenAnswer((_) async => throw _moduleOff);
      final cubit = build(
        const DashboardAccess(reports: true, analytics: false, finance: false),
      );
      await cubit.load();
      // All viewer-visible sections failed → the server's reason is shown.
      expect(cubit.state, isA<OwnerDashboardError>());
      expect(
        (cubit.state as OwnerDashboardError).message,
        'This module is currently unavailable.',
      );
    },
  );

  test(
      'a viewer with no report permissions gets the always-available '
      'sections (announcements, plan) and no requests to gated endpoints',
      () async {
    final cubit = build(
      const DashboardAccess(reports: false, analytics: false, finance: false),
    );
    await cubit.load();
    final state = cubit.state;
    expect(state, isA<OwnerDashboardLoaded>());
    final data = (state as OwnerDashboardLoaded).data;
    expect(data.kpis, isNull);
    expect(data.unavailableMessage, isNull);
    verifyNever(() => dashboard.kpis(branchId: any(named: 'branchId')));
  });

  test(
    'Starter plan: Reports blocked but Invoices work -> page still loads, '
    'keeps the working panels and explains the gap',
    () async {
      when(() => dashboard.kpis(branchId: any(named: 'branchId')))
          .thenAnswer((_) async => throw _moduleOff);
      when(
        () => invoices.list(
          limit: any(named: 'limit'),
          status: any(named: 'status'),
          branchId: any(named: 'branchId'),
          sortBy: any(named: 'sortBy'),
          sortDir: any(named: 'sortDir'),
        ),
      ).thenAnswer(
        (_) async => const PaginatedResult<MemberInvoice>(
          items: [],
          total: 0,
          page: 1,
          limit: 6,
          totalPages: 0,
        ),
      );
      final cubit = build(
        const DashboardAccess(reports: true, analytics: false, finance: true),
      );
      when(() => dashboard.recentActivities(branchId: any(named: 'branchId')))
          .thenAnswer((_) async => throw _moduleOff);
      when(
        () => reports.expiringMemberships(
          branchId: any(named: 'branchId'),
          limit: any(named: 'limit'),
        ),
      ).thenAnswer((_) async => throw _moduleOff);
      when(
        () => analytics.paymentCollection(
          from: any(named: 'from'),
          to: any(named: 'to'),
          branchId: any(named: 'branchId'),
        ),
      ).thenAnswer((_) async => throw _moduleOff);
      when(() => reports.trainerPerformance(branchId: any(named: 'branchId')))
          .thenAnswer((_) async => throw _moduleOff);
      await cubit.load();
      final state = cubit.state;
      expect(state, isA<OwnerDashboardLoaded>());
      final data = (state as OwnerDashboardLoaded).data;
      expect(data.kpis, isNull);
      expect(data.outstanding, isEmpty);
      expect(data.unavailableMessage, 'This module is currently unavailable.');
    },
  );
}
