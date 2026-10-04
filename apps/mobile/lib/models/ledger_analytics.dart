import 'expense_entry.dart';
import 'income_entry.dart';
import 'payments_analytics.dart';

/// Income vs Expenses — one analytics model serves both
/// (`GET /income/analytics`, `GET /expenses/analytics`, perm `finance:view`).
/// Money arrives as decimal STRINGS. Parsing is defensive (missing → 0/empty),
/// reusing the helpers of `payments_analytics.dart`.
enum LedgerKind { income, expense }

extension LedgerKindX on LedgerKind {
  String get title => this == LedgerKind.income ? 'Income' : 'Expenses';

  /// Singular noun for counts ("3 entries" works for both).
  String categoryLabel(String api) => this == LedgerKind.income
      ? IncomeCategoryX.fromApi(api).label
      : ExpenseCategoryX.fromApi(api).label;
}

class LedgerLargest {
  const LedgerLargest({
    required this.value,
    required this.description,
    required this.category,
    required this.date,
  });

  final double value;
  final String? description;
  final String category;
  final String date;

  factory LedgerLargest.fromJson(Map<String, dynamic> j) => LedgerLargest(
        value: jsonMoney(j['value']),
        description: j['description'] as String?,
        category: j['category'] as String? ?? '',
        date: j['date'] as String? ?? '',
      );
}

class LedgerKpis {
  const LedgerKpis({
    required this.total,
    required this.count,
    required this.average,
    required this.largest,
    required this.netProfit,
  });

  final ValueVsPrevious total;
  final ValueVsPrevious count;
  final ValueVsPrevious average;
  final LedgerLargest? largest;
  final ValueVsPrevious netProfit;

  factory LedgerKpis.fromJson(Map<String, dynamic> j) {
    final largest = j['largest'];
    return LedgerKpis(
      total: ValueVsPrevious.fromJson(jsonMap(j['total'])),
      count: ValueVsPrevious.fromJson(jsonMap(j['count'])),
      average: ValueVsPrevious.fromJson(jsonMap(j['average'])),
      largest: largest is Map<String, dynamic>
          ? LedgerLargest.fromJson(largest)
          : null,
      netProfit: ValueVsPrevious.fromJson(jsonMap(j['netProfit'])),
    );
  }
}

class LedgerDay {
  const LedgerDay({
    required this.date,
    required this.total,
    required this.count,
    required this.previousTotal,
  });

  final String date;
  final double total;
  final int count;
  final double previousTotal;

  factory LedgerDay.fromJson(Map<String, dynamic> j) => LedgerDay(
        date: j['date'] as String? ?? '',
        total: jsonMoney(j['total']),
        count: jsonInt(j['count']),
        previousTotal: jsonMoney(j['previousTotal']),
      );
}

class LedgerCategory {
  const LedgerCategory({
    required this.category,
    required this.amount,
    required this.count,
    required this.previousAmount,
  });

  final String category;
  final double amount;
  final int count;
  final double previousAmount;

  /// Percent change vs previous; null without a baseline.
  double? get deltaPercent => previousAmount > 0
      ? (amount - previousAmount) / previousAmount * 100
      : null;

  factory LedgerCategory.fromJson(Map<String, dynamic> j) => LedgerCategory(
        category: j['category'] as String? ?? '',
        amount: jsonMoney(j['amount']),
        count: jsonInt(j['count']),
        previousAmount: jsonMoney(j['previousAmount']),
      );
}

class LedgerBranch {
  const LedgerBranch({
    required this.branchId,
    required this.name,
    required this.total,
    required this.previousTotal,
  });

  final String branchId;
  final String name;
  final double total;
  final double previousTotal;

  factory LedgerBranch.fromJson(Map<String, dynamic> j) => LedgerBranch(
        branchId: j['branchId'] as String? ?? '',
        name: j['name'] as String? ?? '',
        total: jsonMoney(j['total']),
        previousTotal: jsonMoney(j['previousTotal']),
      );
}

class LedgerTopEntry {
  const LedgerTopEntry({
    required this.id,
    required this.description,
    required this.category,
    required this.amount,
    required this.date,
  });

  final String id;
  final String? description;
  final String category;
  final double amount;
  final String date;

  factory LedgerTopEntry.fromJson(Map<String, dynamic> j) => LedgerTopEntry(
        id: j['id'] as String? ?? '',
        description: j['description'] as String?,
        category: j['category'] as String? ?? '',
        amount: jsonMoney(j['amount']),
        date: j['date'] as String? ?? '',
      );
}

class LedgerAnalytics {
  const LedgerAnalytics({
    required this.range,
    required this.previousRange,
    required this.kpis,
    required this.daily,
    required this.categories,
    required this.branches,
    required this.topEntries,
  });

  final AnalyticsRange range;
  final AnalyticsRange previousRange;
  final LedgerKpis kpis;
  final List<LedgerDay> daily;
  final List<LedgerCategory> categories;
  final List<LedgerBranch> branches;
  final List<LedgerTopEntry> topEntries;

  factory LedgerAnalytics.fromJson(Map<String, dynamic> j) => LedgerAnalytics(
        range: AnalyticsRange.fromJson(jsonMap(j['range'])),
        previousRange: AnalyticsRange.fromJson(jsonMap(j['previousRange'])),
        kpis: LedgerKpis.fromJson(jsonMap(j['kpis'])),
        daily: jsonList(j['daily']).map(LedgerDay.fromJson).toList(),
        categories:
            jsonList(j['categories']).map(LedgerCategory.fromJson).toList(),
        branches: jsonList(j['branches']).map(LedgerBranch.fromJson).toList(),
        topEntries:
            jsonList(j['topEntries']).map(LedgerTopEntry.fromJson).toList(),
      );
}

/// `summary` on `GET /income` / `GET /expenses` — covers the whole filtered
/// set, not just the loaded page.
class LedgerListSummary {
  const LedgerListSummary({
    required this.total,
    required this.count,
    required this.average,
  });

  final double total;
  final int count;
  final double average;

  factory LedgerListSummary.fromJson(Map<String, dynamic> j) =>
      LedgerListSummary(
        total: jsonMoney(j['total']),
        count: jsonInt(j['count']),
        average: jsonMoney(j['average']),
      );
}
