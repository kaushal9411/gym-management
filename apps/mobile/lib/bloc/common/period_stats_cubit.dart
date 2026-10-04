import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../core/network/api_exception.dart';
import '../finance/payments_analytics_cubit.dart'
    show PaymentsPeriod, PaymentsPeriodX;

typedef PeriodStatsFetcher<T> = Future<T> Function({
  required String dateFrom,
  required String dateTo,
});

sealed class PeriodStatsState<T> extends Equatable {
  const PeriodStatsState(this.period);

  final PaymentsPeriod period;

  @override
  List<Object?> get props => [period];
}

class PeriodStatsLoading<T> extends PeriodStatsState<T> {
  const PeriodStatsLoading(super.period);
}

class PeriodStatsError<T> extends PeriodStatsState<T> {
  const PeriodStatsError(super.period, this.message);

  final String message;

  @override
  List<Object?> get props => [period, message];
}

/// No view permission (checked up front) or HTTP 403 — the insights block
/// hides itself instead of showing an error.
class PeriodStatsForbidden<T> extends PeriodStatsState<T> {
  const PeriodStatsForbidden(super.period);
}

class PeriodStatsLoaded<T> extends PeriodStatsState<T> {
  const PeriodStatsLoaded(super.period, this.data);

  final T data;

  @override
  List<Object?> get props => [period, data];
}

/// One cubit for any "stats for a period" endpoint (the Notifications and
/// Announcements insights headers); the screen injects the repository call.
/// Same Loading/Loaded/Error/Forbidden contract as `LedgerAnalyticsCubit`
/// and reuses [PaymentsPeriod] (Today/7 days/This month/Last month/90 days).
class PeriodStatsCubit<T> extends Cubit<PeriodStatsState<T>> {
  PeriodStatsCubit(this._fetch)
      : super(PeriodStatsLoading<T>(PaymentsPeriod.thisMonth));

  final PeriodStatsFetcher<T> _fetch;

  /// Caller lacks the view permission — skip the request entirely.
  void hide() => emit(PeriodStatsForbidden<T>(state.period));

  /// [silent] keeps the current data on screen while re-fetching (used after
  /// a mutation so the header doesn't flash a spinner); errors are then
  /// swallowed in favour of the stale numbers.
  Future<void> load([PaymentsPeriod? period, bool silent = false]) async {
    final p = period ?? state.period;
    final keep = silent && state is PeriodStatsLoaded<T>;
    if (!keep) emit(PeriodStatsLoading<T>(p));
    final r = p.range();
    try {
      final data = await _fetch(dateFrom: r.from, dateTo: r.to);
      if (isClosed) return;
      emit(PeriodStatsLoaded<T>(p, data));
    } on ApiException catch (e) {
      if (isClosed || keep) return;
      emit(
        e.statusCode == 403
            ? PeriodStatsForbidden<T>(p)
            : PeriodStatsError<T>(p, e.message),
      );
    }
  }
}
