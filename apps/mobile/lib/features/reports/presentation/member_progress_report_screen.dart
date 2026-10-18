import 'dart:async';

import 'package:flutter/material.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/member_progress_row.dart';
import '../../../repositories/reports_repository.dart';
import 'kit/kit.dart';
import 'people/people_report_page.dart';
import 'people/people_ui.dart';

/// `/reports/member-progress` — the report-type id (summary + list +
/// export).
const kMemberProgressReportType = 'member-progress';

/// Reports Center's "Member Progress" — "Workout and diet adherence",
/// matching web's report: a point-in-time snapshot (branch scope only), the
/// summary (**Members**, **Avg workout progress**, **Avg diet progress**
/// — already 0..100 on the wire — and the **Members by workout progress %**
/// bars) and one row per member with animated workout and diet progress bars
/// coloured like web's percent cell (>= 70 green, >= 35 amber, else rose). A
/// member without an active plan of a kind shows "No active ... plan" (the
/// API sends null, never 0). Export + Print: `PeopleReportPage`.
class MemberProgressReportScreen extends StatelessWidget {
  const MemberProgressReportScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return PeopleReportPage<MemberProgressRow>(
      type: kMemberProgressReportType,
      title: 'Member Progress',
      subtitle: 'Workout and diet adherence',
      accent: RptAccent.members,
      noun: 'members',
      resultsTitle: 'Members',
      emptyTitle: 'No members found',
      emptyMessage: 'Try a different branch.',
      emptyIcon: Icons.insights_rounded,
      fetch: (q, page, limit) => getIt<ReportsRepository>().memberProgress(
        branchId: q.branchId,
        page: page,
        limit: limit,
      ),
      itemBuilder: (context, row, i) => _ProgressCard(row: row, index: i),
    );
  }
}

Color _rowColor(MemberProgressRow r) {
  final vals = [
    if (r.workoutProgressPercent != null) r.workoutProgressPercent!,
    if (r.dietProgressPercent != null) r.dietProgressPercent!,
  ];
  if (vals.isEmpty) return RptColors.slate;
  return peopleProgressColor(vals.reduce((a, b) => a + b) / vals.length);
}

Widget _planBar({
  required String kind,
  required String? plan,
  required int? percent,
  double height = 7,
}) {
  if (percent == null) {
    return Row(
      children: [
        Icon(
          Icons.remove_circle_outline_rounded,
          size: 14,
          color: AppColors.inkFaint,
        ),
        const SizedBox(width: 6),
        Text(
          'No active $kind plan',
          style: AppText.body(
            size: 11.5,
            weight: FontWeight.w600,
            color: AppColors.inkFaint,
          ),
        ),
      ],
    );
  }
  return PeopleBar(
    label: '${kind[0].toUpperCase()}${kind.substring(1)} · ${plan ?? 'Plan'}',
    valueText: '$percent%',
    value: percent / 100,
    color: peopleProgressColor(percent),
    height: height,
  );
}

class _ProgressCard extends StatelessWidget {
  const _ProgressCard({required this.row, required this.index});

  final MemberProgressRow row;
  final int index;

  @override
  Widget build(BuildContext context) {
    return PeopleCard(
      index: index,
      name: row.name,
      subtitle: row.memberCode,
      color: _rowColor(row),
      onTap: () => _showDetail(context, row),
      children: [
        _planBar(
          kind: 'workout',
          plan: row.workoutPlan,
          percent: row.workoutProgressPercent,
        ),
        _planBar(
          kind: 'diet',
          plan: row.dietPlan,
          percent: row.dietProgressPercent,
        ),
      ],
    );
  }
}

void _showDetail(BuildContext context, MemberProgressRow row) {
  unawaited(
    showPeopleSheet(
      context,
      title: row.name,
      subtitle: row.memberCode,
      color: _rowColor(row),
      icon: Icons.insights_rounded,
      extra: [
        _planBar(
          kind: 'workout',
          plan: row.workoutPlan,
          percent: row.workoutProgressPercent,
          height: 10,
        ),
        _planBar(
          kind: 'diet',
          plan: row.dietPlan,
          percent: row.dietProgressPercent,
          height: 10,
        ),
      ],
    ),
  );
}
