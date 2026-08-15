import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/routing/app_routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';

class _ReportEntry {
  const _ReportEntry({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.route,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final String route;
}

class _ReportSection {
  const _ReportSection({required this.label, required this.reports});

  final String label;
  final List<_ReportEntry> reports;
}

const _sections = [
  _ReportSection(
    label: 'Members',
    reports: [
      _ReportEntry(
        icon: Icons.groups_rounded,
        title: 'Membership Report',
        subtitle: 'Members with plan, status, and dates.',
        route: AppRoutes.membershipReport,
      ),
      _ReportEntry(
        icon: Icons.hourglass_bottom_rounded,
        title: 'Expiring Memberships',
        subtitle: 'Memberships ending within 30 days.',
        route: AppRoutes.expiringMembershipsReport,
      ),
      _ReportEntry(
        icon: Icons.pie_chart_outline_rounded,
        title: 'Active vs Inactive',
        subtitle: 'Member count by status.',
        route: AppRoutes.churnReport,
      ),
      _ReportEntry(
        icon: Icons.trending_up_rounded,
        title: 'Member Progress',
        subtitle: 'Workout and diet adherence.',
        route: AppRoutes.memberProgressReport,
      ),
    ],
  ),
  _ReportSection(
    label: 'Attendance',
    reports: [
      _ReportEntry(
        icon: Icons.check_circle_outline_rounded,
        title: 'Attendance Report',
        subtitle: 'Check-ins and check-outs over time.',
        route: AppRoutes.attendanceReport,
      ),
    ],
  ),
  _ReportSection(
    label: 'Finance',
    reports: [
      _ReportEntry(
        icon: Icons.bar_chart_rounded,
        title: 'Revenue Report',
        subtitle: 'Successful payments over time.',
        route: AppRoutes.revenueReport,
      ),
      _ReportEntry(
        icon: Icons.receipt_long_outlined,
        title: 'Expense Report',
        subtitle: 'Recorded expenses over time.',
        route: AppRoutes.expenseReport,
      ),
      _ReportEntry(
        icon: Icons.payments_rounded,
        title: 'Payment Report',
        subtitle: 'Every payment, with status.',
        route: AppRoutes.paymentReport,
      ),
    ],
  ),
  _ReportSection(
    label: 'Staff',
    reports: [
      _ReportEntry(
        icon: Icons.badge_outlined,
        title: 'Staff Report',
        subtitle: 'Managers, trainers, and receptionists.',
        route: AppRoutes.staffReport,
      ),
      _ReportEntry(
        icon: Icons.emoji_events_outlined,
        title: 'Trainer Performance',
        subtitle: 'Assigned members and active plans.',
        route: AppRoutes.staffPerformanceReport,
      ),
    ],
  ),
  _ReportSection(
    label: 'Branches',
    reports: [
      _ReportEntry(
        icon: Icons.storefront_rounded,
        title: 'Branch Performance',
        subtitle: 'Members, revenue, and attendance per branch.',
        route: AppRoutes.branchPerformanceReport,
      ),
    ],
  ),
];

/// Design frame "9. Reports center" — redesigned to match web's own
/// Reports Center exactly: named reports grouped by "members, attendance,
/// finance, staff, and branches," a link into the Analytics Dashboard, and
/// Scheduled Reports as its own entry point. Every card here is real,
/// working, and view-only — no report renders a transaction/payment-record
/// table for its own sake, matching the rest of this app's "charts and
/// summaries, not ledgers" convention.
class ReportsCenterScreen extends StatelessWidget {
  const ReportsCenterScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final total = _sections.fold<int>(0, (n, s) => n + s.reports.length);
    return ListView(
      padding: const EdgeInsets.fromLTRB(18, 16, 18, 90),
      children: [
        Text(
          '$total named reports · ${_sections.length} categories',
          style: AppText.eyebrow(),
        ),
        Text('Reports Center', style: AppText.display(size: 22)),
        const SizedBox(height: 4),
        Text(
          'Covering members, attendance, finance, staff, and branches.',
          style: AppText.body(size: 12, color: AppColors.inkFaint),
        ),
        const SizedBox(height: 16),
        _AnalyticsBanner(onTap: () => context.push(AppRoutes.analytics)),
        for (final section in _sections) ...[
          const SizedBox(height: 22),
          Text(section.label, style: AppText.eyebrow()),
          const SizedBox(height: 10),
          for (final report in section.reports) ...[
            _ReportTile(
              entry: report,
              onTap: () => context.push(report.route),
            ),
            const SizedBox(height: 8),
          ],
        ],
        const SizedBox(height: 22),
        Text('Automation', style: AppText.eyebrow()),
        const SizedBox(height: 10),
        _ReportTile(
          entry: const _ReportEntry(
            icon: Icons.event_note_outlined,
            title: 'Scheduled Reports',
            subtitle: 'Schedule a report to run and email automatically.',
            route: AppRoutes.scheduledReports,
          ),
          onTap: () => context.push(AppRoutes.scheduledReports),
        ),
      ],
    );
  }
}

/// "Go to Analytics Dashboard" — matches web's link at the top of its
/// Reports Center, into the same chart-heavy `AnalyticsScreen` already
/// reachable from Owner's Menu.
class _AnalyticsBanner extends StatelessWidget {
  const _AnalyticsBanner({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(AppRadii.card),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [Color(0x298B5CF6), Color(0x14FF6B5B)],
            ),
            borderRadius: BorderRadius.circular(AppRadii.card),
            border: Border.all(color: AppColors.glassBorder),
          ),
          child: Row(
            children: [
              Container(
                width: 42,
                height: 42,
                decoration: const BoxDecoration(
                  gradient: AppColors.staffGrad,
                  shape: BoxShape.circle,
                ),
                alignment: Alignment.center,
                child: const Icon(
                  Icons.insights_rounded,
                  size: 20,
                  color: Colors.white,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Go to Analytics Dashboard',
                      style: AppText.body(size: 14, weight: FontWeight.w800),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      'Growth trends and revenue mix, all in one view.',
                      style: AppText.body(
                        size: 11,
                        color: AppColors.inkFaint,
                        weight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
              const Icon(
                Icons.chevron_right_rounded,
                size: 20,
                color: AppColors.inkFaint,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// One report row — icon badge, title, one-line description (web's own
/// copy, verbatim), trailing chevron. Same settings-list chrome used
/// throughout the app's other hub-style screens.
class _ReportTile extends StatelessWidget {
  const _ReportTile({required this.entry, required this.onTap});

  final _ReportEntry entry;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(AppRadii.card),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: AppColors.surface2,
            borderRadius: BorderRadius.circular(AppRadii.card),
            border: Border.all(color: AppColors.line),
          ),
          child: Row(
            children: [
              Container(
                width: 38,
                height: 38,
                decoration: BoxDecoration(
                  color: AppColors.staffSoft,
                  borderRadius: BorderRadius.circular(AppRadii.tile),
                ),
                alignment: Alignment.center,
                child: Icon(entry.icon, size: 18, color: AppColors.staffPillFg),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      entry.title,
                      style: AppText.body(size: 13, weight: FontWeight.w700),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      entry.subtitle,
                      style: AppText.body(
                        size: 11,
                        color: AppColors.inkFaint,
                        weight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
              const Icon(
                Icons.chevron_right_rounded,
                size: 18,
                color: AppColors.inkFaint,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
