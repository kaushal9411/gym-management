import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/member_visit.dart';
import '../../team/presentation/widgets/team_ui.dart'
    show TeamCenter, TeamColors;
import 'member_attendance_screen.dart';
import 'widgets/member_dash_ui.dart';

/// One visit — mobile-only detail of a row on My Attendance (web lists the
/// same fields inline): a hero with the day and duration, then check-in,
/// check-out, branch and method. Read-only, from the list item already loaded.
class MemberVisitDetailScreen extends StatelessWidget {
  const MemberVisitDetailScreen({required this.visit, super.key});

  final MemberVisit visit;

  String _pretty(String s) {
    final t = s.toLowerCase().replaceAll('_', ' ');
    return t.isEmpty ? '—' : t[0].toUpperCase() + t.substring(1);
  }

  @override
  Widget build(BuildContext context) {
    final d = visit.duration;
    final inside = d == null;
    final duration = inside
        ? 'Still inside'
        : d.inMinutes >= 60
            ? '${d.inHours}h ${d.inMinutes % 60}m'
            : '${d.inMinutes}m';
    Widget row(IconData icon, String label, String value) => Padding(
          padding: const EdgeInsets.symmetric(vertical: 10),
          child: Row(
            children: [
              Icon(icon, size: 18, color: AppColors.memberB),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  label,
                  style: AppText.body(
                    size: 13,
                    color: AppColors.inkFaint,
                    weight: FontWeight.w600,
                  ),
                ),
              ),
              Flexible(
                child: Text(
                  value,
                  textAlign: TextAlign.end,
                  style: AppText.body(size: 13, weight: FontWeight.w800),
                ),
              ),
            ],
          ),
        );
    return Scaffold(
      backgroundColor: AppColors.bg,
      body: ListView(
        padding: const EdgeInsets.only(bottom: 28),
        children: [
          MemberPageHero(
            eyebrow: 'Visit',
            title: formatVisitDay(visit.attendanceDate),
            subtitle: visit.branchName,
            chips: [
              if (inside) 'Checked in' else 'Completed',
              _pretty(visit.method),
            ],
            stats: [
              if (!inside) ('Duration', d.inMinutes, (n) => duration),
            ],
          ),
          TeamCenter(
            maxWidth: 760,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(18, 16, 18, 0),
              child: MemberSection(
                title: 'Visit details',
                icon: Icons.login_rounded,
                color: TeamColors.green,
                child: Container(
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(AppRadii.card),
                  ),
                  child: Column(
                    children: [
                      row(
                        Icons.login_rounded,
                        'Check-in',
                        formatClock(visit.checkInTime),
                      ),
                      row(
                        Icons.logout_rounded,
                        'Check-out',
                        visit.checkOutTime == null
                            ? 'In progress'
                            : formatClock(visit.checkOutTime!),
                      ),
                      row(Icons.timer_outlined, 'Duration', duration),
                      row(Icons.storefront_outlined, 'Branch',
                          visit.branchName,),
                      row(Icons.touch_app_outlined, 'Method',
                          _pretty(visit.method),),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
