import 'revenue_trend_point.dart';

/// Mirrors `FinanceDashboardDto` (`GET /finance/summary`) — `recentPayments`
/// isn't modeled since the Finance tab shows aggregates/charts only, never
/// a transaction list.
class FinanceSummary {
  const FinanceSummary({
    required this.todayIncome,
    required this.monthlyIncome,
    required this.monthlyExpenses,
    required this.outstandingPayments,
    required this.outstandingInvoiceCount,
    required this.revenueTrend,
  });

  final double todayIncome;
  final double monthlyIncome;
  final double monthlyExpenses;
  final double outstandingPayments;
  final int outstandingInvoiceCount;
  final List<RevenueTrendPoint> revenueTrend;

  factory FinanceSummary.fromJson(Map<String, dynamic> json) => FinanceSummary(
        todayIncome: double.parse(json['todayIncome'] as String),
        monthlyIncome: double.parse(json['monthlyIncome'] as String),
        monthlyExpenses: double.parse(json['monthlyExpenses'] as String),
        outstandingPayments:
            double.parse(json['outstandingPayments'] as String),
        outstandingInvoiceCount: json['outstandingInvoiceCount'] as int? ?? 0,
        revenueTrend: (json['revenueTrend'] as List)
            .map((e) => RevenueTrendPoint.fromJson(e as Map<String, dynamic>))
            .toList(),
      );
}
