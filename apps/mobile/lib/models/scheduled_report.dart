enum ReportFrequency { daily, weekly, monthly }

extension ReportFrequencyX on ReportFrequency {
  String get apiValue => switch (this) {
        ReportFrequency.daily => 'DAILY',
        ReportFrequency.weekly => 'WEEKLY',
        ReportFrequency.monthly => 'MONTHLY',
      };

  String get label => switch (this) {
        ReportFrequency.daily => 'Daily',
        ReportFrequency.weekly => 'Weekly',
        ReportFrequency.monthly => 'Monthly',
      };

  static ReportFrequency fromApi(String v) => switch (v) {
        'DAILY' => ReportFrequency.daily,
        'MONTHLY' => ReportFrequency.monthly,
        _ => ReportFrequency.weekly,
      };
}

/// The 18 `REPORT_TYPES` the backend accepts (web's "which report" picker):
/// the 11 tabular reports and the 7 analytics views.
enum ScheduledReportType {
  membership,
  attendance,
  revenue,
  expenses,
  payments,
  staff,
  trainerPerformance,
  memberProgress,
  branchPerformance,
  expiringMemberships,
  activeVsInactive,
  analyticsRevenueTrends,
  analyticsAttendanceTrends,
  analyticsMembershipGrowth,
  analyticsNewMemberGrowth,
  analyticsRetention,
  analyticsPaymentCollection,
  analyticsBranchComparison,
}

extension ScheduledReportTypeX on ScheduledReportType {
  String get apiValue => switch (this) {
        ScheduledReportType.membership => 'membership',
        ScheduledReportType.attendance => 'attendance',
        ScheduledReportType.revenue => 'revenue',
        ScheduledReportType.expenses => 'expenses',
        ScheduledReportType.payments => 'payments',
        ScheduledReportType.staff => 'staff',
        ScheduledReportType.trainerPerformance => 'trainer-performance',
        ScheduledReportType.memberProgress => 'member-progress',
        ScheduledReportType.branchPerformance => 'branch-performance',
        ScheduledReportType.expiringMemberships => 'expiring-memberships',
        ScheduledReportType.activeVsInactive => 'active-vs-inactive',
        ScheduledReportType.analyticsRevenueTrends =>
          'analytics-revenue-trends',
        ScheduledReportType.analyticsAttendanceTrends =>
          'analytics-attendance-trends',
        ScheduledReportType.analyticsMembershipGrowth =>
          'analytics-membership-growth',
        ScheduledReportType.analyticsNewMemberGrowth =>
          'analytics-new-member-growth',
        ScheduledReportType.analyticsRetention => 'analytics-retention',
        ScheduledReportType.analyticsPaymentCollection =>
          'analytics-payment-collection',
        ScheduledReportType.analyticsBranchComparison =>
          'analytics-branch-comparison',
      };

  /// web's `REPORT_TYPE_OPTIONS` labels.
  String get label => switch (this) {
        ScheduledReportType.membership => 'Membership Report',
        ScheduledReportType.attendance => 'Attendance Report',
        ScheduledReportType.revenue => 'Revenue Report',
        ScheduledReportType.expenses => 'Expense Report',
        ScheduledReportType.payments => 'Payment Report',
        ScheduledReportType.staff => 'Staff Report',
        ScheduledReportType.trainerPerformance => 'Trainer Performance',
        ScheduledReportType.memberProgress => 'Member Progress',
        ScheduledReportType.branchPerformance => 'Branch Performance',
        ScheduledReportType.expiringMemberships => 'Expiring Memberships',
        ScheduledReportType.activeVsInactive => 'Active vs Inactive',
        ScheduledReportType.analyticsRevenueTrends =>
          'Analytics: Revenue Trends',
        ScheduledReportType.analyticsAttendanceTrends =>
          'Analytics: Attendance Trends',
        ScheduledReportType.analyticsMembershipGrowth =>
          'Analytics: Membership Growth',
        ScheduledReportType.analyticsNewMemberGrowth =>
          'Analytics: New Member Growth',
        ScheduledReportType.analyticsRetention => 'Analytics: Member Retention',
        ScheduledReportType.analyticsPaymentCollection =>
          'Analytics: Payment Collection',
        ScheduledReportType.analyticsBranchComparison =>
          'Analytics: Branch Comparison',
      };

  bool get isAnalytics => apiValue.startsWith('analytics-');

  static ScheduledReportType? fromApi(String v) {
    for (final t in ScheduledReportType.values) {
      if (t.apiValue == v) return t;
    }
    return null;
  }
}

/// Label for a raw `reportType` string from the API (falls back to the raw
/// value for a type this app does not know).
String scheduledReportTypeLabel(String apiValue) =>
    ScheduledReportTypeX.fromApi(apiValue)?.label ?? apiValue;

/// Mirrors `ScheduledReportDto`.
class ScheduledReport {
  const ScheduledReport({
    required this.id,
    required this.name,
    required this.reportType,
    required this.frequency,
    required this.recipientEmails,
    required this.isActive,
    required this.lastRunAt,
    required this.nextRunAt,
    this.branchName,
  });

  final String id;
  final String name;
  final String reportType;
  final ReportFrequency frequency;
  final List<String> recipientEmails;
  final bool isActive;
  final DateTime? lastRunAt;
  final DateTime nextRunAt;

  /// Branch the schedule is scoped to (null = all branches).
  final String? branchName;

  factory ScheduledReport.fromJson(Map<String, dynamic> json) =>
      ScheduledReport(
        id: json['id'] as String,
        name: json['name'] as String,
        reportType: json['reportType'] as String,
        frequency: ReportFrequencyX.fromApi(json['frequency'] as String),
        recipientEmails: (json['recipientEmails'] as List).cast<String>(),
        isActive: json['isActive'] as bool? ?? true,
        lastRunAt: json['lastRunAt'] != null
            ? DateTime.parse(json['lastRunAt'] as String)
            : null,
        nextRunAt: DateTime.parse(json['nextRunAt'] as String),
        branchName: json['branch'] is Map<String, dynamic>
            ? (json['branch'] as Map<String, dynamic>)['name'] as String?
            : null,
      );
}
