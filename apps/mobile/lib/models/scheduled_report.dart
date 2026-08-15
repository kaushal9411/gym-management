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

/// The subset of `REPORT_TYPES` offered on the mobile create form — the
/// backend allows 18 (including per-analytics-chart types); these are the
/// 11 tabular ones, each with an actual report screen elsewhere in the app.
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
      };

  String get label => switch (this) {
        ScheduledReportType.membership => 'Membership',
        ScheduledReportType.attendance => 'Attendance',
        ScheduledReportType.revenue => 'Revenue',
        ScheduledReportType.expenses => 'Expense',
        ScheduledReportType.payments => 'Payment',
        ScheduledReportType.staff => 'Staff',
        ScheduledReportType.trainerPerformance => 'Trainer performance',
        ScheduledReportType.memberProgress => 'Member progress',
        ScheduledReportType.branchPerformance => 'Branch performance',
        ScheduledReportType.expiringMemberships => 'Expiring memberships',
        ScheduledReportType.activeVsInactive => 'Active vs Inactive',
      };
}

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
  });

  final String id;
  final String name;
  final String reportType;
  final ReportFrequency frequency;
  final List<String> recipientEmails;
  final bool isActive;
  final DateTime? lastRunAt;
  final DateTime nextRunAt;

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
      );
}
