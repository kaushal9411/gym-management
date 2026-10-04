/// Mirrors `PaymentsAnalyticsDto` (`GET /payments/analytics`, perm
/// `finance:view`). Money arrives as decimal STRINGS; `rate`/`successRate`
/// are plain numbers 0..1. Parsing is defensive — a missing or malformed
/// field degrades to 0/empty rather than throwing, so one odd value can't
/// blank the whole analytics header.
double jsonMoney(Object? v) {
  if (v is num) return v.toDouble();
  if (v is String) return double.tryParse(v) ?? 0;
  return 0;
}

int jsonInt(Object? v) {
  if (v is num) return v.toInt();
  if (v is String) return int.tryParse(v) ?? 0;
  return 0;
}

Map<String, dynamic> jsonMap(Object? v) =>
    v is Map<String, dynamic> ? v : const <String, dynamic>{};

List<Map<String, dynamic>> jsonList(Object? v) =>
    v is List ? v.whereType<Map<String, dynamic>>().toList() : const [];

class AnalyticsRange {
  const AnalyticsRange({required this.from, required this.to});

  final String from;
  final String to;

  factory AnalyticsRange.fromJson(Map<String, dynamic> j) => AnalyticsRange(
        from: j['from'] as String? ?? '',
        to: j['to'] as String? ?? '',
      );
}

class ValueVsPrevious {
  const ValueVsPrevious({required this.value, required this.previous});

  final double value;
  final double previous;

  /// Percent change vs the previous period; null when there's no baseline
  /// to compare against (previous == 0) — never a fabricated "+100%".
  double? get deltaPercent =>
      previous > 0 ? (value - previous) / previous * 100 : null;

  factory ValueVsPrevious.fromJson(Map<String, dynamic> j) => ValueVsPrevious(
        value: jsonMoney(j['value']),
        previous: jsonMoney(j['previous']),
      );
}

class PaymentsKpis {
  const PaymentsKpis({
    required this.collected,
    required this.todayCollected,
    required this.todayCount,
    required this.outstanding,
    required this.outstandingInvoiceCount,
    required this.refunded,
    required this.refundedCount,
    required this.refundRate,
    required this.avgPayment,
    required this.paymentCount,
    required this.successRate,
  });

  final ValueVsPrevious collected;
  final double todayCollected;
  final int todayCount;
  final double outstanding;
  final int outstandingInvoiceCount;
  final ValueVsPrevious refunded;
  final int refundedCount;
  final double refundRate;
  final ValueVsPrevious avgPayment;
  final ({int value, int previous}) paymentCount;
  final ({double value, double previous}) successRate;

  factory PaymentsKpis.fromJson(Map<String, dynamic> j) {
    final today = jsonMap(j['todayCollected']);
    final outstanding = jsonMap(j['outstanding']);
    final refunded = jsonMap(j['refunded']);
    final count = jsonMap(j['paymentCount']);
    final success = jsonMap(j['successRate']);
    return PaymentsKpis(
      collected: ValueVsPrevious.fromJson(jsonMap(j['collected'])),
      todayCollected: jsonMoney(today['value']),
      todayCount: jsonInt(today['count']),
      outstanding: jsonMoney(outstanding['value']),
      outstandingInvoiceCount: jsonInt(outstanding['invoiceCount']),
      refunded: ValueVsPrevious.fromJson(refunded),
      refundedCount: jsonInt(refunded['count']),
      refundRate: jsonMoney(refunded['rate']),
      avgPayment: ValueVsPrevious.fromJson(jsonMap(j['avgPayment'])),
      paymentCount: (
        value: jsonInt(count['value']),
        previous: jsonInt(count['previous']),
      ),
      successRate: (
        value: jsonMoney(success['value']),
        previous: jsonMoney(success['previous']),
      ),
    );
  }
}

class AnalyticsDay {
  const AnalyticsDay({
    required this.date,
    required this.collected,
    required this.refunded,
    required this.count,
    required this.previousCollected,
  });

  final String date;
  final double collected;
  final double refunded;
  final int count;
  final double previousCollected;

  factory AnalyticsDay.fromJson(Map<String, dynamic> j) => AnalyticsDay(
        date: j['date'] as String? ?? '',
        collected: jsonMoney(j['collected']),
        refunded: jsonMoney(j['refunded']),
        count: jsonInt(j['count']),
        previousCollected: jsonMoney(j['previousCollected']),
      );
}

