import 'revenue_trend_point.dart';

/// Mirrors `FinanceDashboardDto` (`GET /finance/summary`) — `recentPayments`
/// isn't modeled since the Finance tab (design frame "5. Finance") doesn't show it.
class FinanceSummary {
  const FinanceSummary({
    required this.monthlyIncome,
    required this.monthlyExpenses,
    required this.revenueTrend,
  });

  final double monthlyIncome;
  final double monthlyExpenses;
  final List<RevenueTrendPoint> revenueTrend;

  factory FinanceSummary.fromJson(Map<String, dynamic> json) => FinanceSummary(
        monthlyIncome: double.parse(json['monthlyIncome'] as String),
        monthlyExpenses: double.parse(json['monthlyExpenses'] as String),
        revenueTrend: (json['revenueTrend'] as List)
            .map((e) => RevenueTrendPoint.fromJson(e as Map<String, dynamic>))
            .toList(),
      );
}
