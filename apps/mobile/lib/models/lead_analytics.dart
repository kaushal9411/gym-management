import 'payments_analytics.dart' show jsonInt, jsonList, jsonMap, jsonMoney;

/// Mirrors `GET /leads/analytics` (perm `leads:view`). Counts are plain
/// numbers; `conversionRate` is 0..1; `avgDaysToConvert.value` is null when
/// nothing converted in range. Every block is parsed defensively.

class LeadKpi {
  const LeadKpi({required this.value, this.previous});

  final double? value;
  final double? previous;

  /// % change vs previous; null without a baseline (never a fake +100%).
  double? get deltaPercent {
    final v = value;
    final p = previous;
    if (v == null || p == null || p <= 0) return null;
    return (v - p) / p * 100;
  }

  int get intValue => (value ?? 0).round();

  static LeadKpi parse(Object? raw) {
    final m = jsonMap(raw);
    return LeadKpi(
      value: m['value'] is num ? jsonMoney(m['value']) : null,
      previous: m['previous'] is num ? jsonMoney(m['previous']) : null,
    );
  }
}

class LeadHeadlinePeriod {
  const LeadHeadlinePeriod({
    this.newLeads = 0,
    this.converted = 0,
    this.previousNewLeads = 0,
    this.previousConverted = 0,
    this.newLeadsDelta,
    this.convertedDelta,
  });

  final int newLeads;
  final int converted;
  final int previousNewLeads;
  final int previousConverted;

  /// Server-computed % deltas; null when there is no baseline.
  final double? newLeadsDelta;
  final double? convertedDelta;

  factory LeadHeadlinePeriod.parse(Object? raw) {
    final m = jsonMap(raw);
    return LeadHeadlinePeriod(
      newLeads: jsonInt(m['newLeads']),
      converted: jsonInt(m['converted']),
      previousNewLeads: jsonInt(m['previousNewLeads']),
      previousConverted: jsonInt(m['previousConverted']),
      newLeadsDelta:
          m['newLeadsDelta'] is num ? jsonMoney(m['newLeadsDelta']) : null,
      convertedDelta:
          m['convertedDelta'] is num ? jsonMoney(m['convertedDelta']) : null,
    );
  }
}

class LeadDailyPoint {
  const LeadDailyPoint({
    required this.date,
    this.newLeads = 0,
    this.converted = 0,
    this.lost = 0,
  });

  final String date;
  final int newLeads;
  final int converted;
  final int lost;

  factory LeadDailyPoint.fromJson(Map<String, dynamic> j) => LeadDailyPoint(
        date: (j['date'] as String?) ?? '',
        newLeads: jsonInt(j['newLeads']),
        converted: jsonInt(j['converted']),
        lost: jsonInt(j['lost']),
      );
}

class LeadMonthlyPoint {
  const LeadMonthlyPoint({
    required this.month,
    this.newLeads = 0,
    this.converted = 0,
    this.conversionRate = 0,
  });

  final String month;
  final int newLeads;
  final int converted;
  final double conversionRate;

  factory LeadMonthlyPoint.fromJson(Map<String, dynamic> j) => LeadMonthlyPoint(
        month: (j['month'] as String?) ?? '',
        newLeads: jsonInt(j['newLeads']),
        converted: jsonInt(j['converted']),
        conversionRate: jsonMoney(j['conversionRate']),
      );
}

class LeadFunnelStage {
  const LeadFunnelStage({
    required this.stage,
    this.count = 0,
    this.pctOfTop = 0,
    this.dropOff = 0,
    this.dropOffRate = 0,
  });

  final String stage;
  final int count;
  final double pctOfTop;
  final int dropOff;
  final double dropOffRate;

  factory LeadFunnelStage.fromJson(Map<String, dynamic> j) => LeadFunnelStage(
        stage: (j['stage'] as String?) ?? '',
        count: jsonInt(j['count']),
        pctOfTop: jsonMoney(j['pctOfTop']),
        dropOff: jsonInt(j['dropOff']),
        dropOffRate: jsonMoney(j['dropOffRate']),
      );
}

/// A cohort row shared by bySource / byStaff / byPlan.
class LeadCohortRow {
  const LeadCohortRow({
    required this.key,
    required this.name,
    this.leads = 0,
    this.converted = 0,
    this.conversionRate = 0,
  });

  /// source enum / userId / planId (null for Unassigned / Not specified).
  final String? key;
  final String name;
  final int leads;
  final int converted;
  final double conversionRate;

