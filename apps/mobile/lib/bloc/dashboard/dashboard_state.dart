import 'package:equatable/equatable.dart';

import '../../models/branch_option.dart';
import '../../models/dashboard_kpis.dart';
import '../../models/platform_announcement.dart';
import '../../models/recent_activity.dart';
import '../../models/revenue_trend_point.dart';
import '../../models/subscription_plan_info.dart';
import '../../models/trend_point.dart';

sealed class DashboardState extends Equatable {
  const DashboardState();

  @override
  List<Object?> get props => [];
}

class DashboardLoading extends DashboardState {
  const DashboardLoading();
}

class DashboardError extends DashboardState {
  const DashboardError(this.message);

  final String message;

  @override
  List<Object?> get props => [message];
}

class DashboardLoaded extends DashboardState {
  const DashboardLoaded({
    required this.kpis,
    required this.activities,
    required this.revenueTrend,
    required this.attendanceTrend,
    required this.memberGrowthTrend,
    required this.platformAnnouncements,
    required this.subscription,
    required this.branches,
    required this.selectedBranchId,
  });

  final DashboardKpis kpis;
  final List<RecentActivity> activities;

  /// Last 30 days — backs the "Revenue Trends" / "Attendance Trends" /
  /// "Member Growth" charts, mirroring web's `ChartsGrid` exactly (same
  /// three `/analytics/*` endpoints, same 30-day window).
  final List<RevenueTrendPoint> revenueTrend;
  final List<TrendPoint> attendanceTrend;
  final List<TrendPoint> memberGrowthTrend;

  /// Super Admin platform notices — tenant-wide by nature, not
  /// branch-scoped (still re-fetched on branch switch for simplicity).
  final List<PlatformAnnouncement> platformAnnouncements;

  /// Null only for a tenant provisioned outside onboarding with no
  /// subscription row at all (a real, non-error state — see
  /// `BillingRepository.currentSubscription`) — "Quick Statistics" then
  /// shows "—" for Plan/Status/Currency instead of throwing.
  final TenantSubscription? subscription;

  /// Every branch the tenant has — the picker only renders when there's
  /// more than one, matching web's `BranchSelector`.
  final List<BranchOption> branches;

  /// Null means "no branch scoping" — only possible with 0-1 branches,
  /// where every field above is the tenant-wide total.
  final String? selectedBranchId;

  @override
  List<Object?> get props => [
        kpis,
        activities,
        revenueTrend,
        attendanceTrend,
        memberGrowthTrend,
        platformAnnouncements,
        subscription,
        branches,
        selectedBranchId,
      ];
}
