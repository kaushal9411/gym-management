import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../core/network/api_exception.dart';
import '../../models/lead_analytics.dart';

/// Dashboard range chips -> the API's `range` param.
enum LeadRange {
  today('today', 'Today'),
  days7('7d', '7D'),
  days30('30d', '30D'),
  month('month', 'Month'),
  year('year', 'Year');

  const LeadRange(this.api, this.label);

  final String api;
  final String label;
}

sealed class LeadAnalyticsState extends Equatable {
  const LeadAnalyticsState(this.range);

  final LeadRange range;

  @override
  List<Object?> get props => [range];
}

class LeadAnalyticsLoading extends LeadAnalyticsState {
  const LeadAnalyticsLoading(super.range);
}

class LeadAnalyticsError extends LeadAnalyticsState {
  const LeadAnalyticsError(super.range, this.message);

  final String message;

  @override
  List<Object?> get props => [range, message];
}

class LeadAnalyticsLoaded extends LeadAnalyticsState {
  const LeadAnalyticsLoaded(super.range, this.data);

  final LeadAnalytics data;

  @override
  List<Object?> get props => [range, data];
}

class LeadAnalyticsCubit extends Cubit<LeadAnalyticsState> {
  LeadAnalyticsCubit(this._fetch)
      : super(const LeadAnalyticsLoading(LeadRange.days30));

  final Future<LeadAnalytics> Function(String range) _fetch;

  /// [silent] keeps the current numbers on screen (pull-to-refresh).
  Future<void> load([LeadRange? range, bool silent = false]) async {
    final r = range ?? state.range;
    final keep = silent && state is LeadAnalyticsLoaded && r == state.range;
    if (!keep) emit(LeadAnalyticsLoading(r));
    try {
      final data = await _fetch(r.api);
      if (isClosed) return;
      emit(LeadAnalyticsLoaded(r, data));
    } on ApiException catch (e) {
      if (isClosed || keep) return;
      emit(LeadAnalyticsError(r, e.message));
    }
  }
}
