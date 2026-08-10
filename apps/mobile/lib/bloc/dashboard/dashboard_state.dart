import 'package:equatable/equatable.dart';

import '../../models/dashboard_kpis.dart';
import '../../models/recent_activity.dart';
import '../../models/revenue_trend_point.dart';

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
    required this.trend,
  });

  final DashboardKpis kpis;
  final List<RecentActivity> activities;
  final List<RevenueTrendPoint> trend;

  @override
  List<Object?> get props => [kpis, activities, trend];
}