  static LeadCohortRow fromJson(
    Map<String, dynamic> j, {
    required String keyField,
    String? nameField,
  }) =>
      LeadCohortRow(
        key: j[keyField] as String?,
        name: (nameField == null ? null : j[nameField] as String?) ??
            (j[keyField] as String?) ??
            '',
        leads: jsonInt(j['leads']),
        converted: jsonInt(j['converted']),
        conversionRate: jsonMoney(j['conversionRate']),
      );
}

class LeadLostReasonRow {
  const LeadLostReasonRow({required this.reason, required this.count});

  final String reason;
  final int count;
}

class LeadAgeingBucket {
  const LeadAgeingBucket({required this.bucket, required this.count});

  final String bucket;
  final int count;
}

class LeadAnalytics {
  const LeadAnalytics({
    required this.newLeads,
    required this.converted,
    required this.lost,
    required this.conversionRate,
    required this.avgDaysToConvert,
    required this.open,
    required this.followUpsDueToday,
    required this.followUpsOverdue,
    required this.today,
    required this.thisMonth,
    required this.thisYear,
    required this.daily,
    required this.monthly,
    required this.funnel,
    required this.funnelLost,
    required this.funnelTotal,
    required this.bySource,
    required this.byStaff,
    required this.byPlan,
    required this.lostReasons,
    required this.ageing,
  });

  final LeadKpi newLeads;
  final LeadKpi converted;
  final LeadKpi lost;
  final LeadKpi conversionRate;
  final LeadKpi avgDaysToConvert;
  final LeadKpi open;
  final LeadKpi followUpsDueToday;
  final LeadKpi followUpsOverdue;
  final LeadHeadlinePeriod today;
  final LeadHeadlinePeriod thisMonth;
  final LeadHeadlinePeriod thisYear;
  final List<LeadDailyPoint> daily;
  final List<LeadMonthlyPoint> monthly;
  final List<LeadFunnelStage> funnel;
  final int funnelLost;
  final int funnelTotal;
  final List<LeadCohortRow> bySource;
  final List<LeadCohortRow> byStaff;
  final List<LeadCohortRow> byPlan;
  final List<LeadLostReasonRow> lostReasons;
  final List<LeadAgeingBucket> ageing;

  factory LeadAnalytics.fromJson(Map<String, dynamic> j) {
    final k = jsonMap(j['kpis']);
    final h = jsonMap(j['headline']);
    final f = jsonMap(j['funnel']);
    return LeadAnalytics(
      newLeads: LeadKpi.parse(k['newLeads']),
      converted: LeadKpi.parse(k['converted']),
      lost: LeadKpi.parse(k['lost']),
      conversionRate: LeadKpi.parse(k['conversionRate']),
      avgDaysToConvert: LeadKpi.parse(k['avgDaysToConvert']),
      open: LeadKpi.parse(k['open']),
      followUpsDueToday: LeadKpi.parse(k['followUpsDueToday']),
      followUpsOverdue: LeadKpi.parse(k['followUpsOverdue']),
      today: LeadHeadlinePeriod.parse(h['today']),
      thisMonth: LeadHeadlinePeriod.parse(h['thisMonth']),
      thisYear: LeadHeadlinePeriod.parse(h['thisYear']),
      daily: jsonList(j['daily']).map(LeadDailyPoint.fromJson).toList(),
      monthly: jsonList(j['monthly']).map(LeadMonthlyPoint.fromJson).toList(),
      funnel: jsonList(f['stages']).map(LeadFunnelStage.fromJson).toList(),
      funnelLost: jsonInt(f['lost']),
      funnelTotal: jsonInt(f['total']),
      bySource: jsonList(j['bySource'])
          .map((e) => LeadCohortRow.fromJson(e, keyField: 'source'))
          .toList(),
      byStaff: jsonList(j['byStaff'])
          .map(
            (e) => LeadCohortRow.fromJson(
              e,
              keyField: 'userId',
              nameField: 'name',
            ),
          )
          .toList(),
      byPlan: jsonList(j['byPlan'])
          .map(
            (e) => LeadCohortRow.fromJson(
              e,
              keyField: 'planId',
              nameField: 'name',
            ),
          )
          .toList(),
      lostReasons: jsonList(j['lostReasons'])
          .map(
            (e) => LeadLostReasonRow(
              reason: (e['reason'] as String?) ?? '',
              count: jsonInt(e['count']),
            ),
          )
          .toList(),
      ageing: jsonList(j['ageing'])
          .map(
            (e) => LeadAgeingBucket(
              bucket: (e['bucket'] as String?) ?? '',
              count: jsonInt(e['count']),
            ),
          )
          .toList(),
    );
  }
}
