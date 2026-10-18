import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../core/network/api_exception.dart';
import '../../models/reports_overview.dart';
import '../../repositories/reports_repository.dart';

sealed class ReportsOverviewState extends Equatable {
  const ReportsOverviewState();

  @override
  List<Object?> get props => [];
}

class ReportsOverviewLoading extends ReportsOverviewState {
  const ReportsOverviewLoading();
}

class ReportsOverviewError extends ReportsOverviewState {
  const ReportsOverviewError(this.message);

  final String message;

  @override
  List<Object?> get props => [message];
}

/// No `reports:view` (checked up front) or HTTP 403 (plan-gated module) —
/// the hub's insights (period bar, KPIs, charts) hide themselves entirely.
class ReportsOverviewForbidden extends ReportsOverviewState {
  const ReportsOverviewForbidden();
}

class ReportsOverviewLoaded extends ReportsOverviewState {
  const ReportsOverviewLoaded(this.data);

  final ReportsOverview data;

  @override
  List<Object?> get props => [identityHashCode(data)];
}

/// Drives the Reports Center insights (`GET /reports/overview`). The screen
/// owns the period / branch controls and passes them to [load]; responses
/// for a superseded request are dropped.
class ReportsOverviewCubit extends Cubit<ReportsOverviewState> {
  ReportsOverviewCubit(this._repo) : super(const ReportsOverviewLoading());

  final ReportsRepository _repo;
  int _seq = 0;

  /// Caller lacks `reports:view` — skip the request entirely.
  void hide() => emit(const ReportsOverviewForbidden());

  /// [from]/[to] are `YYYY-MM-DD` (local days), max 366 days apart.
  Future<void> load({
    required String from,
    required String to,
    String? branchId,
  }) async {
    final seq = ++_seq;
    emit(const ReportsOverviewLoading());
    try {
      final data = await _repo.overview(
        dateFrom: from,
        dateTo: to,
        branchId: branchId,
      );
      if (isClosed || seq != _seq) return;
      emit(ReportsOverviewLoaded(data));
    } on ApiException catch (e) {
      if (isClosed || seq != _seq) return;
      emit(
        e.statusCode == 403
            ? const ReportsOverviewForbidden()
            : ReportsOverviewError(e.message),
      );
    } catch (e) {
      if (isClosed || seq != _seq) return;
      emit(ReportsOverviewError(e.toString()));
    }
  }
}
