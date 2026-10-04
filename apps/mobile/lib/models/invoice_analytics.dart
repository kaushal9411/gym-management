import 'payments_analytics.dart';

/// Mirrors the invoice analytics DTO (`GET /invoices/analytics`, perm
/// `finance:invoice-view`). Money arrives as decimal STRINGS, counts as
/// numbers, `collectionRate` as a 0..1 ratio. Parsing is defensive (missing
/// block -> 0/empty) via the public helpers of `payments_analytics.dart`.
///
/// Only invoiced / count / collected / avg / collectionRate, the trend and
/// the status split follow the period chips; outstanding, overdue, ageing
/// and top debtors are current-state receivables.
class InvoiceAnalytics {
  const InvoiceAnalytics({
    required this.range,
    required this.previousRange,
    required this.invoiced,
    required this.count,
    required this.collected,
    required this.avgInvoice,
    required this.collectionRate,
    required this.outstanding,
    required this.outstandingInvoiceCount,
    required this.overdue,
    required this.overdueCount,
    required this.daily,
    required this.byStatus,
    required this.aging,
    required this.topDebtors,
    required this.branches,
  });

  final AnalyticsRange range;
  final AnalyticsRange previousRange;
  final ValueVsPrevious invoiced;
  final ValueVsPrevious count;
  final ValueVsPrevious collected;
  final ValueVsPrevious avgInvoice;
  final ValueVsPrevious collectionRate;
  final double outstanding;
  final int outstandingInvoiceCount;
  final double overdue;
  final int overdueCount;
  final List<InvoiceDay> daily;
  final List<InvoiceStatusStat> byStatus;
  final List<InvoiceAgingBucket> aging;
  final List<InvoiceDebtor> topDebtors;
  final List<InvoiceBranchStat> branches;

  factory InvoiceAnalytics.fromJson(Map<String, dynamic> j) {
    final k = jsonMap(j['kpis']);
    final out = jsonMap(k['outstanding']);
    final od = jsonMap(k['overdue']);
    return InvoiceAnalytics(
      range: AnalyticsRange.fromJson(jsonMap(j['range'])),
      previousRange: AnalyticsRange.fromJson(jsonMap(j['previousRange'])),
      invoiced: ValueVsPrevious.fromJson(jsonMap(k['invoiced'])),
      count: ValueVsPrevious.fromJson(jsonMap(k['count'])),
      collected: ValueVsPrevious.fromJson(jsonMap(k['collected'])),
      avgInvoice: ValueVsPrevious.fromJson(jsonMap(k['avgInvoice'])),
      collectionRate: ValueVsPrevious.fromJson(jsonMap(k['collectionRate'])),
      outstanding: jsonMoney(out['value']),
      outstandingInvoiceCount: jsonInt(out['invoiceCount']),
      overdue: jsonMoney(od['value']),
      overdueCount: jsonInt(od['count']),
      daily: jsonList(j['daily']).map(InvoiceDay.fromJson).toList(),
      byStatus:
          jsonList(j['byStatus']).map(InvoiceStatusStat.fromJson).toList(),
      aging: jsonList(j['aging']).map(InvoiceAgingBucket.fromJson).toList(),
      topDebtors:
          jsonList(j['topDebtors']).map(InvoiceDebtor.fromJson).toList(),
      branches:
          jsonList(j['branches']).map(InvoiceBranchStat.fromJson).toList(),
    );
  }
}

class InvoiceDay {
  const InvoiceDay({
    required this.date,
    required this.invoiced,
    required this.count,
    required this.previousInvoiced,
  });

  final String date;
  final double invoiced;
  final int count;
  final double previousInvoiced;

  factory InvoiceDay.fromJson(Map<String, dynamic> j) => InvoiceDay(
        date: j['date'] as String? ?? '',
        invoiced: jsonMoney(j['invoiced']),
        count: jsonInt(j['count']),
        previousInvoiced: jsonMoney(j['previousInvoiced']),
      );
}

class InvoiceStatusStat {
  const InvoiceStatusStat({
    required this.status,
    required this.count,
    required this.amount,
  });

  final String status;
  final int count;
  final double amount;

  factory InvoiceStatusStat.fromJson(Map<String, dynamic> j) =>
      InvoiceStatusStat(
        status: j['status'] as String? ?? '',
        count: jsonInt(j['count']),
        amount: jsonMoney(j['amount']),
      );
}

/// `bucket` is one of 'Current', '1-30', '31-60', '61-90', '90+'.
class InvoiceAgingBucket {
  const InvoiceAgingBucket({
    required this.bucket,
    required this.count,
    required this.amount,
  });

  final String bucket;
  final int count;
  final double amount;

  factory InvoiceAgingBucket.fromJson(Map<String, dynamic> j) =>
      InvoiceAgingBucket(
        bucket: j['bucket'] as String? ?? '',
        count: jsonInt(j['count']),
        amount: jsonMoney(j['amount']),
      );
}

class InvoiceDebtor {
  const InvoiceDebtor({
    required this.memberId,
    required this.memberCode,
    required this.name,
    required this.outstanding,
    required this.invoiceCount,
  });

  final String memberId;
  final String memberCode;
  final String name;
  final double outstanding;
  final int invoiceCount;

  factory InvoiceDebtor.fromJson(Map<String, dynamic> j) => InvoiceDebtor(
        memberId: j['memberId'] as String? ?? '',
        memberCode: j['memberCode'] as String? ?? '',
        name: j['name'] as String? ?? '',
        outstanding: jsonMoney(j['outstanding']),
        invoiceCount: jsonInt(j['invoiceCount']),
      );
}

class InvoiceBranchStat {
  const InvoiceBranchStat({
    required this.branchId,
    required this.name,
    required this.invoiced,
    required this.collected,
  });

  final String branchId;
  final String name;
  final double invoiced;
  final double collected;

  factory InvoiceBranchStat.fromJson(Map<String, dynamic> j) =>
      InvoiceBranchStat(
        branchId: j['branchId'] as String? ?? '',
        name: j['name'] as String? ?? '',
        invoiced: jsonMoney(j['invoiced']),
        collected: jsonMoney(j['collected']),
      );
}

/// `summary` of `GET /invoices` — covers the whole filtered set, not the page.
class InvoiceListSummary {
  const InvoiceListSummary({
    required this.invoiced,
    required this.collected,
    required this.outstanding,
    required this.count,
  });

  final double invoiced;
  final double collected;
  final double outstanding;
  final int count;

  factory InvoiceListSummary.fromJson(Map<String, dynamic> j) =>
      InvoiceListSummary(
        invoiced: jsonMoney(j['invoiced']),
        collected: jsonMoney(j['collected']),
        outstanding: jsonMoney(j['outstanding']),
        count: jsonInt(j['count']),
      );
}

/// `counts` of `GET /invoices`: tenant-wide per status, ignoring the status
/// filter (so chips keep their numbers while one is selected).
class InvoiceCounts {
  const InvoiceCounts({
    required this.all,
    required this.unpaid,
    required this.partiallyPaid,
    required this.paid,
    required this.overdue,
    required this.cancelled,
  });

  final int all;
  final int unpaid;
  final int partiallyPaid;
  final int paid;
  final int overdue;
  final int cancelled;

  factory InvoiceCounts.fromJson(Map<String, dynamic> j) => InvoiceCounts(
        all: jsonInt(j['all']),
        unpaid: jsonInt(j['unpaid']),
        partiallyPaid: jsonInt(j['partiallyPaid']),
        paid: jsonInt(j['paid']),
        overdue: jsonInt(j['overdue']),
        cancelled: jsonInt(j['cancelled']),
      );
}
