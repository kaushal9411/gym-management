import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../core/network/api_exception.dart';
import '../../models/reports_overview.dart';
import '../../repositories/reports_repository.dart';
import '../finance/payments_analytics_cubit.dart'
    show PaymentsPeriod, PaymentsPeriodX;

sealed class ReportsOverviewState extends Equatable {
  const ReportsOverviewState(this.period);

  final PaymentsPeriod period;

  @override
  List<Object?> get props => [period];
}

class ReportsOverviewLoading extends ReportsOverviewState {
  const ReportsOverviewLoading(super.period);
}

class ReportsOverviewError extends ReportsOverviewState {
  const ReportsOverviewError(super.period, this.message);

  final String message;

  @override
  List<Object?> get props => [period, message];
}

/// No `reports:view` (checked up front) or HTTP 403 — the Insights header
/// hides itself entirely.
class ReportsOverviewForbidden extends ReportsOverviewState {
  const ReportsOverviewForbidden(super.period);
}

class ReportsOverviewLoaded extends ReportsOverviewState {
  const ReportsOverviewLoaded(super.period, this.data);

  final ReportsOverview data;

  @override
  List<Object?> get props => [period, data.range.from, data.range.to];
}

/// Drives the Reports Center "Insights" header. Same shape as
/// `PaymentsAnalyticsCubit`; reuses [PaymentsPeriod] for the chips.
class ReportsOverviewCubit extends Cubit<ReportsOverviewState> {
  ReportsOverviewCubit(this._repo)
      : super(const ReportsOverviewLoading(PaymentsPeriod.thisMonth));

  final ReportsRepository _repo;

  /// Caller lacks `reports:view` — skip the request entirely.
  void hide() => emit(ReportsOverviewForbidden(state.period));

  Future<void> load([PaymentsPeriod? period]) async {
    final p = period ?? state.period;
    emit(ReportsOverviewLoading(p));
    final r = p.range();
    try {
      final data = await _repo.overview(dateFrom: r.from, dateTo: r.to);
      if (isClosed) return;
      emit(ReportsOverviewLoaded(p, data));
    } on ApiException catch (e) {
      if (isClosed) return;
      emit(
        e.statusCode == 403
            ? ReportsOverviewForbidden(p)
            : ReportsOverviewError(p, e.message),
      );
    }
  }
}
