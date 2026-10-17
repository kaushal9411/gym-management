import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../core/network/api_exception.dart';
import '../../models/branch_comparison_row.dart';
import '../../models/branch_option.dart';
import '../../models/dashboard_kpis.dart';
import '../../models/expiring_membership_row.dart';
import '../../models/member_invoice.dart';
import '../../models/platform_announcement.dart';
import '../../models/recent_activity.dart';
import '../../models/revenue_trend_point.dart';
import '../../models/subscription_plan_info.dart';
import '../../models/trainer_performance_row.dart';
import '../../models/trend_point.dart';
import '../../repositories/analytics_repository.dart';
import '../../repositories/announcement_repository.dart';
import '../../repositories/billing_repository.dart';
import '../../repositories/branch_repository.dart';
import '../../repositories/dashboard_repository.dart';
import '../../repositories/invoice_repository.dart';
import '../../repositories/reports_repository.dart';

/// Which web permissions the viewer holds. Web hides each dashboard panel
/// whose permission is missing (`reports:view` / `analytics:view` /
/// `finance:view`); the cubit skips the matching requests so a role without
/// them never triggers a 403.
class DashboardAccess extends Equatable {
  const DashboardAccess({
    required this.reports,
    required this.analytics,
    required this.finance,
  });

  final bool reports;
  final bool analytics;
  final bool finance;

  @override
  List<Object?> get props => [reports, analytics, finance];
}

/// Everything the redesigned Overview shows. Each section is null when its
/// permission is missing or its request failed, and its panel then simply
/// does not render (web's panels do the same).
class OwnerDashboardData extends Equatable {
  const OwnerDashboardData({
    required this.kpis,
    required this.activities,
    required this.revenue,
    required this.attendance,
    required this.growth,
    required this.collection,
    required this.expiring,
    required this.outstanding,
    required this.branchRows,
    required this.trainers,
    required this.announcements,
    required this.subscription,
    this.unavailableMessage,
  });

  final DashboardKpis? kpis;
  final List<RecentActivity>? activities;
  final List<RevenueTrendPoint>? revenue;
  final List<TrendPoint>? attendance;
  final List<TrendPoint>? growth;

  /// `income` = collected, `expenses` = invoiced (the server reuses the
  /// revenue shape — same as web's `usePaymentCollection`).
  final List<RevenueTrendPoint>? collection;
  final List<ExpiringMembershipRow>? expiring;
  final List<MemberInvoice>? outstanding;
  final List<BranchComparisonRow>? branchRows;
  final List<TrainerPerformanceRow>? trainers;
  final List<PlatformAnnouncement> announcements;
  final TenantSubscription? subscription;

  /// Set when a section the viewer is allowed to see could not be loaded
  /// (typically a module the gym's plan excludes, which the API answers
  /// with 403 "This module is currently unavailable"). The page still shows
  /// everything that did load and explains the gap with this message.
  final String? unavailableMessage;

  @override
  List<Object?> get props => [
        unavailableMessage,
        kpis,
        activities,
        revenue,
        attendance,
        growth,
        collection,
        expiring,
        outstanding,
        branchRows,
        trainers,
        announcements,
        subscription,
      ];
}

sealed class OwnerDashboardState extends Equatable {
  const OwnerDashboardState();

  @override
  List<Object?> get props => [];
}

class OwnerDashboardLoading extends OwnerDashboardState {
  const OwnerDashboardLoading();
}

class OwnerDashboardError extends OwnerDashboardState {
  const OwnerDashboardError(this.message);

  final String message;

  @override
  List<Object?> get props => [message];
}

class OwnerDashboardLoaded extends OwnerDashboardState {
  const OwnerDashboardLoaded({
    required this.data,
    required this.branches,
    required this.selectedBranchId,
    required this.rangeDays,
    this.refreshing = false,
  });

  final OwnerDashboardData data;
  final List<BranchOption> branches;
  final String? selectedBranchId;

  /// 7, 30 or 90 — web's header range (`useDashboardRange`).
  final int rangeDays;

  /// A branch/range change is reloading: the old numbers stay on screen
  /// (dimmed) instead of collapsing to a spinner.
  final bool refreshing;

  OwnerDashboardLoaded copyWith({
    OwnerDashboardData? data,
    bool? refreshing,
    String? Function()? selectedBranchId,
    int? rangeDays,
  }) =>
      OwnerDashboardLoaded(
        data: data ?? this.data,
        branches: branches,
        selectedBranchId: selectedBranchId != null
            ? selectedBranchId()
            : this.selectedBranchId,
        rangeDays: rangeDays ?? this.rangeDays,
        refreshing: refreshing ?? this.refreshing,
      );

  @override
  List<Object?> get props =>
      [data, branches, selectedBranchId, rangeDays, refreshing];
}

/// Owner Overview — mirrors tenant-web's dashboard page request-for-request
/// (`KpiStrip`, `MoneyChartPanel`, `MembersPanel`, attendance/new-member
/// charts, expiring/outstanding/activity lists, branch comparison, staff,
/// collection health, announcements, plan). Same endpoints, same limits
/// (6 rows for lists, 4 trainers), same branch scoping.
///
/// A separate cubit from the older [DashboardCubit], which the Manager
/// dashboard still uses unchanged.
class OwnerDashboardCubit extends Cubit<OwnerDashboardState> {
  OwnerDashboardCubit(
    this._dashboard,
    this._branchRepository,
    this._analytics,
    this._reports,
    this._invoices,
    this._announcements,
    this._billing,
    this.access,
  ) : super(const OwnerDashboardLoading());

