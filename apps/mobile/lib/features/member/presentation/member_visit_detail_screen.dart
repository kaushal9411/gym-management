import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/member_visit.dart';
import 'member_attendance_screen.dart';

/// Design frame "8b. Visit detail".
class MemberVisitDetailScreen extends StatelessWidget {
  const MemberVisitDetailScreen({required this.visit, super.key});

  final MemberVisit visit;

  @override
  Widget build(BuildContext context) {
    final duration = visit.duration;

    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        backgroundColor: AppColors.bg,
        elevation: 0,
        title: Text(
          'Visit — ${formatVisitDay(visit.attendanceDate)}',
          style: AppText.display(size: 18),
        ),
      ),
      body: SafeArea(
        top: false,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(18, 8, 18, 24),
          children: [
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [Color(0x24C6F135), Color(0x1A14E0B4)],
                ),
                borderRadius: BorderRadius.circular(AppRadii.card),
                border: Border.all(color: AppColors.glassBorder),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Duration',
                    style: AppText.body(
                      size: 11,
                      weight: FontWeight.w800,
                      color: AppColors.memberPillFg,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    duration == null
                        ? 'Still inside'
                        : '${duration.inHours}h ${duration.inMinutes % 60}m',
                    style: AppText.display(size: 24),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
              decoration: BoxDecoration(
                color: AppColors.surface2,
                borderRadius: BorderRadius.circular(AppRadii.card),
                border: Border.all(color: AppColors.line),
              ),
              child: Column(
                children: [
                  _Row(label: 'Check-in', value: formatClock(visit.checkInTime)),
                  _Row(
                    label: 'Check-out',
                    value: visit.checkOutTime == null
                        ? '—'
                        : formatClock(visit.checkOutTime!),
                  ),
                  _Row(label: 'Branch', value: visit.branchName),
                  _Row(label: 'Method', value: visit.method),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Row extends StatelessWidget {
  const _Row({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: AppText.body(
              size: 13,
              color: AppColors.inkFaint,
              weight: FontWeight.w600,
            ),
          ),
          Text(value, style: AppText.body(size: 13, weight: FontWeight.w700)),
        ],
      ),
    );
  }
}
