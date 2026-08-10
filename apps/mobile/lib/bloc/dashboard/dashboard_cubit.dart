import 'package:flutter_bloc/flutter_bloc.dart';

import '../../core/network/api_exception.dart';
import '../../models/dashboard_kpis.dart';
import '../../models/recent_activity.dart';
import '../../models/revenue_trend_point.dart';
import '../../repositories/dashboard_repository.dart';
import 'dashboard_state.dart';

class DashboardCubit extends Cubit<DashboardState> {
  DashboardCubit(this._repository) : super(const DashboardLoading());

  final DashboardRepository _repository;

  Future<void> load() async {
    emit(const DashboardLoading());
    try {
      // Kick off all three before awaiting any of them — genuine parallel
      // requests, not a type-erased Future.wait.
      final Future<DashboardKpis> kpisFuture = _repository.kpis();
      final Future<List<RecentActivity>> activitiesFuture =
          _repository.recentActivities();
      final Future<List<RevenueTrendPoint>> trendFuture =
          _repository.revenueTrendsLast7Days();
      emit(
        DashboardLoaded(
          kpis: await kpisFuture,
          activities: await activitiesFuture,
          trend: await trendFuture,
        ),
      );
    } on ApiException catch (e) {
      emit(DashboardError(e.message));
    }
  }
}
