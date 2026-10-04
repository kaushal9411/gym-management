import 'payments_analytics.dart';

/// Mirrors `GET /reports/overview` (perm `reports:view`, `OverviewDto` in
/// `reports-overview.util.ts`). Money arrives as decimal STRINGS. Parsing is
/// defensive — a missing block degrades to 0/empty so one odd value can't
/// blank the whole Insights header. Reuses `jsonMoney/jsonInt/jsonMap/
/// jsonList`, [AnalyticsRange] and [ValueVsPrevious] from
/// `payments_analytics.dart`.
class ReportsOverview {
  const ReportsOverview({
    required this.range,
    required this.previousRange,
    required this.kpis,
    required this.daily,
    required this.weekdayAttendance,
    required this.hourlyAttendance,
    required this.memberStatus,
    required this.planDistribution,
    required this.paymentMethods,
    required this.branches,
    required this.topTrainers,
    required this.expiringBuckets,
  });

  final AnalyticsRange range;
  final AnalyticsRange previousRange;
  final OverviewKpis kpis;
  final List<OverviewDay> daily;
  final List<OverviewWeekday> weekdayAttendance;
  final List<OverviewHour> hourlyAttendance;
  final List<OverviewStatus> memberStatus;
  final List<OverviewPlan> planDistribution;
  final List<OverviewMethod> paymentMethods;
  final List<OverviewBranch> branches;
  final List<OverviewTrainer> topTrainers;
  final List<OverviewBucket> expiringBuckets;

  factory ReportsOverview.fromJson(Map<String, dynamic> j) => ReportsOverview(
        range: AnalyticsRange.fromJson(jsonMap(j['range'])),
        previousRange: AnalyticsRange.fromJson(jsonMap(j['previousRange'])),
        kpis: OverviewKpis.fromJson(jsonMap(j['kpis'])),
        daily: jsonList(j['daily']).map(OverviewDay.fromJson).toList(),
        weekdayAttendance: jsonList(j['weekdayAttendance'])
            .map(OverviewWeekday.fromJson)
            .toList(),
        hourlyAttendance:
            jsonList(j['hourlyAttendance']).map(OverviewHour.fromJson).toList(),
        memberStatus:
            jsonList(j['memberStatus']).map(OverviewStatus.fromJson).toList(),
        planDistribution:
            jsonList(j['planDistribution']).map(OverviewPlan.fromJson).toList(),
        paymentMethods:
            jsonList(j['paymentMethods']).map(OverviewMethod.fromJson).toList(),
        branches: jsonList(j['branches']).map(OverviewBranch.fromJson).toList(),
        topTrainers:
            jsonList(j['topTrainers']).map(OverviewTrainer.fromJson).toList(),
        expiringBuckets: jsonList(j['expiringBuckets'])
            .map(OverviewBucket.fromJson)
            .toList(),
      );
}

class OverviewKpis {
  const OverviewKpis({
    required this.revenue,
    required this.expenses,
    required this.netProfit,
    required this.newMembers,
    required this.checkIns,
    required this.avgDailyCheckIns,
    required this.churned,
    required this.activeMembers,
    required this.expiringIn30d,
  });

  final ValueVsPrevious revenue;
  final ValueVsPrevious expenses;
  final ValueVsPrevious netProfit;
  final ValueVsPrevious newMembers;
  final ValueVsPrevious checkIns;
  final ValueVsPrevious avgDailyCheckIns;
  final ValueVsPrevious churned;

  /// Point-in-time counts — the API sends `{value}` with no `previous`.
  final int activeMembers;
  final int expiringIn30d;

  factory OverviewKpis.fromJson(Map<String, dynamic> j) {
    ValueVsPrevious kpi(String key) =>
        ValueVsPrevious.fromJson(jsonMap(j[key]));
    return OverviewKpis(
      revenue: kpi('revenue'),
      expenses: kpi('expenses'),
      netProfit: kpi('netProfit'),
      newMembers: kpi('newMembers'),
      checkIns: kpi('checkIns'),
      avgDailyCheckIns: kpi('avgDailyCheckIns'),
      churned: kpi('churned'),
      activeMembers: jsonInt(jsonMap(j['activeMembers'])['value']),
      expiringIn30d: jsonInt(jsonMap(j['expiringIn30d'])['value']),
    );
  }
}

class OverviewDay {
  const OverviewDay({
    required this.date,
    required this.revenue,
    required this.expenses,
    required this.checkIns,
    required this.newMembers,
    required this.prevRevenue,
    required this.prevExpenses,
    required this.prevCheckIns,
    required this.prevNewMembers,
  });

