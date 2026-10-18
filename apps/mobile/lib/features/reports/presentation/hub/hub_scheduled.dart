import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/di/service_locator.dart';
import '../../../../core/routing/app_routes.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_radii.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../models/scheduled_report.dart';
import '../../../../repositories/scheduled_report_repository.dart';
import '../../../team/presentation/widgets/team_ui.dart';
import '../kit/kit.dart';
import '../scheduled/scheduled_ui.dart';
import 'hub_catalog.dart';

/// Web's "Scheduled Reports" panel at the bottom of the hub: the next few
/// schedules with their status, a Manage button (opens the full list) and,
/// with `reports:export`, "Schedule a report". Needs `reports:view`; a failed
/// load just leaves the Manage button (the full screen shows the error).
class HubScheduledPanel extends StatefulWidget {
  const HubScheduledPanel({super.key, required this.access});

  final HubAccess access;

  @override
  State<HubScheduledPanel> createState() => _HubScheduledPanelState();
}

class _HubScheduledPanelState extends State<HubScheduledPanel> {
  List<ScheduledReport>? _reports;
  bool _failed = false;

  @override
  void initState() {
    super.initState();
    if (widget.access.canViewReports) _load();
  }

  Future<void> _load() async {
    try {
      final r = await getIt<ScheduledReportRepository>().list();
      if (mounted) setState(() => _reports = r);
    } catch (_) {
      if (mounted) setState(() => _failed = true);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (!widget.access.canViewReports) return const SizedBox.shrink();
    final reports = _reports;
    const color = RptColors.violet;
    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface2,
        borderRadius: BorderRadius.circular(AppRadii.card),
        border: Border.all(color: AppColors.line),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.fromLTRB(14, 12, 12, 12),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [color.withValues(alpha: 0.2), Colors.transparent],
              ),
            ),
            child: Row(
              children: [
                Container(
                  width: 34,
                  height: 34,
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [RptColors.indigo, RptColors.fuchsia],
                    ),
                    borderRadius: BorderRadius.circular(11),
                  ),
                  child: const Icon(
                    Icons.event_note_rounded,
                    size: 18,
                    color: Colors.white,
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Scheduled Reports',
                        style: AppText.display(size: 16),
                      ),
                      Text(
                        'Automatic email delivery on a schedule',
                        style: AppText.body(
                          size: 11.5,
                          color: AppColors.inkFaint,
                          weight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 2, 14, 14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (reports == null && !_failed)
                  const RptSkeleton(height: 56)
                else if (reports != null && reports.isEmpty)
                  Text(
                    'No scheduled reports yet — set one up for automatic '
                    'email delivery.',
                    style: AppText.body(
                      size: 12.5,
                      color: AppColors.inkFaint,
                      weight: FontWeight.w600,
                    ),
                  )
                else if (reports != null)
                  for (final r in reports.take(3)) _MiniRow(report: r),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: TeamToolbarButton(
                        icon: Icons.list_alt_rounded,
                        label: reports != null && reports.length > 3
                            ? 'Manage all (${reports.length})'
                            : 'Manage',
                        onTap: () => context.push(AppRoutes.scheduledReports),
                      ),
                    ),
                    if (widget.access.canExport) ...[
                      const SizedBox(width: 8),
                      Expanded(
                        child: TeamToolbarButton(
                          icon: Icons.add_rounded,
                          label: 'Schedule a report',
                          active: true,
                          onTap: () =>
                              context.push(AppRoutes.scheduledReportForm),
                        ),
                      ),
                    ],
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _MiniRow extends StatelessWidget {
  const _MiniRow({required this.report});

  final ScheduledReport report;

  @override
  Widget build(BuildContext context) {
    final c = scheduledTypeColor(report.reportType);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 5),
      child: Row(
        children: [
          Container(
            width: 30,
            height: 30,
            decoration: BoxDecoration(
              color: c.withValues(alpha: 0.16),
              borderRadius: BorderRadius.circular(10),
            ),
            child:
                Icon(scheduledTypeIcon(report.reportType), size: 16, color: c),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  report.name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppText.body(size: 13, weight: FontWeight.w800),
                ),
                Text(
                  '${scheduledReportTypeLabel(report.reportType)} · '
                  '${report.frequency.label} · next ${fmtDateTime(report.nextRunAt)}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppText.body(
                    size: 11,
                    color: AppColors.inkFaint,
                    weight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          RptStatPill(
            value: report.isActive ? 'Active' : 'Paused',
            color: report.isActive ? RptColors.green : RptColors.slate,
          ),
        ],
      ),
    );
  }
}
