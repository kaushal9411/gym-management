import 'package:equatable/equatable.dart';
import 'package:flutter/material.dart' show DateTimeRange;

import '../../models/branch_option.dart';
import '../../models/finance_summary.dart';
import '../../models/revenue_trend_point.dart';

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
  const FinanceSummaryLoaded({
    required this.summary,
    required this.revenueTrend,
    required this.paymentTrend,
    required this.methodBreakdown,
    required this.branches,
    required this.selectedBranchId,
    required this.dateRange,
  });

  /// Fixed-window figures (today / this month) — unaffected by [dateRange].
  final FinanceSummary summary;

  /// Income vs expenses, filtered by [dateRange]/[selectedBranchId].
  final List<RevenueTrendPoint> revenueTrend;

  /// Collected vs invoiced, filtered by [dateRange]/[selectedBranchId].
  final List<RevenueTrendPoint> paymentTrend;

  final Map<String, double> methodBreakdown;
  final List<BranchOption> branches;
  final String? selectedBranchId;
  final DateTimeRange dateRange;

  @override
  List<Object?> get props => [
        summary,
        revenueTrend,
        paymentTrend,
        methodBreakdown,
        branches,
        selectedBranchId,
        dateRange,
      ];
}