class AnalyticsMethod {
  const AnalyticsMethod({
    required this.method,
    required this.amount,
    required this.count,
  });

  final String method;
  final double amount;
  final int count;

  factory AnalyticsMethod.fromJson(Map<String, dynamic> j) => AnalyticsMethod(
        method: j['method'] as String? ?? '',
        amount: jsonMoney(j['amount']),
        count: jsonInt(j['count']),
      );
}

class AnalyticsStatus {
  const AnalyticsStatus({required this.status, required this.count});

  final String status;
  final int count;

  factory AnalyticsStatus.fromJson(Map<String, dynamic> j) => AnalyticsStatus(
        status: j['status'] as String? ?? '',
        count: jsonInt(j['count']),
      );
}

class AnalyticsBranch {
  const AnalyticsBranch({
    required this.branchId,
    required this.name,
    required this.revenue,
    required this.previousRevenue,
  });

  final String branchId;
  final String name;
  final double revenue;
  final double previousRevenue;

  factory AnalyticsBranch.fromJson(Map<String, dynamic> j) => AnalyticsBranch(
        branchId: j['branchId'] as String? ?? '',
        name: j['name'] as String? ?? '',
        revenue: jsonMoney(j['revenue']),
        previousRevenue: jsonMoney(j['previousRevenue']),
      );
}

class AnalyticsPlan {
  const AnalyticsPlan({
    required this.planName,
    required this.revenue,
    required this.count,
  });

  final String planName;
  final double revenue;
  final int count;

  factory AnalyticsPlan.fromJson(Map<String, dynamic> j) => AnalyticsPlan(
        planName: j['planName'] as String? ?? '',
        revenue: jsonMoney(j['revenue']),
        count: jsonInt(j['count']),
      );
}

class PaymentsAttention {
  const PaymentsAttention({
    required this.pendingOver24h,
    required this.failed,
    required this.overdueCount,
    required this.overdueAmount,
  });

  final int pendingOver24h;
  final int failed;
  final int overdueCount;
  final double overdueAmount;

  bool get isClear => pendingOver24h == 0 && failed == 0 && overdueCount == 0;

  factory PaymentsAttention.fromJson(Map<String, dynamic> j) {
    final overdue = jsonMap(j['overdueInvoices']);
    return PaymentsAttention(
      pendingOver24h: jsonInt(j['pendingOver24h']),
      failed: jsonInt(j['failed']),
      overdueCount: jsonInt(overdue['count']),
      overdueAmount: jsonMoney(overdue['amount']),
    );
  }
}

class PaymentsAnalytics {
  const PaymentsAnalytics({
    required this.range,
    required this.previousRange,
    required this.kpis,
    required this.daily,
    required this.methods,
    required this.statuses,
    required this.branches,
    required this.topPlans,
    required this.attention,
  });

  final AnalyticsRange range;
  final AnalyticsRange previousRange;
  final PaymentsKpis kpis;
  final List<AnalyticsDay> daily;
  final List<AnalyticsMethod> methods;
  final List<AnalyticsStatus> statuses;
  final List<AnalyticsBranch> branches;
  final List<AnalyticsPlan> topPlans;
  final PaymentsAttention attention;

  factory PaymentsAnalytics.fromJson(Map<String, dynamic> j) =>
      PaymentsAnalytics(
        range: AnalyticsRange.fromJson(jsonMap(j['range'])),
        previousRange: AnalyticsRange.fromJson(jsonMap(j['previousRange'])),
        kpis: PaymentsKpis.fromJson(jsonMap(j['kpis'])),
        daily: jsonList(j['daily']).map(AnalyticsDay.fromJson).toList(),
        methods: jsonList(j['methods']).map(AnalyticsMethod.fromJson).toList(),
        statuses: jsonList(j['statuses']).map(AnalyticsStatus.fromJson).toList(),
        branches: jsonList(j['branches']).map(AnalyticsBranch.fromJson).toList(),
        topPlans: jsonList(j['topPlans']).map(AnalyticsPlan.fromJson).toList(),
        attention: PaymentsAttention.fromJson(jsonMap(j['attention'])),
      );
}
