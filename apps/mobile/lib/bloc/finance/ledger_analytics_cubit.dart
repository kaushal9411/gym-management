import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../core/network/api_exception.dart';
import '../../models/ledger_analytics.dart';
import 'payments_analytics_cubit.dart' show PaymentsPeriod, PaymentsPeriodX;

typedef LedgerAnalyticsFetcher = Future<LedgerAnalytics> Function({
  required String dateFrom,
  required String dateTo,
});

sealed class LedgerAnalyticsState extends Equatable {
  const LedgerAnalyticsState(this.period);

  final PaymentsPeriod period;

  @override
  List<Object?> get props => [period];
}

class LedgerAnalyticsLoading extends LedgerAnalyticsState {
  const LedgerAnalyticsLoading(super.period);
}

class LedgerAnalyticsError extends LedgerAnalyticsState {
  const LedgerAnalyticsError(super.period, this.message);

  final String message;

  @override
  List<Object?> get props => [period, message];
}

/// No `finance:view` (checked up front) or HTTP 403 — header hides itself.
class LedgerAnalyticsForbidden extends LedgerAnalyticsState {
  const LedgerAnalyticsForbidden(super.period);
}

class LedgerAnalyticsLoaded extends LedgerAnalyticsState {
  const LedgerAnalyticsLoaded(super.period, this.data);

  final LedgerAnalytics data;

  @override
  List<Object?> get props => [period, data.range.from, data.range.to];
}

/// One cubit for Income and Expenses; the screen injects the repository
/// call. Reuses [PaymentsPeriod] (Today/7 days/This month/Last month/90 days).
class LedgerAnalyticsCubit extends Cubit<LedgerAnalyticsState> {
  LedgerAnalyticsCubit(this._fetch)
      : super(const LedgerAnalyticsLoading(PaymentsPeriod.thisMonth));

  final LedgerAnalyticsFetcher _fetch;

  void hide() => emit(LedgerAnalyticsForbidden(state.period));

  Future<void> load([PaymentsPeriod? period]) async {
    final p = period ?? state.period;
    emit(LedgerAnalyticsLoading(p));
    final r = p.range();
    try {
      final data = await _fetch(dateFrom: r.from, dateTo: r.to);
      if (isClosed) return;
      emit(LedgerAnalyticsLoaded(p, data));
    } on ApiException catch (e) {
      if (isClosed) return;
      emit(
        e.statusCode == 403
            ? LedgerAnalyticsForbidden(p)
            : LedgerAnalyticsError(p, e.message),
      );
    }
  }
}
