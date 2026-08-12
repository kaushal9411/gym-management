import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../bloc/session/session_cubit.dart';
import '../../../bloc/session/session_state.dart';
import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/attendance_summary.dart';
import '../../../repositories/attendance_repository.dart';
import '../../../repositories/staff_repository.dart';
import '../../../shared/widgets/app_card.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../owner/presentation/widgets/kpi_card.dart';
import '../../reports/presentation/widgets/simple_bar_chart.dart';

/// Design frame "8. Attendance". `GET /attendance/summary` and
/// `/attendance/today` aren't auto-scoped to the caller's branch the way
/// dashboard/report endpoints are — this screen looks up the manager's own
/// primary branch first (`GET /staff/:id` for their own user) and passes
/// it explicitly, so a manager only ever sees their own branch's traffic.
class AttendanceScreen extends StatefulWidget {
  const AttendanceScreen({super.key});

  @override
  State<AttendanceScreen> createState() => _AttendanceScreenState();
}

class _AttendanceScreenState extends State<AttendanceScreen> {
  AttendanceSummary? _summary;
  List<AttendanceRecord>? _today;
  String? _error;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_summary == null && _error == null) _load();
  }

  Future<void> _load() async {
    setState(() => _error = null);
    try {
      final session = context.read<SessionCubit>().state;
      String? branchId;
      if (session is SessionAuthenticatedStaff) {
        final self = await getIt<StaffRepository>().getById(session.user.id);
        branchId = self.primaryBranch?.branchId;
      }
      final summaryFuture =
          getIt<AttendanceRepository>().summary(branchId: branchId);
      final todayFuture =
          getIt<AttendanceRepository>().today(branchId: branchId);
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

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(18, 16, 18, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Today', style: AppText.eyebrow()),
          Text('Attendance', style: AppText.display(size: 22)),
          const SizedBox(height: 16),
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
    );
  }

  Widget _buildContent(
    AttendanceSummary summary,
    List<AttendanceRecord> today,
  ) {
    final inside = today.where((r) => r.checkOutTime == null).toList();
    return ListView(
      padding: const EdgeInsets.only(bottom: 90),
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
        AppCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Currently inside', style: AppText.eyebrow()),
              const SizedBox(height: 10),
              if (inside.isEmpty)
                Text(
                  'No one checked in right now.',
                  style: AppText.body(color: AppColors.inkFaint),
                )
              else
                ...inside.map(
                  (r) => Padding(
                    padding: const EdgeInsets.symmetric(vertical: 6),
                    child: Row(
                      children: [
                        Container(
                          width: 26,
                          height: 26,
                          decoration: const BoxDecoration(
                            color: AppColors.staffSoft,
                            shape: BoxShape.circle,
                          ),
                          alignment: Alignment.center,
                          child: Text(
                            r.memberName.isEmpty
                                ? '?'
                                : r.memberName[0].toUpperCase(),
                            style: AppText.body(
                              size: 10,
                              weight: FontWeight.w800,
                              color: AppColors.staffPillFg,
                            ),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            r.memberName,
                            style: AppText.body(
                              size: 13,
                              weight: FontWeight.w700,
                            ),
                          ),
                        ),
                        Text(
                          _formatTime(r.checkInTime),
                          style: AppText.body(
                            size: 11,
                            color: AppColors.inkFaint,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
            ],
          ),
        ),
      ],
    );
  }

  String _formatTime(DateTime d) {
    final hour = d.hour % 12 == 0 ? 12 : d.hour % 12;
    final minute = d.minute.toString().padLeft(2, '0');
    final period = d.hour >= 12 ? 'PM' : 'AM';
    return '$hour:$minute $period';
  }
}
