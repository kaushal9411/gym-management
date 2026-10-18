import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../bloc/session/session_cubit.dart';
import '../../../bloc/session/session_state.dart';
import '../../../core/di/service_locator.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/membership_plan.dart';
import '../../../models/membership_report_row.dart';
import '../../../models/report_summary.dart';
import '../../../repositories/membership_plan_repository.dart';
import '../../../repositories/reports_repository.dart';
import '../../team/presentation/widgets/team_ui.dart';
import 'kit/kit.dart';
import 'people/people_report_page.dart';
import 'people/people_ui.dart';

/// `/reports/membership` — the report-type id (summary + list + export).
const kMembershipReportType = 'membership';

const _statusChips = <RptChip<String>>[
  RptChip('', 'All'),
  RptChip('ACTIVE', 'Active', dot: RptColors.green),
  RptChip('INACTIVE', 'Inactive', dot: RptColors.slate),
  RptChip('FROZEN', 'Frozen', dot: RptColors.sky),
];

/// Reports Center's "Membership Report" — "Members with plan, status and
/// dates", matching web's report of the same name: hero with the summary
/// figures, branch scope (no date range — the endpoint does not apply one),
/// Status chips + Plan picker (web's two extra filters), the summary
/// (total members, **Members by status** donut, **Active memberships by
/// plan** bars) and the member rows with a validity bar.
///
/// Gating (unchanged): no client gate on the screen; the summary hides
/// without `reports:view` / on 403; the Plan picker is offered only with
/// `memberships:view` (the key `GET /membership-plans` needs). Export + Print
/// (status and plan included): `PeopleReportPage`.
class MembershipReportScreen extends StatefulWidget {
  const MembershipReportScreen({super.key});

  @override
  State<MembershipReportScreen> createState() => _MembershipReportScreenState();
}

class _MembershipReportScreenState extends State<MembershipReportScreen> {
  String _status = '';
  String? _planId;
  List<MembershipPlan> _plans = const [];

  @override
  void initState() {
    super.initState();
    final s = context.read<SessionCubit>().state;
    if (s is SessionAuthenticatedStaff &&
        s.user.hasPermission('memberships:view')) {
      unawaited(_loadPlans());
    }
  }

  Future<void> _loadPlans() async {
    try {
      final r = await getIt<MembershipPlanRepository>().list(
        limit: 100,
        sortBy: 'name',
        sortDir: 'asc',
      );
      if (mounted) setState(() => _plans = r.items);
    } catch (_) {
      // Non-fatal — the Plan picker simply stays hidden.
    }
  }

  Future<void> _pickPlan() async {
    final v = await pickOneSheet(
      context,
      title: 'Plan',
      options: [for (final p in _plans) (p.id, p.name)],
      current: _planId,
      clearLabel: 'All plans',
    );
    if (v == null) return;
    setState(() => _planId = v.isEmpty ? null : v);
  }

  String get _planLabel {
    for (final p in _plans) {
      if (p.id == _planId) return p.name;
    }
    return 'All plans';
  }

