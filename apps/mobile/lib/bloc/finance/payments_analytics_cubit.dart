import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../core/network/api_exception.dart';
import '../../models/payments_analytics.dart';
import '../../repositories/payment_repository.dart';

/// Period chips above the Payments analytics header. Ranges are UTC days
/// (the API buckets by UTC day) and always end today, except lastMonth.
///
/// Web's sixth chip, "Custom", is not an enum value (other cubits switch over
/// this enum): the Payments screen keeps a custom `(from, to)` pair next to
/// it and passes it straight to [PaymentsAnalyticsCubit.load].
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
  const PaymentsAnalyticsState();

  @override
  List<Object?> get props => [];
}

class PaymentsAnalyticsLoading extends PaymentsAnalyticsState {
  const PaymentsAnalyticsLoading();
}

class PaymentsAnalyticsError extends PaymentsAnalyticsState {
  const PaymentsAnalyticsError(this.message);

  final String message;

  @override
  List<Object?> get props => [message];
}

/// The caller lacks `finance:view` (HTTP 403) — the insights hide themselves
/// instead of showing an error.
class PaymentsAnalyticsForbidden extends PaymentsAnalyticsState {
  const PaymentsAnalyticsForbidden();
}

class PaymentsAnalyticsLoaded extends PaymentsAnalyticsState {
  const PaymentsAnalyticsLoaded(this.data);

  final PaymentsAnalytics data;

  @override
  List<Object?> get props => [data.range.from, data.range.to];
}

class PaymentsAnalyticsCubit extends Cubit<PaymentsAnalyticsState> {
  PaymentsAnalyticsCubit(this._repo) : super(const PaymentsAnalyticsLoading());

  final PaymentRepository _repo;

  /// Caller lacks `finance:view` — skip the request entirely.
  void hide() => emit(const PaymentsAnalyticsForbidden());

  /// Loads the analytics for `[from, to]` (UTC `YYYY-MM-DD` days; the API
  /// rejects ranges over 366 days) and an optional branch. [silent] keeps the
  /// current figures on screen while refreshing.
  Future<void> load({
    required String from,
    required String to,
    String? branchId,
    bool silent = false,
  }) async {
    if (!silent || state is! PaymentsAnalyticsLoaded) {
      emit(const PaymentsAnalyticsLoading());
    }
    try {
      final data = await _repo.analytics(
        dateFrom: from,
        dateTo: to,
        branchId: branchId,
      );
      if (isClosed) return;
      emit(PaymentsAnalyticsLoaded(data));
    } on ApiException catch (e) {
      if (isClosed) return;
      emit(
        e.statusCode == 403
            ? const PaymentsAnalyticsForbidden()
            : PaymentsAnalyticsError(e.detailedMessage),
      );
    } catch (e) {
      if (isClosed) return;
      emit(PaymentsAnalyticsError('Could not load analytics ($e)'));
    }
  }
}
