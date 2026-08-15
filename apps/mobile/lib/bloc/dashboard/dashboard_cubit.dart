import 'package:flutter_bloc/flutter_bloc.dart';

import '../../core/network/api_exception.dart';
import '../../models/branch_option.dart';
import '../../models/dashboard_kpis.dart';
import '../../models/platform_announcement.dart';
import '../../models/recent_activity.dart';
import '../../models/revenue_trend_point.dart';
import '../../models/subscription_plan_info.dart';
import '../../models/trend_point.dart';
import '../../repositories/analytics_repository.dart';
import '../../repositories/announcement_repository.dart';
import '../../repositories/billing_repository.dart';
import '../../repositories/branch_repository.dart';
import '../../repositories/dashboard_repository.dart';
import 'dashboard_state.dart';

class DashboardCubit extends Cubit<DashboardState> {
  DashboardCubit(
    this._repository,
    this._branchRepository,
    this._analytics,
    this._announcements,
    this._billing,
  ) : super(const DashboardLoading());

  final DashboardRepository _repository;
  final BranchRepository _branchRepository;
  final AnalyticsRepository _analytics;
  final AnnouncementRepository _announcements;
  final BillingRepository _billing;

  /// Defaults to the tenant-wide total (unscoped) — the picker (only shown
  /// for tenants with more than one branch, mirroring web's
  /// `BranchSelector`) lets the owner switch to a specific branch's
  /// numbers, matching what web's header shows for that branch.
  Future<void> load() async {
    emit(const DashboardLoading());
    try {
      final branches = await _branchRepository.assignable();
      await _loadScoped(branches, null);
    } on ApiException catch (e) {
      emit(DashboardError(e.message));
    }
  }

  /// Re-fetches KPIs/activities/trend scoped to a different branch (or
  /// back to the tenant-wide total, for `branchId: null`) — called by the
  /// Overview screen's branch picker.
  Future<void> selectBranch(String? branchId) async {
    final current = state;
    if (current is! DashboardLoaded) return;
    emit(const DashboardLoading());
    try {
      await _loadScoped(current.branches, branchId);
    } on ApiException catch (e) {
      emit(DashboardError(e.message));
    }
  }

  Future<void> _loadScoped(
    List<BranchOption> branches,
    String? branchId,
  ) async {
    final to = DateTime.now();
    final from = to.subtract(const Duration(days: 29));

    // Kick off all seven before awaiting any of them — genuine parallel
    // requests, not a type-erased Future.wait.
    final Future<DashboardKpis> kpisFuture =
        _repository.kpis(branchId: branchId);
    final Future<List<RecentActivity>> activitiesFuture =
        _repository.recentActivities(branchId: branchId);
    final Future<List<RevenueTrendPoint>> revenueFuture =
        _analytics.revenueTrends(from: from, to: to, branchId: branchId);
    final Future<List<TrendPoint>> attendanceFuture =
        _analytics.attendanceTrends(from: from, to: to, branchId: branchId);
    final Future<List<TrendPoint>> memberGrowthFuture =
        _analytics.newMemberGrowth(from: from, to: to, branchId: branchId);
    final Future<List<PlatformAnnouncement>> announcementsFuture =
        _announcements.listActivePlatform();
    final Future<TenantSubscription?> subscriptionFuture =
        _billing.currentSubscription();
    emit(
      DashboardLoaded(
        kpis: await kpisFuture,
        activities: await activitiesFuture,
        revenueTrend: await revenueFuture,
        attendanceTrend: await attendanceFuture,
        memberGrowthTrend: await memberGrowthFuture,
        platformAnnouncements: await announcementsFuture,
        subscription: await subscriptionFuture,
        branches: branches,
        selectedBranchId: branchId,
      ),
    );
  }
}