  final DashboardRepository _dashboard;
  final BranchRepository _branchRepository;
  final AnalyticsRepository _analytics;
  final ReportsRepository _reports;
  final InvoiceRepository _invoices;
  final AnnouncementRepository _announcements;
  final BillingRepository _billing;
  final DashboardAccess access;

  static const _defaultRange = 30;

  Future<void> load() async {
    final current = state;
    if (current is OwnerDashboardLoaded) {
      await _reload(
        current,
        current.selectedBranchId,
        current.rangeDays,
      );
      return;
    }
    emit(const OwnerDashboardLoading());
    try {
      final branches = await _branchRepository.assignable();
      final data = await _fetch(null, _defaultRange);
      emit(
        OwnerDashboardLoaded(
          data: data,
          branches: branches,
          selectedBranchId: null,
          rangeDays: _defaultRange,
        ),
      );
    } on ApiException catch (e) {
      emit(OwnerDashboardError(e.message));
    }
  }

  Future<void> selectBranch(String? branchId) {
    final current = state;
    if (current is! OwnerDashboardLoaded) return Future.value();
    return _reload(current, branchId, current.rangeDays);
  }

  Future<void> selectRange(int days) {
    final current = state;
    if (current is! OwnerDashboardLoaded || current.rangeDays == days) {
      return Future.value();
    }
    return _reload(current, current.selectedBranchId, days);
  }

  Future<void> _reload(
    OwnerDashboardLoaded current,
    String? branchId,
    int days,
  ) async {
    emit(
      current.copyWith(
        refreshing: true,
        selectedBranchId: () => branchId,
        rangeDays: days,
      ),
    );
    try {
      final data = await _fetch(branchId, days);
      emit(
        OwnerDashboardLoaded(
          data: data,
          branches: current.branches,
          selectedBranchId: branchId,
          rangeDays: days,
        ),
      );
    } on ApiException catch (e) {
      emit(OwnerDashboardError(e.message));
    }
  }

  /// A failed or forbidden section becomes null rather than failing the
  /// whole page; only "nothing at all loaded" is an error. The first
  /// failure is remembered so the page can say why something is missing.
  Future<T?> _safe<T>(
    Future<T> future,
    void Function(ApiException) onError,
  ) async {
    try {
      return await future;
    } on ApiException catch (e) {
      onError(e);
      return null;
    }
  }

  Future<OwnerDashboardData> _fetch(String? branchId, int days) async {
    final to = DateTime.now();
    final from = to.subtract(Duration(days: days - 1));
    final r = access.reports;
    final a = access.analytics;
    final f = access.finance;
    ApiException? firstError;
    void note(ApiException e) => firstError ??= e;

    // Started before any await so the requests run in parallel.
    final kpis = r ? _safe(_dashboard.kpis(branchId: branchId), note) : null;
    final activities =
        r ? _safe(_dashboard.recentActivities(branchId: branchId), note) : null;
    final revenue = a
        ? _safe(
            _analytics.revenueTrends(from: from, to: to, branchId: branchId),
            note,
          )
        : null;
    final attendance = a
        ? _safe(
            _analytics.attendanceTrends(from: from, to: to, branchId: branchId),
            note,
          )
        : null;
    final growth = a
        ? _safe(
            _analytics.newMemberGrowth(from: from, to: to, branchId: branchId),
            note,
          )
        : null;
    final collection = r
        ? _safe(
            _analytics.paymentCollection(
              from: from,
              to: to,
              branchId: branchId,
            ),
            note,
          )
        : null;
    final expiring = r
        ? _safe(
            _reports.expiringMemberships(branchId: branchId, limit: 6),
            note,
          )
        : null;
    final overdue = f
        ? _safe(
            _invoices.list(
              limit: 6,
              status: 'OVERDUE',
              branchId: branchId,
              sortBy: 'dueDate',
              sortDir: 'asc',
            ),
            note,
          )
        : null;
    final unpaid = f
        ? _safe(
            _invoices.list(
              limit: 6,
              status: 'UNPAID',
              branchId: branchId,
              sortBy: 'dueDate',
              sortDir: 'asc',
            ),
            note,
          )
        : null;
    final branchRows =
        a ? _safe(_analytics.branchComparison(branchId: branchId), note) : null;
    final trainers =
        r ? _safe(_reports.trainerPerformance(branchId: branchId), note) : null;
    final announcements = _safe(_announcements.listActivePlatform(), (_) {});
    final subscription = _safe(_billing.currentSubscription(), (_) {});

    final data = OwnerDashboardData(
      kpis: await kpis,
      activities: await activities,
      revenue: await revenue,
      attendance: await attendance,
      growth: await growth,
      collection: await collection,
      expiring: (await expiring)?.items,
      outstanding: f
          ? [
              ...?(await overdue)?.items,
              ...?(await unpaid)?.items,
            ].take(6).toList()
          : null,
      branchRows: await branchRows,
      trainers: (await trainers)?.take(4).toList(),
      announcements: await announcements ?? const [],
      subscription: await subscription,
      unavailableMessage: firstError?.message,
    );
    final nothingLoaded = data.kpis == null &&
        data.activities == null &&
        data.revenue == null &&
        data.attendance == null &&
        data.growth == null &&
        data.expiring == null &&
        data.outstanding == null &&
        data.branchRows == null;
    if ((r || a || f) && nothingLoaded && firstError != null) {
      // Everything the viewer may see failed (offline, or every module off).
      // Show the server's reason rather than an empty page.
      throw firstError!;
    }
    return data;
  }
}
