import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../core/network/api_exception.dart';
import '../../models/report_summary.dart';
import '../../repositories/reports_repository.dart';

sealed class ReportSummaryState extends Equatable {
  const ReportSummaryState();

  @override
  List<Object?> get props => [];
}

class ReportSummaryLoading extends ReportSummaryState {
  const ReportSummaryLoading();
}

class ReportSummaryError extends ReportSummaryState {
  const ReportSummaryError(this.message);

  final String message;

  @override
  List<Object?> get props => [message];
}

/// No `reports:view` or HTTP 403 — the strip hides itself.
class ReportSummaryForbidden extends ReportSummaryState {
  const ReportSummaryForbidden();
}

class ReportSummaryLoaded extends ReportSummaryState {
  const ReportSummaryLoaded(this.data);

  final ReportSummary data;

  @override
  List<Object?> get props => [identityHashCode(data)];
}

/// One cubit for every report screen's summary strip; the screen's filters
/// are passed to [load]. Out-of-order responses (filters changed mid-flight)
/// are dropped via a request counter.
class ReportSummaryCubit extends Cubit<ReportSummaryState> {
  ReportSummaryCubit(this._repo, this.type)
      : super(const ReportSummaryLoading());

  final ReportsRepository _repo;
  final String type;
  int _seq = 0;

  void hide() => emit(const ReportSummaryForbidden());

  Future<void> load(ReportSummaryFilters filters) async {
    final seq = ++_seq;
    emit(const ReportSummaryLoading());
    try {
      final data = await _repo.summary(type, filters);
      if (isClosed || seq != _seq) return;
      emit(ReportSummaryLoaded(data));
    } on ApiException catch (e) {
      if (isClosed || seq != _seq) return;
      emit(
        e.statusCode == 403
            ? const ReportSummaryForbidden()
            : ReportSummaryError(e.message),
      );
    }
  }
}
