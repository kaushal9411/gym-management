import 'dart:async';

import 'package:flutter/material.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/expiring_membership_row.dart';
import '../../../repositories/reports_repository.dart';
import '../../team/presentation/widgets/team_ui.dart';
import 'kit/kit.dart';
import 'people/people_report_page.dart';
import 'people/people_ui.dart';

/// `/reports/expiring-memberships` — the report-type id (summary + list +
/// export).
const kExpiringReportType = 'expiring-memberships';

/// Reports Center's "Expiring Memberships" — "Memberships ending within 30
/// days", matching web's report: a point-in-time snapshot (branch scope
/// only; the 30-day window is the server default and not a filter on web
/// either), the summary (**Expiring in 30 days**, **Expiring by window** and
/// **Expiring by plan** bars) and the member rows, soonest first, each with a
/// days-left ring coloured like web's pill (<= 7 rose, <= 14 amber, else
/// green). Linked from the dashboard ("Expiring in 30d", "View all").
/// Export + Print: `PeopleReportPage`.
class ExpiringMembershipsScreen extends StatelessWidget {
  const ExpiringMembershipsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return PeopleReportPage<ExpiringMembershipRow>(
      type: kExpiringReportType,
      title: 'Expiring Memberships',
      subtitle: 'Memberships ending within 30 days',
      accent: RptAccent.members,
      noun: 'expiring',
      resultsTitle: 'Expiring soon',
      emptyTitle: 'No memberships expiring soon',
      emptyMessage: 'Nothing ends in the next 30 days for this branch.',
      emptyIcon: Icons.hourglass_bottom_rounded,
      fetch: (q, page, limit) => getIt<ReportsRepository>().expiringMemberships(
        branchId: q.branchId,
        page: page,
        limit: limit,
      ),
      itemBuilder: (context, row, i) => _ExpiringCard(row: row, index: i),
    );
  }
}

String _daysText(int d) => d <= 0 ? 'Today' : '$d day${d == 1 ? '' : 's'}';

class _ExpiringCard extends StatelessWidget {
  const _ExpiringCard({required this.row, required this.index});

  final ExpiringMembershipRow row;
  final int index;

  @override
  Widget build(BuildContext context) {
    final color = peopleUrgencyColor(row.daysRemaining);
    return PeopleCard(
      index: index,
      name: row.name,
      subtitle: '${row.memberCode} · ${row.branch}',
      color: color,
      leading: PeopleRing(
        value: row.daysRemaining / 30,
        color: color,
        child: Text(
          '${row.daysRemaining < 0 ? 0 : row.daysRemaining}',
          style: AppText.display(size: 15),
        ),
      ),
      onTap: () => _showDetail(context, row),
      children: [
        Row(
          children: [
            Flexible(
              child: PeoplePill(
                label: row.plan,
                color: RptColors.indigo,
                icon: Icons.card_membership_rounded,
              ),
            ),
            const SizedBox(width: 8),
            PeoplePill(
              label: 'Ends ${peopleDate(row.endDate)}',
              color: color,
              icon: Icons.event_busy_rounded,
            ),
          ],
        ),
      ],
    );
  }
}

void _showDetail(BuildContext context, ExpiringMembershipRow row) {
  final color = peopleUrgencyColor(row.daysRemaining);
  unawaited(
    showPeopleSheet(
      context,
      title: row.name,
      subtitle: '${row.memberCode} · ends ${peopleDate(row.endDate)}',
      color: color,
      icon: Icons.hourglass_bottom_rounded,
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
          icon: Icons.card_membership_rounded,
          label: 'Plan',
          value: row.plan,
          color: RptColors.violet,
        ),
        TeamFieldTile(
          icon: Icons.event_busy_rounded,
          label: 'End date',
          value: peopleDate(row.endDate),
          color: RptColors.amber,
        ),
        TeamFieldTile(
          icon: Icons.hourglass_bottom_rounded,
          label: 'Days remaining',
          value: _daysText(row.daysRemaining),
          color: color,
        ),
      ],
      extra: [
        PeopleBar(
          label: 'Of the 30-day window left',
          valueText: _daysText(row.daysRemaining),
          value: row.daysRemaining / 30,
          color: color,
          height: 9,
        ),
      ],
    ),
  );
}
