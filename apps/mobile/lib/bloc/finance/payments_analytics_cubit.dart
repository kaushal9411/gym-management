import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../core/network/api_exception.dart';
import '../../models/payments_analytics.dart';
import '../../repositories/payment_repository.dart';

/// Period chips above the Payments analytics header. Ranges are UTC days
/// (the API buckets by UTC day) and always end today, except lastMonth.
enum PaymentsPeriod { today, days7, thisMonth, lastMonth, days90 }

extension PaymentsPeriodX on PaymentsPeriod {
  String get label => switch (this) {
        PaymentsPeriod.today => 'Today',
        PaymentsPeriod.days7 => '7 days',
        PaymentsPeriod.thisMonth => 'This month',
        PaymentsPeriod.lastMonth => 'Last month',
        PaymentsPeriod.days90 => '90 days',
      };

  /// `(from, to)` as `YYYY-MM-DD`.
  ({String from, String to}) range([DateTime? now]) {
    final n = (now ?? DateTime.now()).toUtc();
    final today = DateTime.utc(n.year, n.month, n.day);
    String fmt(DateTime d) => '${d.year.toString().padLeft(4, '0')}-'
        '${d.month.toString().padLeft(2, '0')}-'
        '${d.day.toString().padLeft(2, '0')}';
    switch (this) {
      case PaymentsPeriod.today:
        return (from: fmt(today), to: fmt(today));
      case PaymentsPeriod.days7:
        return (
          from: fmt(today.subtract(const Duration(days: 6))),
          to: fmt(today),
        );
      case PaymentsPeriod.thisMonth:
        return (from: fmt(DateTime.utc(n.year, n.month)), to: fmt(today));
      case PaymentsPeriod.lastMonth:
        final first = DateTime.utc(n.year, n.month - 1);
        final last = DateTime.utc(n.year, n.month).subtract(
          const Duration(days: 1),
        );
        return (from: fmt(first), to: fmt(last));
      case PaymentsPeriod.days90:
        return (
          from: fmt(today.subtract(const Duration(days: 89))),
          to: fmt(today),
        );
    }
  }
}

sealed class PaymentsAnalyticsState extends Equatable {
  const PaymentsAnalyticsState(this.period);

  final PaymentsPeriod period;

  @override
  List<Object?> get props => [period];
}

class PaymentsAnalyticsLoading extends PaymentsAnalyticsState {
  const PaymentsAnalyticsLoading(super.period);
}

class PaymentsAnalyticsError extends PaymentsAnalyticsState {
  const PaymentsAnalyticsError(super.period, this.message);

  final String message;

  @override
  List<Object?> get props => [period, message];
}

/// The caller lacks `finance:view` (HTTP 403) — the header hides itself
/// instead of showing an error.
class PaymentsAnalyticsForbidden extends PaymentsAnalyticsState {
  const PaymentsAnalyticsForbidden(super.period);
}

class PaymentsAnalyticsLoaded extends PaymentsAnalyticsState {
  const PaymentsAnalyticsLoaded(super.period, this.data);

  final PaymentsAnalytics data;

  @override
  List<Object?> get props => [period, data.range.from, data.range.to];
}

class PaymentsAnalyticsCubit extends Cubit<PaymentsAnalyticsState> {
  PaymentsAnalyticsCubit(this._repo)
      : super(const PaymentsAnalyticsLoading(PaymentsPeriod.thisMonth));

  final PaymentRepository _repo;

  /// Caller lacks `finance:view` — skip the request entirely.
  void hide() => emit(PaymentsAnalyticsForbidden(state.period));

  Future<void> load([PaymentsPeriod? period]) async {
    final p = period ?? state.period;
    emit(PaymentsAnalyticsLoading(p));
    final r = p.range();
    try {
      final data = await _repo.analytics(dateFrom: r.from, dateTo: r.to);
      if (isClosed) return;
      emit(PaymentsAnalyticsLoaded(p, data));
    } on ApiException catch (e) {
      if (isClosed) return;
      emit(
        e.statusCode == 403
            ? PaymentsAnalyticsForbidden(p)
            : PaymentsAnalyticsError(p, e.message),
      );
    }
  }
}