  final String date;
  final double revenue;
  final double expenses;
  final int checkIns;
  final int newMembers;
  final double prevRevenue;
  final double prevExpenses;
  final int prevCheckIns;
  final int prevNewMembers;

  factory OverviewDay.fromJson(Map<String, dynamic> j) => OverviewDay(
        date: j['date'] as String? ?? '',
        revenue: jsonMoney(j['revenue']),
        expenses: jsonMoney(j['expenses']),
        checkIns: jsonInt(j['checkIns']),
        newMembers: jsonInt(j['newMembers']),
        prevRevenue: jsonMoney(j['prevRevenue']),
        prevExpenses: jsonMoney(j['prevExpenses']),
        prevCheckIns: jsonInt(j['prevCheckIns']),
        prevNewMembers: jsonInt(j['prevNewMembers']),
      );
}

/// `weekday` is the API's own index (0 = Sunday .. 6 = Saturday, UTC).
class OverviewWeekday {
  const OverviewWeekday({
    required this.weekday,
    required this.count,
    required this.previousCount,
  });

  final int weekday;
  final int count;
  final int previousCount;

  factory OverviewWeekday.fromJson(Map<String, dynamic> j) => OverviewWeekday(
        weekday: jsonInt(j['weekday']),
        count: jsonInt(j['count']),
        previousCount: jsonInt(j['previousCount']),
      );
}

class OverviewHour {
  const OverviewHour({required this.hour, required this.count});

  final int hour;
  final int count;

  factory OverviewHour.fromJson(Map<String, dynamic> j) =>
      OverviewHour(hour: jsonInt(j['hour']), count: jsonInt(j['count']));
}

class OverviewStatus {
  const OverviewStatus({required this.status, required this.count});

  final String status;
  final int count;

  factory OverviewStatus.fromJson(Map<String, dynamic> j) => OverviewStatus(
        status: j['status'] as String? ?? '',
        count: jsonInt(j['count']),
      );
}

class OverviewPlan {
  const OverviewPlan({
    required this.planName,
    required this.activeCount,
    required this.revenue,
  });

  final String planName;
  final int activeCount;
  final double revenue;

  factory OverviewPlan.fromJson(Map<String, dynamic> j) => OverviewPlan(
        planName: j['planName'] as String? ?? '',
        activeCount: jsonInt(j['activeCount']),
        revenue: jsonMoney(j['revenue']),
      );
}

class OverviewMethod {
  const OverviewMethod({
    required this.method,
    required this.amount,
    required this.count,
  });

  final String method;
  final double amount;
  final int count;

  factory OverviewMethod.fromJson(Map<String, dynamic> j) => OverviewMethod(
        method: j['method'] as String? ?? '',
        amount: jsonMoney(j['amount']),
        count: jsonInt(j['count']),
      );
}

class OverviewBranch {
  const OverviewBranch({
    required this.branchId,
    required this.name,
    required this.revenue,
    required this.previousRevenue,
    required this.newMembers,
    required this.checkIns,
    required this.activeMembers,
  });

  final String branchId;
  final String name;
  final double revenue;
  final double previousRevenue;
  final int newMembers;
  final int checkIns;
  final int activeMembers;

  factory OverviewBranch.fromJson(Map<String, dynamic> j) => OverviewBranch(
        branchId: j['branchId'] as String? ?? '',
        name: j['name'] as String? ?? '',
        revenue: jsonMoney(j['revenue']),
        previousRevenue: jsonMoney(j['previousRevenue']),
        newMembers: jsonInt(j['newMembers']),
        checkIns: jsonInt(j['checkIns']),
        activeMembers: jsonInt(j['activeMembers']),
      );
}

class OverviewTrainer {
  const OverviewTrainer({
    required this.trainerId,
    required this.name,
    required this.assignedMembers,
  });

  final String trainerId;
  final String name;
  final int assignedMembers;

  factory OverviewTrainer.fromJson(Map<String, dynamic> j) => OverviewTrainer(
        trainerId: j['trainerId'] as String? ?? '',
        name: j['name'] as String? ?? '',
        assignedMembers: jsonInt(j['assignedMembers']),
      );
}

class OverviewBucket {
  const OverviewBucket({required this.label, required this.count});

  final String label;
  final int count;

  factory OverviewBucket.fromJson(Map<String, dynamic> j) => OverviewBucket(
        label: j['label'] as String? ?? '',
        count: jsonInt(j['count']),
      );
}
