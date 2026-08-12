import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/routing/app_routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';

class _ReportTile {
  const _ReportTile({
    required this.icon,
    required this.title,
    required this.route,
  });

  final IconData icon;
  final String title;
  final String route;
}

const _tiles = [
  _ReportTile(
    icon: Icons.check_circle_outline_rounded,
    title: 'Attendance',
    route: AppRoutes.attendanceReport,
  ),
  _ReportTile(
    icon: Icons.people_alt_outlined,
    title: 'Membership',
    route: AppRoutes.membershipReport,
  ),
];

/// Design frame "10. Reports" (Receptionist — "View only"). Two tiles, not
/// the design's four: Workouts/Diet have no report screen built anywhere
/// in the app yet (no `workouts`/`diet` entry in `REPORT_TYPES` wired to
/// mobile) — dropped rather than faked. Attendance/Membership reuse the
/// exact same screens Owner/Manager use — they're permission-gated, not
/// role-locked.
class ReceptionistReportsScreen extends StatelessWidget {
  const ReceptionistReportsScreen({super.key});

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
            Text('View only', style: AppText.eyebrow()),
            Text('Reports', style: AppText.display(size: 18)),
          ],
        ),
      ),
      body: SafeArea(
        top: false,
        child: GridView.count(
          padding: const EdgeInsets.fromLTRB(18, 8, 18, 24),
          crossAxisCount: 2,
          crossAxisSpacing: 10,
          mainAxisSpacing: 10,
          childAspectRatio: 1.3,
          children: _tiles
              .map(
                (t) => Material(
                  color: Colors.transparent,
                  child: InkWell(
                    borderRadius: BorderRadius.circular(AppRadii.card),
                    onTap: () => context.push(t.route),
                    child: Container(
                      decoration: BoxDecoration(
                        color: AppColors.surface2,
                        borderRadius: BorderRadius.circular(AppRadii.card),
                        border: Border.all(color: AppColors.line),
                      ),
                      alignment: Alignment.center,
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(t.icon, size: 22, color: AppColors.staffB),
                          const SizedBox(height: 8),
                          Text(
                            t.title,
                            style: AppText.body(
                              size: 12,
                              weight: FontWeight.w700,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              )
              .toList(),
        ),
      ),
    );
  }
}
