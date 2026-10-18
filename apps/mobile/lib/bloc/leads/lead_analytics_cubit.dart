import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../core/network/api_exception.dart';
import '../../models/lead_analytics.dart';

/// Dashboard range chips -> the API's `range` param. [custom] additionally
/// needs a `YYYY-MM-DD` from/to pair (the API caps it at 366 days).
enum LeadRange {
  today('today', 'Today'),
  days7('7d', '7D'),
  days30('30d', '30D'),
  month('month', 'Month'),
  year('year', 'Year'),
  custom('custom', 'Custom');

  const LeadRange(this.api, this.label);

  final String api;
  final String label;
}

sealed class LeadAnalyticsState extends Equatable {
  const LeadAnalyticsState(this.range, {this.from, this.to});

  final LeadRange range;

  /// Only meaningful for [LeadRange.custom] (`YYYY-MM-DD`).
  final String? from;
  final String? to;

  @override
  List<Object?> get props => [range, from, to];
}

class LeadAnalyticsLoading extends LeadAnalyticsState {
  const LeadAnalyticsLoading(super.range, {super.from, super.to});
}

class LeadAnalyticsError extends LeadAnalyticsState {
  const LeadAnalyticsError(
    super.range,
    this.message, {
    super.from,
    super.to,
  });

  final String message;

  @override
  List<Object?> get props => [range, from, to, message];
}

class LeadAnalyticsLoaded extends LeadAnalyticsState {
  const LeadAnalyticsLoaded(super.range, this.data, {super.from, super.to});

  final LeadAnalytics data;

  @override
  List<Object?> get props => [range, from, to, data];
}

class LeadAnalyticsCubit extends Cubit<LeadAnalyticsState> {
  LeadAnalyticsCubit(this._fetch)
      : super(const LeadAnalyticsLoading(LeadRange.days30));

  final Future<LeadAnalytics> Function(
    String range,
    String? dateFrom,
    String? dateTo,
  ) _fetch;

  /// [silent] keeps the current numbers on screen (pull-to-refresh).
  /// [from]/[to] (`YYYY-MM-DD`) apply to [LeadRange.custom]; omitted, the
  /// previously chosen custom window is reused.
  Future<void> load([
    LeadRange? range,
    bool silent = false,
    String? from,
    String? to,
  ]) async {
    final r = range ?? state.range;
    final f = r == LeadRange.custom ? (from ?? state.from) : null;
    final t = r == LeadRange.custom ? (to ?? state.to) : null;
    final keep = silent &&
        state is LeadAnalyticsLoaded &&
        r == state.range &&
        f == state.from &&
        t == state.to;
    if (!keep) emit(LeadAnalyticsLoading(r, from: f, to: t));
    try {
      final data = await _fetch(r.api, f, t);
      if (isClosed) return;
      emit(LeadAnalyticsLoaded(r, data, from: f, to: t));
    } on ApiException catch (e) {
      if (isClosed || keep) return;
      emit(LeadAnalyticsError(r, e.message, from: f, to: t));
    } on Object {
      if (isClosed || keep) return;
      emit(
        LeadAnalyticsError(
          r,
          'Could not load leads analytics.',
          from: f,
          to: t,
        ),
      );
    }
  }
}
