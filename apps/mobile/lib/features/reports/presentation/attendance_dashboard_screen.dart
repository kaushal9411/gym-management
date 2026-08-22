import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/routing/app_routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/attendance_summary.dart';
import '../../../models/branch_option.dart';
import '../../../repositories/attendance_repository.dart';
import '../../../repositories/branch_repository.dart';
import '../../../shared/widgets/app_button.dart';
import '../../../shared/widgets/app_card.dart';
import '../../../shared/widgets/app_pill.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../owner/presentation/widgets/kpi_card.dart';
import 'widgets/report_filter_bar.dart';
import 'widgets/simple_bar_chart.dart';

String _fmtTime(DateTime d) {
  final hour = d.hour % 12 == 0 ? 12 : d.hour % 12;
  final minute = d.minute.toString().padLeft(2, '0');
  final period = d.hour >= 12 ? 'PM' : 'AM';
  return '$hour:$minute $period';
}

String _methodLabel(String? method) => switch (method) {
      'MANUAL' => 'Manual',
      'QR_CODE' => 'QR code',
      'BIOMETRIC' => 'Biometric',
      'FACE_RECOGNITION' => 'Face recognition',
      'NFC' => 'NFC',
      'RFID' => 'RFID',
      _ => 'Unknown',
    };

/// Owner Menu's "Attendance" — "Who's checked in, and how the gym trends
/// over time," matching web's `/attendance` dashboard exactly: a branch
/// filter (defaults to every branch, unlike the Manager tab's own-branch-
/// only `AttendanceScreen`), KPI cards + 7-day trend
/// (`GET /attendance/summary`), and today's full activity list
/// (`GET /attendance/today`) — every record, not just who's still inside.
/// "History" opens the tenant-wide filterable list; "Check in / out" opens
/// the existing manual-search check-in flow (Receptionist's own screen,
/// reused rather than duplicated).
class AttendanceDashboardScreen extends StatefulWidget {
  const AttendanceDashboardScreen({super.key});

  @override
  State<AttendanceDashboardScreen> createState() =>
      _AttendanceDashboardScreenState();
}

class _AttendanceDashboardScreenState extends State<AttendanceDashboardScreen> {
  AttendanceSummary? _summary;
  List<AttendanceRecord>? _today;
  List<BranchOption> _branchOptions = [];
  String? _branchId;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadBranchOptions();
    _load();
  }

  Future<void> _loadBranchOptions() async {
    try {
      final options = await getIt<BranchRepository>().assignable();
      if (!mounted) return;
      setState(() => _branchOptions = options);
    } on ApiException {
      // Non-fatal — filter bar just shows "All branches" only.
    }
  }

  Future<void> _load() async {
    setState(() => _error = null);
    try {
      final summaryFuture =
          getIt<AttendanceRepository>().summary(branchId: _branchId);
      final todayFuture =
          getIt<AttendanceRepository>().today(branchId: _branchId);
      final summary = await summaryFuture;
      final today = await todayFuture;
      if (!mounted) return;
      setState(() {
        _summary = summary;
        _today = today;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    }
  }

  void _onBranchChanged(String? branchId) {
    setState(() => _branchId = branchId);
    _load();
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
            Text('Today', style: AppText.eyebrow()),
            Text('Attendance', style: AppText.display(size: 18)),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => context.push(AppRoutes.attendanceHistory),
            child: const Text('History'),
          ),
          const SizedBox(width: 4),
        ],
      ),
      body: SafeArea(
        top: false,
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(18, 8, 18, 8),
              child: ReportFilterBar(
                branches: _branchOptions,
                selectedBranchId: _branchId,
                onBranchChanged: _onBranchChanged,
              ),
            ),
            Expanded(
              child: _error != null
                  ? AppErrorView(message: _error!, onRetry: _load)
                  : _summary == null || _today == null
                      ? const AppLoadingView()
                      : RefreshIndicator(
                          color: AppColors.staffB,
                          backgroundColor: AppColors.surface2,
                          onRefresh: _load,
                          child: _buildContent(_summary!, _today!),
                        ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildContent(
    AttendanceSummary summary,
    List<AttendanceRecord> today,
  ) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(18, 0, 18, 24),
      children: [
        Row(
          children: [
            Expanded(
              child: KpiCard(
                label: 'Check-ins',
                value: '${summary.totalCheckInsToday}',
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: KpiCard(
                label: 'Inside now',
                value: '${summary.currentlyInside}',
                valueColor: AppColors.memberB,
              ),
            ),
          ],
        ),
        const SizedBox(height: 16),
        GlassCard(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('7-day trend', style: AppText.eyebrow()),
              const SizedBox(height: 10),
              SimpleBarChart(
                data: summary.trend
                    .map(
                      (d) => BarDatum(
                        label: d.date.substring(8, 10),
                        value: d.count,
                      ),
                    )
                    .toList(),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        AppButton(
          label: 'Check in / out a member',
          variant: AppButtonVariant.ghost,
          icon: Icons.qr_code_scanner_rounded,
          onPressed: () => context.push(AppRoutes.searchMembers),
        ),
        const SizedBox(height: 16),
        AppCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text("Today's activity", style: AppText.eyebrow()),
              const SizedBox(height: 10),
              if (today.isEmpty)
                Text(
                  'No check-ins recorded today.',
                  style: AppText.body(color: AppColors.inkFaint),
                )
              else
                for (var i = 0; i < today.length; i++) ...[
                  if (i > 0) const Divider(height: 1, color: AppColors.line),
                  _ActivityRow(record: today[i]),
                ],
            ],
          ),
        ),
      ],
    );
  }
}

class _ActivityRow extends StatelessWidget {
  const _ActivityRow({required this.record});

  final AttendanceRecord record;

  @override
  Widget build(BuildContext context) {
    final checkedIn = record.status == 'CHECKED_IN';
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        children: [
          Container(
            width: 30,
            height: 30,
            decoration: const BoxDecoration(
              color: AppColors.staffSoft,
              shape: BoxShape.circle,
            ),
            alignment: Alignment.center,
            child: Text(
              record.memberName.isEmpty
                  ? '?'
                  : record.memberName[0].toUpperCase(),
              style: AppText.body(
                size: 11,
                weight: FontWeight.w800,
                color: AppColors.staffPillFg,
              ),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  record.memberName,
                  style: AppText.body(size: 13, weight: FontWeight.w700),
                ),
                const SizedBox(height: 2),
                Text(
                  checkedIn
                      ? 'In at ${_fmtTime(record.checkInTime)} · '
                          '${_methodLabel(record.method)}'
                      : '${_fmtTime(record.checkInTime)} – '
                          '${_fmtTime(record.checkOutTime!)} · '
                          '${_methodLabel(record.method)}',
                  style: AppText.body(size: 11, color: AppColors.inkFaint),
                ),
              ],
            ),
          ),
          AppPill(
            label: checkedIn ? 'Inside' : 'Checked out',
            tone: checkedIn ? AppPillTone.warning : AppPillTone.success,
          ),
        ],
      ),
    );
  }
}
