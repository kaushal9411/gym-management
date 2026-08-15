import 'package:flutter/material.dart' show DateTimeRange;
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../core/network/api_exception.dart';
import '../../models/branch_option.dart';
import '../../repositories/analytics_repository.dart';
import '../../repositories/branch_repository.dart';
import '../../repositories/finance_repository.dart';
import '../../repositories/reports_repository.dart';
import 'finance_summary_state.dart';

class FinanceSummaryCubit extends Cubit<FinanceSummaryState> {
  FinanceSummaryCubit(
    this._finance,
    this._branches,
    this._analytics,
    this._reports,
  ) : super(const FinanceSummaryLoading());

  final FinanceRepository _finance;
  final BranchRepository _branches;
  final AnalyticsRepository _analytics;
  final ReportsRepository _reports;

  static DateTimeRange get _defaultRange => DateTimeRange(
        start: DateTime.now().subtract(const Duration(days: 29)),
        end: DateTime.now(),
      );

  Future<void> load() async {
    emit(const FinanceSummaryLoading());
    try {
      final branches = await _branches.assignable();
      await _loadScoped(branches, null, _defaultRange);
    } on ApiException catch (e) {
      emit(FinanceSummaryError(e.message));
    }
  }

  /// Re-fetches every widget scoped to a different branch and/or date
  /// range — called by the Finance tab's filter bar.
  Future<void> filter({String? branchId, DateTimeRange? dateRange}) async {
    final current = state;
    if (current is! FinanceSummaryLoaded) return;
    emit(const FinanceSummaryLoading());
    try {
      await _loadScoped(
        current.branches,
        branchId,
        dateRange ?? current.dateRange,
      );
    } on ApiException catch (e) {
      emit(FinanceSummaryError(e.message));
    }
  }

  Future<void> _loadScoped(
    List<BranchOption> branches,
    String? branchId,
    DateTimeRange range,
  ) async {
    // Kick off all four before awaiting any of them — genuine parallel
    // requests, not a type-erased Future.wait.
    final summaryFuture = _finance.summary(branchId: branchId);
    final revenueFuture = _analytics.revenueTrends(
      from: range.start,
      to: range.end,
      branchId: branchId,
    );
    final paymentFuture = _analytics.paymentCollection(
      from: range.start,
      to: range.end,
      branchId: branchId,
    );
    final methodFuture = _reports.revenueByMethod(
      from: range.start,
      to: range.end,
      branchId: branchId,
    );
    emit(
      FinanceSummaryLoaded(
        summary: await summaryFuture,
        revenueTrend: await revenueFuture,
        paymentTrend: await paymentFuture,
        methodBreakdown: await methodFuture,
        branches: branches,
        selectedBranchId: branchId,
        dateRange: range,
      ),
    );
  }
}
