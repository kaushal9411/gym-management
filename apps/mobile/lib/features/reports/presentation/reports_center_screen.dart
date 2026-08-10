import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/routing/app_routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../shared/widgets/app_card.dart';

class _ReportEntry {
  const _ReportEntry({required this.icon, required this.title, this.route});

  final IconData icon;
  final String title;

  /// Null means "not built yet" — see `MenuScreen`'s identical convention.
  final String? route;
}

const _reports = [
  _ReportEntry(
    icon: Icons.bar_chart_rounded,
    title: 'Revenue',
    route: AppRoutes.revenueReport,
  ),
  _ReportEntry(
    icon: Icons.groups_rounded,
    title: 'Membership',
    route: AppRoutes.membershipReport,
  ),
  _ReportEntry(
    icon: Icons.check_circle_outline_rounded,
    title: 'Attendance',
    route: AppRoutes.attendanceReport,
  ),
  _ReportEntry(
    icon: Icons.emoji_events_outlined,
    title: 'Staff perf.',
    route: AppRoutes.staffPerformanceReport,
  ),
  _ReportEntry(
    icon: Icons.trending_down_rounded,
    title: 'Churn',
    route: AppRoutes.churnReport,
  ),
  _ReportEntry(
    icon: Icons.event_note_outlined,
    title: 'Scheduled',
    route: AppRoutes.scheduledReports,
  ),
];

/// Design frame "9. Reports center".
class ReportsCenterScreen extends StatelessWidget {
  const ReportsCenterScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(18, 16, 18, 90),
      children: [
        Text('${_reports.length} reports', style: AppText.eyebrow()),
        Text('Reports', style: AppText.display(size: 22)),
        const SizedBox(height: 18),
        GridView.count(
          crossAxisCount: 2,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          crossAxisSpacing: 10,
          mainAxisSpacing: 10,
          childAspectRatio: 1.15,
          children: _reports.map((r) {
            final builtYet = r.route != null;
            return GestureDetector(
              onTap: () {
                if (builtYet) {
                  context.push(r.route!);
                } else {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text(
                        '${r.title} report is coming in a future update',
                      ),
                    ),
                  );
                }
              },
              child: AppCard(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(
                      r.icon,
                      size: 22,
                      color: builtYet ? AppColors.staffB : AppColors.inkFaint,
                    ),
                    const SizedBox(height: 10),
                    Text(
                      r.title,
                      style: AppText.body(size: 12, weight: FontWeight.w700),
                      textAlign: TextAlign.center,
                    ),
                  ],
                ),
              ),
            );
          }).toList(),
        ),
      ],
    );
  }
}
