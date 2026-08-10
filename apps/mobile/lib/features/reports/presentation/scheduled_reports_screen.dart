import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/routing/app_routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/scheduled_report.dart';
import '../../../repositories/scheduled_report_repository.dart';
import '../../../shared/widgets/app_pill.dart';
import '../../../shared/widgets/app_state_views.dart';

/// The "Scheduled" tile on the Reports Center grid — not a literal design
/// frame; backs the real `/reports/scheduled` CRUD (daily/weekly/monthly
/// email delivery of a report).
class ScheduledReportsScreen extends StatefulWidget {
  const ScheduledReportsScreen({super.key});

  @override
  State<ScheduledReportsScreen> createState() => _ScheduledReportsScreenState();
}

class _ScheduledReportsScreenState extends State<ScheduledReportsScreen> {
  List<ScheduledReport>? _reports;
  String? _error;
  String? _actionInFlightId;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _error = null);
    try {
      final reports = await getIt<ScheduledReportRepository>().list();
      if (!mounted) return;
      setState(() => _reports = reports);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    }
  }

  Future<void> _runNow(String id) async {
    setState(() => _actionInFlightId = id);
    try {
      await getIt<ScheduledReportRepository>().runNow(id);
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('Report run triggered')));
      await _load();
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(e.message)));
    } finally {
      if (mounted) setState(() => _actionInFlightId = null);
    }
  }

  Future<void> _delete(String id) async {
    setState(() => _actionInFlightId = id);
    try {
      await getIt<ScheduledReportRepository>().delete(id);
      await _load();
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(e.message)));
    } finally {
      if (mounted) setState(() => _actionInFlightId = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        backgroundColor: AppColors.bg,
        elevation: 0,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text('Automated email delivery', style: AppText.eyebrow()),
            Text('Scheduled Reports', style: AppText.display(size: 18)),
          ],
        ),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 12),
            child: Center(
              child: Container(
                width: 36,
                height: 36,
                decoration: const BoxDecoration(
                  gradient: AppColors.staffGrad,
                  shape: BoxShape.circle,
                ),
                child: IconButton(
                  padding: EdgeInsets.zero,
                  icon: const Icon(
                    Icons.add_rounded,
                    color: Colors.white,
                    size: 20,
                  ),
                  onPressed: () => context
                      .push(AppRoutes.scheduledReportForm)
                      .then((_) => _load()),
                ),
              ),
            ),
          ),
        ],
      ),
      body: SafeArea(
        top: false,
        child: _error != null
            ? AppErrorView(message: _error!, onRetry: _load)
            : _reports == null
                ? const AppLoadingView()
                : _reports!.isEmpty
                    ? const AppEmptyState(
                        icon: Icons.event_note_outlined,
                        title: 'No scheduled reports',
                        message:
                            'Tap + to have a report emailed to you automatically.',
                      )
                    : ListView.builder(
                        padding: const EdgeInsets.fromLTRB(18, 8, 18, 24),
                        itemCount: _reports!.length,
                        itemBuilder: (context, i) => _ScheduledReportCard(
                          report: _reports![i],
                          busy: _actionInFlightId == _reports![i].id,
                          onRunNow: () => _runNow(_reports![i].id),
                          onDelete: () => _delete(_reports![i].id),
                        ),
                      ),
      ),
    );
  }
}

class _ScheduledReportCard extends StatelessWidget {
  const _ScheduledReportCard({
    required this.report,
    required this.busy,
    required this.onRunNow,
    required this.onDelete,
  });

  final ScheduledReport report;
  final bool busy;
  final VoidCallback onRunNow;
  final VoidCallback onDelete;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface2,
        borderRadius: BorderRadius.circular(AppRadii.card),
        border: Border.all(color: AppColors.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Text(
                  report.name,
                  style: AppText.body(size: 14, weight: FontWeight.w700),
                ),
              ),
              AppPill(
                label: report.frequency.label,
                tone: AppPillTone.roleTint,
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            'Next run ${_formatDate(report.nextRunAt)} · ${report.recipientEmails.length} recipient(s)',
            style: AppText.body(
              size: 11,
              color: AppColors.inkFaint,
              weight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              TextButton(
                onPressed: busy ? null : onRunNow,
                child: Text(
                  'Run now',
                  style: AppText.body(
                    size: 12,
                    weight: FontWeight.w700,
                    color: AppColors.staffPillFg,
                  ),
                ),
              ),
              TextButton(
                onPressed: busy ? null : onDelete,
                child: Text(
                  'Delete',
                  style: AppText.body(
                    size: 12,
                    weight: FontWeight.w700,
                    color: AppColors.danger,
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  String _formatDate(DateTime d) => '${d.day}/${d.month}/${d.year}';
}
