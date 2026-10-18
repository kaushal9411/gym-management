import 'dart:async';

import 'package:flutter/material.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/attendance_report_row.dart';
import '../../../repositories/reports_repository.dart';
import '../../team/presentation/widgets/team_ui.dart';
import 'kit/kit.dart';
import 'people/people_report_page.dart';
import 'people/people_ui.dart';

/// `/reports/attendance` — the report-type id (summary + list + export).
const kAttendanceReportType = 'attendance';

/// Reports Center's "Attendance Report" — "Check-ins and check-outs over
/// time", matching web's report: the period bar (Today ... Custom, Compare,
/// branch), the summary (**Total check-ins / Unique members / Avg per day**
/// with deltas, **Daily check-ins** this-vs-previous trend with a Cumulative
/// switch, **Check-ins by method** donut) and the **check-in rows**
/// (member, in -> out, time inside, method) from `GET /reports/attendance`.
///
/// Changes vs the old screen: the bar chart came from
/// `/analytics/attendance-trends` (`analytics:view`); the same daily counts
/// are in the summary series (`reports:view`, what web uses), so that call is
/// gone — and roles with `reports:view` but not `analytics:view`
/// (Receptionist, Trainer) now get the chart instead of a 403. The check-in
/// rows are new (web has them). Branch scoping is unchanged: the picked
/// branch is sent as `branchId`. Export + Print: `PeopleReportPage`.
class AttendanceReportScreen extends StatelessWidget {
  const AttendanceReportScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return PeopleReportPage<AttendanceReportRow>(
      type: kAttendanceReportType,
      title: 'Attendance Report',
      subtitle: 'Check-ins and check-outs over time',
      accent: RptAccent.attendance,
      showPeriod: true,
      noun: 'check-ins',
      resultsTitle: 'Check-ins',
      emptyTitle: 'No check-ins in this period',
      emptyMessage: 'Try a wider period or another branch.',
      emptyIcon: Icons.how_to_reg_rounded,
      fetch: (q, page, limit) => getIt<ReportsRepository>().attendance(
        from: q.from,
        to: q.to,
        branchId: q.branchId,
        page: page,
        limit: limit,
      ),
      itemBuilder: (context, row, i) => _AttendanceCard(row: row, index: i),
    );
  }
}

class _AttendanceCard extends StatelessWidget {
  const _AttendanceCard({required this.row, required this.index});

  final AttendanceReportRow row;
  final int index;

  @override
  Widget build(BuildContext context) {
    final mColor = peopleMethodColor(row.method);
    final d = row.duration;
    return PeopleCard(
      index: index,
      name: row.name,
      subtitle: '${row.memberCode} · ${row.branch}',
      color: RptColors.teal,
      trailing: PeoplePill(
        label: peopleMethodLabel(row.method),
        color: mColor,
        icon: peopleMethodIcon(row.method),
      ),
      onTap: () => _showDetail(context, row),
      children: [
        Row(
          children: [
            Expanded(
              child: _TimeBlock(
                icon: Icons.login_rounded,
                label: 'In',
                value: peopleTime(row.checkIn),
                color: RptColors.green,
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: _TimeBlock(
                icon: Icons.logout_rounded,
                label: 'Out',
                value: row.checkOut == null
                    ? 'Still in'
                    : peopleTime(row.checkOut),
                color: row.checkOut == null ? RptColors.amber : RptColors.rose,
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: _TimeBlock(
                icon: Icons.timer_rounded,
                label: 'Inside',
                value: d == null ? '—' : peopleDuration(d),
                color: RptColors.indigo,
              ),
            ),
          ],
        ),
        Row(
          children: [
            Icon(
              Icons.calendar_today_rounded,
              size: 12,
              color: AppColors.inkFaint,
            ),
            const SizedBox(width: 5),
            Text(
              peopleDate(row.date),
              style: AppText.body(
                size: 11.5,
                weight: FontWeight.w700,
                color: AppColors.inkFaint,
              ),
            ),
          ],
        ),
      ],
    );
  }
}

class _TimeBlock extends StatelessWidget {
  const _TimeBlock({
    required this.icon,
    required this.label,
    required this.value,
    required this.color,
  });

  final IconData icon;
  final String label;
  final String value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 8),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 12, color: color),
              const SizedBox(width: 4),
              Text(
                label.toUpperCase(),
                style: AppText.body(
                  size: 9.5,
                  weight: FontWeight.w800,
                  color: color,
                ),
              ),
            ],
          ),
          const SizedBox(height: 3),
          Text(
            value,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: AppText.body(size: 12.5, weight: FontWeight.w800),
          ),
        ],
      ),
    );
  }
}

void _showDetail(BuildContext context, AttendanceReportRow row) {
  final d = row.duration;
  unawaited(
    showPeopleSheet(
      context,
      title: row.name,
      subtitle: '${row.memberCode} · ${peopleDate(row.date)}',
      color: RptColors.teal,
      icon: Icons.how_to_reg_rounded,
      tiles: [
        TeamFieldTile(
          icon: Icons.storefront_rounded,
          label: 'Branch',
          value: row.branch,
          color: RptColors.sky,
        ),
        TeamFieldTile(
          icon: peopleMethodIcon(row.method),
          label: 'Method',
          value: peopleMethodLabel(row.method),
          color: peopleMethodColor(row.method),
        ),
        TeamFieldTile(
          icon: Icons.login_rounded,
          label: 'Check in',
          value: peopleTime(row.checkIn),
          color: RptColors.green,
        ),
        TeamFieldTile(
          icon: Icons.logout_rounded,
          label: 'Check out',
          value: row.checkOut == null ? null : peopleTime(row.checkOut),
          color: RptColors.rose,
        ),
        TeamFieldTile(
          icon: Icons.timer_rounded,
          label: 'Time inside',
          value: d == null ? null : peopleDuration(d),
          color: RptColors.indigo,
        ),
        TeamFieldTile(
          icon: Icons.calendar_today_rounded,
          label: 'Date',
          value: peopleDate(row.date),
          color: RptColors.amber,
        ),
      ],
    ),
  );
}
