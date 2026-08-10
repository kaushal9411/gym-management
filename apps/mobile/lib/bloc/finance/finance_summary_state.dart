import 'package:equatable/equatable.dart';

import '../../models/finance_summary.dart';

sealed class FinanceSummaryState extends Equatable {
  const FinanceSummaryState();

  @override
  List<Object?> get props => [];
}

class FinanceSummaryLoading extends FinanceSummaryState {
  const FinanceSummaryLoading();
}

class FinanceSummaryError extends FinanceSummaryState {
  const FinanceSummaryError(this.message);

  final String message;

  @override
  List<Object?> get props => [message];
}

class FinanceSummaryLoaded extends FinanceSummaryState {
  const FinanceSummaryLoaded(this.summary);

  final FinanceSummary summary;

  @override
  List<Object?> get props => [summary];
}