  @override
  Widget build(BuildContext context) {
    return PeopleReportPage<MembershipReportRow>(
      type: kMembershipReportType,
      title: 'Membership Report',
      subtitle: 'Members with plan, status and dates',
      accent: RptAccent.members,
      noun: 'members',
      resultsTitle: 'Members',
      emptyTitle: 'No members found',
      emptyMessage: 'Try a different branch, status or plan.',
      emptyIcon: Icons.groups_rounded,
      extraKey: '$_status|$_planId',
      extraFilters: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
            decoration: BoxDecoration(
              color: AppColors.surface2,
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: AppColors.line),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('STATUS', style: AppText.eyebrow()),
                const SizedBox(height: 8),
                RptFilterChips<String>(
                  chips: _statusChips,
                  value: _status,
                  color: RptAccent.members.color,
                  onChanged: (v) => setState(() => _status = v),
                ),
                if (_plans.isNotEmpty) ...[
                  const SizedBox(height: 12),
                  Text('PLAN', style: AppText.eyebrow()),
                  const SizedBox(height: 8),
                  Align(
                    alignment: Alignment.centerLeft,
                    child: TeamToolbarButton(
                      icon: Icons.card_membership_rounded,
                      label: _planLabel,
                      active: _planId != null,
                      onTap: _pickPlan,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
      summaryFilters: (q) => ReportSummaryFilters(
        branchId: q.branchId,
        memberStatus: _status.isEmpty ? null : _status,
        planId: _planId,
      ),
      fetch: (q, page, limit) => getIt<ReportsRepository>().membership(
        branchId: q.branchId,
        memberStatus: _status.isEmpty ? null : _status,
        planId: _planId,
        page: page,
        limit: limit,
      ),
      itemBuilder: (context, row, i) => _MembershipCard(row: row, index: i),
    );
  }
}

/// Validity of a membership as `(elapsed fraction, days left, colour)`;
/// null when the row has no dates.
({double elapsed, int daysLeft, Color color})? _validity(
  MembershipReportRow row,
) {
  final s = DateTime.tryParse(row.startDate ?? '');
  final e = DateTime.tryParse(row.endDate ?? '');
  final left = peopleDaysUntil(row.endDate);
  if (s == null || e == null || left == null) return null;
  final total = e.difference(s).inDays;
  final done = DateTime.now().difference(s).inDays;
  final elapsed = total <= 0 ? 1.0 : (done / total).clamp(0.0, 1.0);
  final color = left < 0
      ? RptColors.rose
      : left <= 7
          ? RptColors.rose
          : left <= 14
              ? RptColors.amber
              : peopleStatusColor(row.status);
  return (elapsed: elapsed, daysLeft: left, color: color);
}

String _leftText(int days) {
  if (days < 0) return 'Ended ${-days} day${days == -1 ? '' : 's'} ago';
  if (days == 0) return 'Ends today';
  return '$days day${days == 1 ? '' : 's'} left';
}

class _MembershipCard extends StatelessWidget {
  const _MembershipCard({required this.row, required this.index});

  final MembershipReportRow row;
  final int index;

  @override
  Widget build(BuildContext context) {
    final color = peopleStatusColor(row.status);
    final v = _validity(row);
    return PeopleCard(
      index: index,
      name: row.name,
      subtitle: '${row.memberCode} · ${row.branch}',
      color: color,
      trailing: PeoplePill(
        label: prettyEnum(row.status),
        color: color,
        dot: true,
      ),
      onTap: () => _showDetail(context, row),
      children: [
        if (row.plan == null)
          Text(
            'No plan',
            style: AppText.body(
              size: 12,
              weight: FontWeight.w700,
              color: AppColors.inkFaint,
            ),
          )
        else if (v == null)
          Align(
            alignment: Alignment.centerLeft,
            child: PeoplePill(
              label: row.plan!,
              color: RptColors.indigo,
              icon: Icons.card_membership_rounded,
            ),
          )
        else ...[
          PeopleBar(
            label: row.plan,
            valueText: _leftText(v.daysLeft),
            value: v.elapsed,
            color: v.color,
          ),
          Text(
            '${peopleDate(row.startDate)}  →  ${peopleDate(row.endDate)}',
            style: AppText.body(
              size: 11,
              weight: FontWeight.w600,
              color: AppColors.inkFaint,
            ),
          ),
        ],
      ],
    );
  }
}

void _showDetail(BuildContext context, MembershipReportRow row) {
  final color = peopleStatusColor(row.status);
  final v = _validity(row);
  unawaited(
    showPeopleSheet(
      context,
      title: row.name,
      subtitle: '${row.memberCode} · ${prettyEnum(row.status)}',
      color: color,
      icon: Icons.assignment_ind_rounded,
      tiles: [
        TeamFieldTile(
          icon: Icons.badge_rounded,
          label: 'Member ID',
          value: row.memberCode,
          color: RptColors.indigo,
        ),
        TeamFieldTile(
          icon: Icons.storefront_rounded,
          label: 'Branch',
          value: row.branch,
          color: RptColors.sky,
        ),
        TeamFieldTile(
          icon: Icons.verified_rounded,
          label: 'Status',
          value: prettyEnum(row.status),
          color: color,
        ),
        TeamFieldTile(
          icon: Icons.card_membership_rounded,
          label: 'Plan',
          value: row.plan,
          color: RptColors.violet,
        ),
        TeamFieldTile(
          icon: Icons.event_available_rounded,
          label: 'Start date',
          value: row.startDate == null ? null : peopleDate(row.startDate),
          color: RptColors.teal,
        ),
        TeamFieldTile(
          icon: Icons.event_busy_rounded,
          label: 'End date',
          value: row.endDate == null ? null : peopleDate(row.endDate),
          color: RptColors.amber,
        ),
      ],
      extra: [
        if (v != null)
          PeopleBar(
            label: 'Membership elapsed',
            valueText: _leftText(v.daysLeft),
            value: v.elapsed,
            color: v.color,
            height: 9,
          ),
      ],
    ),
  );
}
