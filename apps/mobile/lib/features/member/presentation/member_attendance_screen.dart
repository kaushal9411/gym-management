import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/routing/app_routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/member_visit.dart';
import '../../../repositories/member_portal_repository.dart';
import '../../../shared/widgets/app_state_views.dart';

/// Design frame "8a. My attendance" — the last-14-days grid plus the
/// recent-visit list, both from `GET /portal/attendance`.
class MemberAttendanceScreen extends StatefulWidget {
  const MemberAttendanceScreen({super.key});

  @override
  State<MemberAttendanceScreen> createState() => _MemberAttendanceScreenState();
}

class _MemberAttendanceScreenState extends State<MemberAttendanceScreen> {
  List<MemberVisit> _visits = const [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final result =
          await getIt<MemberPortalRepository>().attendance(limit: 60);
      if (!mounted) return;
      setState(() => _visits = result.items);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final today = DateTime.now();
    final startOfToday = DateTime(today.year, today.month, today.day);
    final visitedDays = _visits
        .map(
          (v) => DateTime(
            v.attendanceDate.year,
            v.attendanceDate.month,
            v.attendanceDate.day,
          ),
        )
        .toSet();
    final last14 = List.generate(
      14,
      (i) => startOfToday.subtract(Duration(days: 13 - i)),
    );

    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        backgroundColor: AppColors.bg,
        elevation: 0,
        title: Text('My Attendance', style: AppText.display(size: 18)),
      ),
      body: SafeArea(
        top: false,
        child: _loading
            ? const AppLoadingView(role: AppRole.member)
            : _error != null
                ? AppErrorView(
                    message: _error!,
                    onRetry: _load,
                    role: AppRole.member,
                  )
                : ListView(
                    padding: const EdgeInsets.fromLTRB(18, 8, 18, 24),
                    children: [
                      Container(
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: AppColors.surface2,
                          borderRadius: BorderRadius.circular(AppRadii.card),
                          border: Border.all(color: AppColors.line),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('Last 14 days', style: AppText.eyebrow()),
                            const SizedBox(height: 10),
                            GridView.count(
                              shrinkWrap: true,
                              physics: const NeverScrollableScrollPhysics(),
                              crossAxisCount: 7,
                              crossAxisSpacing: 6,
                              mainAxisSpacing: 6,
                              children: last14.map((day) {
                                final visited = visitedDays.contains(day);
                                return Container(
                                  decoration: BoxDecoration(
                                    gradient:
                                        visited ? AppColors.memberGrad : null,
                                    color:
                                        visited ? null : AppColors.surface3,
                                    borderRadius: BorderRadius.circular(7),
                                    border: visited
                                        ? null
                                        : Border.all(color: AppColors.line),
                                  ),
                                  alignment: Alignment.center,
                                  child: Text(
                                    '${day.day}',
                                    style: AppText.body(
                                      size: 10,
                                      weight: FontWeight.w800,
                                      color: visited
                                          ? AppColors.memberOnGrad
                                          : AppColors.inkFaint,
                                    ),
                                  ),
                                );
                              }).toList(),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 12),
                      Text('Recent visits', style: AppText.eyebrow()),
                      const SizedBox(height: 8),
                      if (_visits.isEmpty)
                        const AppEmptyState(
                          icon: Icons.event_busy_outlined,
                          title: 'No visits yet',
                          message: 'Your check-ins will show up here.',
                        ),
                      ..._visits.map(
                        (visit) => _VisitRow(
                          visit: visit,
                          onTap: () => context.push(
                            AppRoutes.memberVisitDetail,
                            extra: visit,
                          ),
                        ),
                      ),
                    ],
                  ),
      ),
    );
  }
}

class _VisitRow extends StatelessWidget {
  const _VisitRow({required this.visit, required this.onTap});

  final MemberVisit visit;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(AppRadii.card),
        onTap: onTap,
        child: Container(
          margin: const EdgeInsets.only(bottom: 8),
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: AppColors.surface2,
            borderRadius: BorderRadius.circular(AppRadii.card),
            border: Border.all(color: AppColors.line),
          ),
          child: Row(
            children: [
              Expanded(
                child: Text(
                  formatVisitDay(visit.attendanceDate),
                  style: AppText.body(size: 13, weight: FontWeight.w700),
                ),
              ),
              Text(
                visit.checkOutTime == null
                    ? '${formatClock(visit.checkInTime)} → now'
                    : '${formatClock(visit.checkInTime)} → '
                        '${formatClock(visit.checkOutTime!)}',
                style: AppText.body(size: 12, color: AppColors.inkFaint),
              ),
              const SizedBox(width: 6),
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

String formatClock(DateTime time) {
  final hour = time.hour % 12 == 0 ? 12 : time.hour % 12;
  final minute = time.minute.toString().padLeft(2, '0');
  return '$hour:$minute ${time.hour < 12 ? 'AM' : 'PM'}';
}

String formatVisitDay(DateTime date) {
  final now = DateTime.now();
  final today = DateTime(now.year, now.month, now.day);
  final day = DateTime(date.year, date.month, date.day);
  final diff = today.difference(day).inDays;
  if (diff == 0) return 'Today';
  if (diff == 1) return 'Yesterday';
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  return '${date.day} ${months[date.month - 1]}';
}
