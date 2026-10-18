import 'dart:async';

import 'package:flutter/material.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/staff_report_row.dart';
import '../../../repositories/reports_repository.dart';
import '../../team/presentation/widgets/team_ui.dart';
import 'kit/kit.dart';
import 'people/people_report_page.dart';
import 'people/people_ui.dart';

/// `/reports/staff` — the report-type id (summary + list + export).
const kStaffReportType = 'staff';

/// Reports Center's "Staff Report" — "Managers, trainers, and
/// receptionists", matching web's report: a point-in-time snapshot (branch
/// scope only), the summary (**Total staff**, **Staff by role** bars,
/// **Staff by status** donut in status colours) and one row per staff member
/// (role, primary branch, status, joining date).
/// Export + Print: `PeopleReportPage`.
class StaffReportScreen extends StatelessWidget {
  const StaffReportScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return PeopleReportPage<StaffReportRow>(
      type: kStaffReportType,
      title: 'Staff Report',
      subtitle: 'Managers, trainers and receptionists',
      accent: RptAccent.staff,
      noun: 'staff',
      resultsTitle: 'Team',
      emptyTitle: 'No staff found',
      emptyMessage: 'Try a different branch.',
      emptyIcon: Icons.badge_rounded,
      fetch: (q, page, limit) => getIt<ReportsRepository>().staff(
        branchId: q.branchId,
        page: page,
        limit: limit,
      ),
      itemBuilder: (context, row, i) => _StaffCard(row: row, index: i),
    );
  }
}

class _StaffCard extends StatelessWidget {
  const _StaffCard({required this.row, required this.index});

  final StaffReportRow row;
  final int index;

  @override
  Widget build(BuildContext context) {
    final role = peopleRoleColor(row.role);
    final status = peopleStatusColor(row.status);
    return PeopleCard(
      index: index,
      name: row.name,
      subtitle: row.branch ?? 'No branch',
      color: role,
      trailing: PeoplePill(
        label: prettyEnum(row.status),
        color: status,
        dot: true,
      ),
      onTap: () => _showDetail(context, row),
      children: [
        Row(
          children: [
            PeoplePill(
              label: prettyEnum(row.role),
              color: role,
              icon: Icons.verified_user_rounded,
            ),
            const SizedBox(width: 10),
            Icon(
              Icons.event_available_rounded,
              size: 13,
              color: AppColors.inkFaint,
            ),
            const SizedBox(width: 5),
            Expanded(
              child: Text(
                row.joiningDate == null
                    ? 'Joining date not set'
                    : 'Joined ${peopleDate(row.joiningDate)}',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                textAlign: TextAlign.end,
                style: AppText.body(
                  size: 11.5,
                  weight: FontWeight.w700,
                  color: AppColors.inkFaint,
                ),
              ),
            ),
          ],
        ),
      ],
    );
  }
}

void _showDetail(BuildContext context, StaffReportRow row) {
  final role = peopleRoleColor(row.role);
  unawaited(
    showPeopleSheet(
      context,
      title: row.name,
      subtitle: prettyEnum(row.role),
      color: role,
      icon: Icons.badge_rounded,
      tiles: [
        TeamFieldTile(
          icon: Icons.verified_user_rounded,
          label: 'Role',
          value: prettyEnum(row.role),
          color: role,
        ),
        TeamFieldTile(
          icon: Icons.verified_rounded,
          label: 'Status',
          value: prettyEnum(row.status),
          color: peopleStatusColor(row.status),
        ),
        TeamFieldTile(
          icon: Icons.storefront_rounded,
          label: 'Branch',
          value: row.branch,
          color: RptColors.sky,
        ),
        TeamFieldTile(
          icon: Icons.event_available_rounded,
          label: 'Joined',
          value: row.joiningDate == null ? null : peopleDate(row.joiningDate),
          color: RptColors.teal,
        ),
      ],
    ),
  );
}
