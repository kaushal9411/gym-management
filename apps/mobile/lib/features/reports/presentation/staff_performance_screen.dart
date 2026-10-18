import 'dart:async';

import 'package:flutter/material.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/paginated_result.dart';
import '../../../models/trainer_performance_row.dart';
import '../../../repositories/reports_repository.dart';
import '../../team/presentation/widgets/team_ui.dart';
import 'kit/kit.dart';
import 'people/people_report_page.dart';
import 'people/people_ui.dart';

/// `/reports/trainer-performance` — the report-type id (summary + list +
/// export). Behind the Hub's "Trainer Performance" tile and
/// `AppRoutes.staffPerformanceReport`.
const kStaffPerformanceReportType = 'trainer-performance';

const _rankColors = [RptColors.amber, RptColors.slate, RptColors.rose];

/// Reports Center's "Trainer Performance" — "Assigned members and active
/// plans", matching web's report: a live snapshot (branch scope only), the
/// summary (**Trainers**, **Assigned members**, **Avg members / trainer**
/// and the **Assigned members per trainer** ranked bars) and one card per
/// trainer — rank badge, assigned members (with a bar against the busiest
/// trainer), active workout plans and active diet plans. Sorted by assigned
/// members, busiest first (web's suggested sort).
/// Export + Print: `PeopleReportPage`.
class StaffPerformanceScreen extends StatefulWidget {
  const StaffPerformanceScreen({super.key});

  @override
  State<StaffPerformanceScreen> createState() => _StaffPerformanceScreenState();
}

class _StaffPerformanceScreenState extends State<StaffPerformanceScreen> {
  /// Largest `assignedMembers` of the rows last fetched (bar scale).
  int _max = 0;

  @override
  Widget build(BuildContext context) {
    return PeopleReportPage<TrainerPerformanceRow>(
      type: kStaffPerformanceReportType,
      title: 'Trainer Performance',
      subtitle: 'Assigned members and active plans',
      accent: RptAccent.staff,
      noun: 'trainers',
      resultsTitle: 'Trainers',
      emptyTitle: 'No trainers yet',
      emptyMessage:
          'Assign the Trainer role to a staff member to see them here.',
      emptyIcon: Icons.emoji_events_outlined,
      fetch: (q, page, limit) async {
        final rows = await getIt<ReportsRepository>()
            .trainerPerformance(branchId: q.branchId);
        final sorted = [...rows]
          ..sort((a, b) => b.assignedMembers.compareTo(a.assignedMembers));
        _max = sorted.isEmpty ? 0 : sorted.first.assignedMembers;
        return PaginatedResult(
          items: sorted,
          total: sorted.length,
          page: 1,
          limit: sorted.length,
          totalPages: 1,
        );
      },
      itemBuilder: (context, row, i) =>
          _TrainerCard(row: row, rank: i + 1, max: _max),
    );
  }
}

class _RankBadge extends StatelessWidget {
  const _RankBadge({required this.rank});

  final int rank;

  @override
  Widget build(BuildContext context) {
    final color = rank <= 3 ? _rankColors[rank - 1] : RptColors.slate;
    return Container(
      width: 46,
      height: 46,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [color, color.withValues(alpha: 0.45)],
        ),
      ),
      alignment: Alignment.center,
      child: rank == 1
          ? const Icon(
              Icons.emoji_events_rounded,
              color: Colors.white,
              size: 22,
            )
          : Text(
              '#$rank',
              style: AppText.display(size: 15, color: Colors.white),
            ),
    );
  }
}

class _TrainerCard extends StatelessWidget {
  const _TrainerCard({
    required this.row,
    required this.rank,
    required this.max,
  });

  final TrainerPerformanceRow row;
  final int rank;
  final int max;

  @override
  Widget build(BuildContext context) {
    return PeopleCard(
      index: rank - 1,
      name: row.name,
      subtitle: 'Rank $rank · ${row.assignedMembers} assigned',
      color: RptColors.fuchsia,
      leading: _RankBadge(rank: rank),
      onTap: () => _showDetail(context, row, max),
      children: [
        PeopleBar(
          label: 'Assigned members',
          valueText: '${row.assignedMembers}',
          value: max <= 0 ? 0 : row.assignedMembers / max,
          color: RptColors.fuchsia,
        ),
        Row(
          children: [
            Expanded(
              child: PeopleStat(
                icon: Icons.groups_rounded,
                value: '${row.assignedMembers}',
                label: 'Members',
                color: RptColors.indigo,
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: PeopleStat(
                icon: Icons.fitness_center_rounded,
                value: '${row.activeWorkoutPlans}',
                label: 'Workout plans',
                color: RptColors.teal,
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: PeopleStat(
                icon: Icons.restaurant_rounded,
                value: '${row.activeDietPlans}',
                label: 'Diet plans',
                color: RptColors.amber,
              ),
            ),
          ],
        ),
      ],
    );
  }
}

void _showDetail(BuildContext context, TrainerPerformanceRow row, int max) {
  unawaited(
    showPeopleSheet(
      context,
      title: row.name,
      subtitle: 'Trainer',
      color: RptColors.fuchsia,
      icon: Icons.emoji_events_rounded,
      tiles: [
        TeamFieldTile(
          icon: Icons.groups_rounded,
          label: 'Assigned members',
          value: '${row.assignedMembers}',
          color: RptColors.indigo,
        ),
        TeamFieldTile(
          icon: Icons.fitness_center_rounded,
          label: 'Active workout plans',
          value: '${row.activeWorkoutPlans}',
          color: RptColors.teal,
        ),
        TeamFieldTile(
          icon: Icons.restaurant_rounded,
          label: 'Active diet plans',
          value: '${row.activeDietPlans}',
          color: RptColors.amber,
        ),
      ],
      extra: [
        PeopleBar(
          label: 'Load vs the busiest trainer',
          valueText: '${row.assignedMembers} of $max',
          value: max <= 0 ? 0 : row.assignedMembers / max,
          color: RptColors.fuchsia,
          height: 10,
        ),
        Text(
          'Plans are counted per trainer across all branches; assigned members follow the branch filter.',
          style: AppText.body(
            size: 11,
            weight: FontWeight.w600,
            color: AppColors.inkFaint,
          ),
        ),
      ],
    ),
  );
}
