import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../core/errors/app_exception.dart';
import '../../data/dashboard_models.dart';
import '../../data/dashboard_repository.dart';

sealed class DashboardState {
  const DashboardState();
}

class DashboardLoading extends DashboardState {
  const DashboardLoading();
}

class DashboardLoaded extends DashboardState {
  final DashboardKpis kpis;
  final List<Announcement> announcements;
  final List<RecentActivity> recentActivities;
  final List<RevenueTrendPoint> revenueTrend;

  const DashboardLoaded(
    this.kpis,
    this.announcements,
    this.recentActivities,
    this.revenueTrend,
  );
}

class DashboardError extends DashboardState {
  final String message;
  const DashboardError(this.message);
}

class DashboardCubit extends Cubit<DashboardState> {
  final DashboardRepository _repository;
  DashboardCubit(this._repository) : super(const DashboardLoading());

  Future<void> load() async {
    emit(const DashboardLoading());
    try {
      final results = await Future.wait([
        _repository.fetchKpis(),
        _repository.fetchActiveAnnouncements(),
        _repository.fetchRecentActivities(),
        _repository.fetchRevenueTrend(),
      ]);
      emit(
        DashboardLoaded(
          results[0] as DashboardKpis,
          results[1] as List<Announcement>,
          results[2] as List<RecentActivity>,
          results[3] as List<RevenueTrendPoint>,
        ),
      );
    } on AppException catch (e) {
      emit(DashboardError(e.message));
    }
  }
}
